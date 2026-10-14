import "server-only";
import QRCode from "qrcode";
import { PDFDocument, StandardFonts, cmyk, rgb } from "pdf-lib";
import { findLabelSize, findProduct } from "@/lib/catalog/helpers";
import { rupeesInWords } from "@/lib/commerce/gst";
import { districtByCode } from "@/lib/districts";
import type { Design } from "@/lib/design/types";
import { labelsToPrint } from "@/lib/print/imposition";
import { proofPdf, rollPdf } from "@/lib/print/pdf";
import { supabaseAdmin } from "@/lib/supabase/server";
import { HttpError } from "./auth";
import { getCatalog } from "./catalog";
import { getOrder, regDataFor } from "./orders";
import { dataUri, getFile, putFile } from "./storage";

/** The booked ad creative for a district on a date (Shop labels), as a data URI. */
async function adCreativeFor(districtCode: string, date: string): Promise<string | null> {
  const { data } = await supabaseAdmin()
    .from("ad_bookings")
    .select("creative_path")
    .eq("district_code", districtCode)
    .in("status", ["approved", "live"])
    .lte("start_date", date)
    .gte("end_date", date)
    .not("creative_path", "is", null)
    .limit(1)
    .maybeSingle();
  if (!data?.creative_path) return null;
  const buf = await getFile("ad-creatives", data.creative_path);
  return dataUri(buf, data.creative_path.endsWith(".png") ? "image/png" : "image/jpeg");
}

/**
 * Builds the print files for every line of an order: a single-label proof (CMYK, 2 mm bleed, crop
 * marks) and a roll layout for the Memjet sized to the quantity. Stored in the private print bucket.
 */
export async function generatePrintFiles(orderId: string) {
  const db = supabaseAdmin();
  const order = await getOrder(orderId);
  if (!order) throw new HttpError(404, "Order not found");
  const catalog = await getCatalog({ fresh: true });
  const { data: items } = await db.from("order_items").select("*").eq("order_id", orderId);
  const ad = order.segment === "shop" ? await adCreativeFor(order.district_code, order.delivery_date) : null;
  const mfg = new Date();
  const results = [];

  for (const item of items ?? []) {
    const size = findLabelSize(catalog, item.label_size_id);
    const product = findProduct(catalog, item.product_id);
    if (!size || !product) throw new HttpError(409, `Missing size/product for ${item.id}`);
    const design = item.design as Design;
    const images = new Map<string, string>();
    for (const el of design.elements) {
      if (el.type === "image" && !images.has(el.src)) {
        const buf = await getFile("uploads", el.src);
        images.set(el.src, dataUri(buf, el.src.endsWith(".png") ? "image/png" : "image/jpeg"));
      }
    }
    const input = {
      design,
      size,
      segment: design.segment,
      reg: size.hasRegPanel ? regDataFor(catalog, product.id, { batchNo: order.order_no, mfg }) : null,
      adHref: ad,
      images,
      minTextPt: catalog.settings.minTextPt,
    };
    const title = `${order.order_no} · ${product.nameEn}`;
    const proof = await proofPdf(input, title);
    const qty = labelsToPrint(item.items, catalog.settings.spoilagePct);
    const roll = await rollPdf(input, qty, title, catalog.roll);
    const base = `orders/${order.order_no}/${item.id}`;
    await putFile("print-files", `${base}-proof.pdf`, proof, "application/pdf");
    await putFile("print-files", `${base}-roll.pdf`, roll.pdf, "application/pdf");
    await db.from("order_items").update({ proof_pdf_path: `${base}-proof.pdf`, roll_pdf_path: `${base}-roll.pdf`, imposition: { ...roll.imposition, labels: qty } }).eq("id", item.id);
    results.push({ itemId: item.id, imposition: roll.imposition, labels: qty });
  }
  await db.from("print_orders").update({ status: "printing" }).eq("order_id", orderId).eq("status", "queued");
  return results;
}

const mm = (v: number) => (v * 72) / 25.4;

/** 100 × 75 mm pack labels, one per pack, with the batch pack number as a QR code. */
export async function packLabelsPdf(orderId: string): Promise<Uint8Array> {
  const db = supabaseAdmin();
  const order = await getOrder(orderId);
  if (!order) throw new HttpError(404, "Order not found");
  const { data: packs } = await db.from("packs").select("pack_no, cases, order_item_id").eq("order_id", orderId).order("pack_no");
  if (!packs?.length) throw new HttpError(409, "Pack the order first");
  const { data: lo } = await db.from("load_orders").select("stop_seq").eq("order_id", orderId).maybeSingle();
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Pack labels ${order.order_no}`);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const reg = await pdf.embedFont(StandardFonts.Helvetica);
  const k = cmyk(0, 0, 0, 1);
  for (const [i, p] of packs.entries()) {
    const page = pdf.addPage([mm(100), mm(75)]);
    const png = await QRCode.toBuffer(p.pack_no, { errorCorrectionLevel: "M", margin: 1, width: 600 });
    const qr = await pdf.embedPng(png);
    page.drawImage(qr, { x: mm(4), y: mm(18), width: mm(40), height: mm(40) });
    page.drawText("hellolabels", { x: mm(4), y: mm(66), size: 13, font: bold, color: k });
    page.drawText(p.pack_no, { x: mm(4), y: mm(11), size: 11, font: bold, color: k });
    page.drawText(`Pack ${i + 1} of ${packs.length}${p.cases ? ` · ${p.cases} case(s)` : ""}`, { x: mm(4), y: mm(5), size: 8, font: reg, color: k });
    const lines = [
      `Order ${order.order_no}`,
      order.ship_name,
      ...wrap(order.ship_address, 30).slice(0, 3),
      `${districtByCode(order.district_code)?.en ?? order.district_code} ${order.ship_pincode}`,
      `Route ${order.route_code ?? "—"} · Stop ${lo?.stop_seq ?? "—"}`,
      `Deliver ${order.delivery_date}`,
    ];
    lines.forEach((l, j) => page.drawText(l, { x: mm(47), y: mm(58 - j * 5.2), size: j === 0 ? 9 : 8, font: j === 0 ? bold : reg, color: k }));
  }
  return pdf.save();
}

function wrap(s: string, n: number): string[] {
  const out: string[] = [];
  let line = "";
  for (const w of s.split(/\s+/)) {
    if ((line + " " + w).trim().length > n && line) {
      out.push(line);
      line = w;
    } else line = (line + " " + w).trim();
  }
  if (line) out.push(line);
  return out;
}

const rs = (paise: number) => `Rs. ${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** GST tax invoice (A4) with HSN codes, tax split and the buyer's GSTIN when given. */
export async function invoicePdf(orderId: string): Promise<Uint8Array> {
  const db = supabaseAdmin();
  const order = await getOrder(orderId);
  if (!order?.invoice_no) throw new HttpError(409, "The invoice is issued once payment is received");
  const catalog = await getCatalog();
  const s = catalog.settings;
  const { data: items } = await db.from("order_items").select("*").eq("order_id", orderId);
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Invoice ${order.invoice_no}`);
  const page = pdf.addPage([595.28, 841.89]);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const reg = await pdf.embedFont(StandardFonts.Helvetica);
  const ink = rgb(0.078, 0.102, 0.149);
  const grey = rgb(0.33, 0.36, 0.41);
  const text = (t: string, x: number, y: number, size = 9, f = reg, color = ink) => page.drawText(t, { x, y, size, font: f, color });
  const right = (t: string, x: number, y: number, size = 9, f = reg) => text(t, x - f.widthOfTextAtSize(t, size), y, size, f);

  text("hellolabels", 40, 790, 20, bold);
  text(s.gstin ? "TAX INVOICE" : "INVOICE", 420, 795, 14, bold);
  text(s.legalName, 40, 772, 9, bold);
  wrap(s.address, 60).forEach((l, i) => text(l, 40, 760 - i * 11, 8, reg, grey));
  if (s.gstin) text(`GSTIN: ${s.gstin}   State: Tamil Nadu (33)`, 40, 726, 8, reg, grey);
  text(`Invoice No: ${order.invoice_no}`, 380, 772, 9, bold);
  text(`Invoice Date: ${order.invoice_date}`, 380, 760);
  text(`Order: ${order.order_no}`, 380, 748);
  text(`Place of supply: ${order.buyer_state_code === "33" ? "Tamil Nadu (33)" : `State code ${order.buyer_state_code}`}`, 380, 736);

  page.drawLine({ start: { x: 40, y: 715 }, end: { x: 555, y: 715 }, thickness: 0.6, color: grey });
  text("Bill to / Ship to", 40, 700, 8, bold, grey);
  text(order.buyer_legal_name || order.ship_name, 40, 688, 10, bold);
  wrap(`${order.ship_address}, ${districtByCode(order.district_code)?.en ?? ""} ${order.ship_pincode}`, 70).forEach((l, i) => text(l, 40, 676 - i * 11, 8));
  text(`Phone: ${order.ship_phone}${order.buyer_gstin ? `   GSTIN: ${order.buyer_gstin}` : ""}`, 40, 643, 8);

  const intra = order.buyer_state_code === (s.stateCode || "33");
  const cols = intra ? ["#", "Description", "HSN", "Qty", "Rate", "Taxable", "CGST", "SGST", "Total"] : ["#", "Description", "HSN", "Qty", "Rate", "Taxable", "IGST", "Total"];
  const xs = intra ? [40, 58, 230, 268, 310, 365, 420, 470, 555] : [40, 58, 250, 290, 340, 410, 480, 555];
  let y = 615;
  page.drawRectangle({ x: 38, y: y - 4, width: 519, height: 16, color: rgb(0.965, 0.953, 0.925) });
  cols.forEach((c, i) => (i < 2 ? text(c, xs[i], y, 8, bold) : right(c, xs[i], y, 8, bold)));
  y -= 20;
  for (const [i, it] of (items ?? []).entries()) {
    const p = findProduct(catalog, it.product_id);
    const name = (p?.nameEn ?? it.product_id) + (p?.unit === "case" ? ` (${it.qty} cases × ${p.caseSize})` : "");
    const rate = Math.round((it.taxable_paise / it.items) * 100) / 100;
    const vals = intra
      ? [String(i + 1), name, it.hsn, String(it.items), rs(rate), rs(it.taxable_paise), `${rs(it.cgst_paise)}`, `${rs(it.sgst_paise)}`, rs(it.total_paise)]
      : [String(i + 1), name, it.hsn, String(it.items), rs(rate), rs(it.taxable_paise), rs(it.igst_paise), rs(it.total_paise)];
    vals.forEach((v, j) => (j < 2 ? text(j === 1 ? v.slice(0, 40) : v, xs[j], y, 8) : right(v, xs[j], y, 8)));
    y -= 14;
  }
  const rate = items?.[0]?.gst_rate_pct ?? 18;
  y -= 6;
  page.drawLine({ start: { x: 40, y: y + 8 }, end: { x: 555, y: y + 8 }, thickness: 0.4, color: grey });
  const totals: [string, number][] = [["Taxable value", order.taxable_paise]];
  if (intra) totals.push([`CGST @ ${Number(rate) / 2}%`, order.cgst_paise], [`SGST @ ${Number(rate) / 2}%`, order.sgst_paise]);
  else totals.push([`IGST @ ${rate}%`, order.igst_paise]);
  totals.push(["Invoice total", order.total_paise], ["Received", order.amount_paid_paise]);
  if (order.amount_refunded_paise) totals.push(["Refunded", order.amount_refunded_paise]);
  const due = order.total_paise - order.amount_paid_paise;
  if (due > 0) totals.push(["Balance due on delivery", due]);
  for (const [label, v] of totals) {
    right(label, 470, y, 9, label === "Invoice total" ? bold : reg);
    right(rs(v), 555, y, 9, label === "Invoice total" ? bold : reg);
    y -= 14;
  }
  text(rupeesInWords(order.total_paise), 40, y - 6, 8, bold);
  text("Prices include GST. This is a computer generated invoice.", 40, 70, 7, reg, grey);
  text("Kolathur, Mettur Tk, Salem District, Tamil Nadu 636303", 40, 58, 7, reg, grey);
  return pdf.save();
}
