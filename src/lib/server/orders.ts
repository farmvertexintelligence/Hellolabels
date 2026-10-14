import "server-only";
import { z } from "zod";
import { findLabelSize, findProduct } from "@/lib/catalog/helpers";
import type { Catalog, Segment } from "@/lib/catalog/types";
import { financialYear, gstinState, invoiceNumber, isValidGstin } from "@/lib/commerce/gst";
import { canMoveTo, earliestDelivery, istToday, packNumber, packsFor, type OrderStatus } from "@/lib/commerce/logistics";
import { advanceAllowed, priceCart, type PaymentPlan } from "@/lib/commerce/pricing";
import { districtByCode } from "@/lib/districts";
import { runChecks } from "@/lib/design/checks";
import { regDataFor } from "@/lib/design/regdata";
import { sanitizeDesign } from "@/lib/design/sanitize";
import type { Design } from "@/lib/design/types";
import { serverMeasure } from "@/lib/print/server-fonts";
import { supabaseAdmin } from "@/lib/supabase/server";
import { HttpError, type SessionUser } from "./auth";
import { getCatalog } from "./catalog";
import { notifyStatus } from "./notify";

export const CheckoutSchema = z.object({
  lines: z
    .array(
      z.object({
        productId: z.string().max(60),
        labelSizeId: z.string().max(60),
        segment: z.enum(["event", "shop", "label"]),
        qty: z.number().int().positive().max(100000),
        designId: z.string().uuid().nullish(),
        design: z.unknown(),
      }),
    )
    .min(1)
    .max(20),
  delivery: z.object({
    name: z.string().trim().min(2).max(80),
    phone: z.string().trim().regex(/^(\+?91)?[6-9]\d{9}$/, "Enter a valid 10-digit mobile number"),
    address: z.string().trim().min(10).max(400),
    pincode: z.string().trim().regex(/^6\d{5}$/, "Enter a Tamil Nadu pincode"),
    districtCode: z.string().length(3),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }),
  gstin: z.string().trim().max(15).optional().or(z.literal("")),
  legalName: z.string().trim().max(120).optional().or(z.literal("")),
  plan: z.enum(["full", "advance"]),
  lang: z.enum(["en", "ta"]).default("en"),
  dealerShopId: z.string().uuid().nullish(),
  notes: z.string().max(500).optional(),
});
export type CheckoutInput = z.infer<typeof CheckoutSchema>;

/** Image sources a design may use: files uploaded through our upload API (with their real pixel sizes). */
async function uploadedImages(designs: unknown[]): Promise<Map<string, { w: number; h: number }>> {
  const srcs = new Set<string>();
  for (const d of designs) {
    for (const e of ((d as { elements?: unknown[] })?.elements ?? []) as { type?: string; src?: string }[]) {
      if (e?.type === "image" && typeof e.src === "string" && e.src.startsWith("uploads/")) srcs.add(e.src);
    }
  }
  if (!srcs.size) return new Map();
  const { data } = await supabaseAdmin().from("uploads").select("path, px_width, px_height").in("path", [...srcs]);
  return new Map((data ?? []).map((u) => [u.path as string, { w: u.px_width as number, h: u.px_height as number }]));
}

/** Validates the design server-side: sanitised, real image sizes, and every print check passing. */
export function validateDesign(catalog: Catalog, productId: string, labelSizeId: string, segment: Segment, raw: unknown, images: Map<string, { w: number; h: number }>): Design {
  const product = findProduct(catalog, productId);
  const size = findLabelSize(catalog, labelSizeId);
  if (!product || !size || !product.labelSizeIds.includes(size.id)) throw new HttpError(400, "This label size does not belong to the product");
  const seg: Segment = product.kind === "label_only" ? "label" : segment;
  const design = sanitizeDesign(raw, size, seg, { minTextPt: catalog.settings.minTextPt, allowedImage: (src) => images.has(src) });
  for (const el of design.elements) {
    if (el.type === "image") {
      const real = images.get(el.src)!;
      el.pxWidth = real.w;
      el.pxHeight = real.h;
    }
  }
  const result = runChecks(design, { size, segment: seg, reg: size.hasRegPanel ? regDataFor(catalog, productId) : null, measure: serverMeasure, minTextPt: catalog.settings.minTextPt });
  if (!result.ok) throw new HttpError(400, `Design check failed: ${result.issues.filter((i) => i.level === "error").map((i) => i.en).join(" ")}`);
  return design;
}

async function routeFor(districtCode: string, pincode: string): Promise<string | null> {
  const { data } = await supabaseAdmin().from("routes").select("code, pincodes").eq("district_code", districtCode);
  return (data ?? []).find((r) => (r.pincodes as string[]).includes(pincode))?.code ?? null;
}

/** Creates an order in `pending_payment`. Prices and designs are recomputed and checked on the server. */
export async function createOrder(user: SessionUser, input: CheckoutInput, opts: { dealerId?: string } = {}) {
  const catalog = await getCatalog({ fresh: true });
  if (!catalog.settings.catalogReady) throw new HttpError(503, "Online ordering opens soon. Please call or WhatsApp us to order.");
  const segments = new Set(input.lines.map((l) => (findProduct(catalog, l.productId)?.kind === "label_only" ? "label" : l.segment)));
  const waterSegs = [...segments].filter((s) => s !== "label");
  if (waterSegs.length > 1) throw new HttpError(400, "Please order Event and Shop labels separately.");
  const segment: Segment = (waterSegs[0] as Segment) ?? "label";

  const district = districtByCode(input.delivery.districtCode);
  if (!district) throw new HttpError(400, "Choose a Tamil Nadu district");
  const earliest = earliestDelivery(new Date(), district.zone);
  if (input.delivery.date < earliest) throw new HttpError(400, `The earliest delivery date for ${district.en} is ${earliest}`);

  let buyerState = "33";
  if (input.gstin) {
    if (!isValidGstin(input.gstin)) throw new HttpError(400, "GSTIN is not valid");
    buyerState = gstinState(input.gstin);
  }

  const images = await uploadedImages(input.lines.map((l) => l.design));
  const designs = input.lines.map((l) => validateDesign(catalog, l.productId, l.labelSizeId, l.segment, l.design, images));
  const priced = priceCart(
    catalog,
    input.lines.map((l) => ({ productId: l.productId, segment: l.segment, qty: l.qty })),
    buyerState,
  );
  if (priced.errors.length) throw new HttpError(400, priced.errors.join(" · "));
  const plan: PaymentPlan = input.plan === "advance" && advanceAllowed(catalog, segment, priced.totalPaise) ? "advance" : "full";

  const db = supabaseAdmin();
  const { data: order, error } = await db
    .from("orders")
    .insert({
      customer_id: user.id,
      placed_by_dealer_id: opts.dealerId ?? null,
      shop_id: input.dealerShopId ?? null,
      segment,
      payment_plan: plan,
      taxable_paise: priced.taxablePaise,
      cgst_paise: priced.cgstPaise,
      sgst_paise: priced.sgstPaise,
      igst_paise: priced.igstPaise,
      total_paise: priced.totalPaise,
      delivery_date: input.delivery.date,
      ship_name: input.delivery.name,
      ship_phone: input.delivery.phone.replace(/\D/g, "").slice(-10),
      ship_address: input.delivery.address,
      ship_pincode: input.delivery.pincode,
      district_code: district.code,
      route_code: await routeFor(district.code, input.delivery.pincode),
      buyer_gstin: input.gstin ? input.gstin.toUpperCase() : null,
      buyer_legal_name: input.legalName || null,
      buyer_state_code: buyerState,
      notes: input.notes ?? null,
      lang: input.lang,
    })
    .select("*")
    .single();
  if (error || !order) throw new Error(`Order insert failed: ${error?.message}`);

  const items = priced.lines.map((p, i) => ({
    order_id: order.id,
    product_id: p.productId,
    label_size_id: input.lines[i].labelSizeId,
    design_id: input.lines[i].designId ?? null,
    design: designs[i],
    qty: p.qty,
    items: p.items,
    unit_price_paise: p.unitPricePaise,
    taxable_paise: p.taxablePaise,
    cgst_paise: p.cgstPaise,
    sgst_paise: p.sgstPaise,
    igst_paise: p.igstPaise,
    total_paise: p.totalPaise,
    hsn: p.hsn,
    gst_rate_pct: p.gstRatePct,
  }));
  const { error: itemErr } = await db.from("order_items").insert(items);
  if (itemErr) {
    await db.from("orders").delete().eq("id", order.id);
    throw new Error(`Order items insert failed: ${itemErr.message}`);
  }
  await db.from("order_events").insert({ order_id: order.id, status: "pending_payment", actor_id: user.id });
  return order as OrderRow;
}

export interface OrderRow {
  id: string;
  order_no: string;
  customer_id: string;
  placed_by_dealer_id: string | null;
  segment: Segment;
  status: OrderStatus;
  payment_plan: PaymentPlan;
  total_paise: number;
  taxable_paise: number;
  cgst_paise: number;
  sgst_paise: number;
  igst_paise: number;
  amount_paid_paise: number;
  amount_refunded_paise: number;
  delivery_date: string;
  ship_name: string;
  ship_phone: string;
  ship_address: string;
  ship_pincode: string;
  district_code: string;
  route_code: string | null;
  buyer_gstin: string | null;
  buyer_legal_name: string | null;
  buyer_state_code: string;
  invoice_no: string | null;
  invoice_date: string | null;
  lang: "en" | "ta";
  created_at: string;
}

export async function getOrder(id: string): Promise<OrderRow | null> {
  const { data } = await supabaseAdmin().from("orders").select("*").eq("id", id).maybeSingle();
  return (data as OrderRow) ?? null;
}

async function event(orderId: string, status: OrderStatus, actorId: string | null, note?: string) {
  await supabaseAdmin().from("order_events").insert({ order_id: orderId, status, actor_id: actorId, note: note ?? null });
}

function notify(o: OrderRow, status: OrderStatus) {
  return notifyStatus({ orderId: o.id, orderNo: o.order_no, phone: o.ship_phone, name: o.ship_name, status, lang: o.lang });
}

/**
 * Runs once when an order's first qualifying payment is captured (called from the verified
 * webhook or verified checkout callback): issues the GST invoice number and creates the
 * Print order → Pack order → Load order chain, books dealer commission, and notifies the customer.
 */
export async function onOrderPaid(orderId: string): Promise<void> {
  const db = supabaseAdmin();
  // Only the first caller flips pending_payment → placed; everyone else stops here.
  const { data: flipped } = await db.from("orders").update({ status: "placed" }).eq("id", orderId).eq("status", "pending_payment").select("*");
  const order = flipped?.[0] as OrderRow | undefined;
  if (!order) return;

  const now = new Date();
  const fy = financialYear(now);
  const { data: seq, error: seqErr } = await db.rpc("next_invoice_seq", { p_fy: fy });
  if (seqErr) throw new Error(seqErr.message);
  await db.from("orders").update({ invoice_no: invoiceNumber(now, seq as number), invoice_date: istToday(now) }).eq("id", orderId);

  await db.from("print_orders").upsert({ order_id: orderId }, { onConflict: "order_id", ignoreDuplicates: true });
  await db.from("pack_orders").upsert({ order_id: orderId }, { onConflict: "order_id", ignoreDuplicates: true });
  await db.from("load_orders").upsert({ order_id: orderId }, { onConflict: "order_id", ignoreDuplicates: true });
  await event(orderId, "placed", null, "Payment received");

  if (order.placed_by_dealer_id) {
    const catalog = await getCatalog();
    const { data: dealer } = await db.from("dealers").select("commission_pct").eq("id", order.placed_by_dealer_id).maybeSingle();
    const pct = Number(dealer?.commission_pct ?? catalog.settings.dealerCommissionPct);
    if (pct > 0) {
      await db.from("dealer_ledger").upsert(
        { dealer_id: order.placed_by_dealer_id, kind: "commission", order_id: orderId, amount_paise: Math.round((order.taxable_paise * pct) / 100), note: `${pct}% of taxable value` },
        { onConflict: "kind,order_id", ignoreDuplicates: true },
      );
    }
  }
  await notify(order, "placed");
}

/** Moves an order one step forward with the side effects of that step. */
export async function advanceStatus(orderId: string, to: OrderStatus, actorId: string, note?: string): Promise<OrderRow> {
  const db = supabaseAdmin();
  const order = await getOrder(orderId);
  if (!order) throw new HttpError(404, "Order not found");
  if (!canMoveTo(order.status, to)) throw new HttpError(409, `Cannot move from ${order.status} to ${to}`);

  if (to === "design_approved") {
    await db.from("orders").update({ design_approved_at: new Date().toISOString() }).eq("id", orderId);
  }
  if (to === "printed") {
    await db.from("print_orders").update({ status: "printed", printed_at: new Date().toISOString(), printed_by: actorId }).eq("order_id", orderId);
  }
  if (to === "packed") await createPacks(order, actorId);
  if (to === "loaded") {
    const { data: lo } = await db.from("load_orders").select("trip_id").eq("order_id", orderId).maybeSingle();
    if (!lo?.trip_id) throw new HttpError(409, "Assign the order to a truck trip first");
    const { data: packs } = await db.from("packs").update({ status: "loaded", loaded_at: new Date().toISOString() }).eq("order_id", orderId).select("id");
    await db.from("load_orders").update({ status: "loaded" }).eq("order_id", orderId);
    await db.from("stock_entries").insert((packs ?? []).map((p) => ({ pack_id: p.id, order_id: orderId, movement: "out", ref: `trip ${lo.trip_id}` })));
  }
  if (to === "delivered") {
    await db.from("packs").update({ status: "delivered", delivered_at: new Date().toISOString(), delivered_by: actorId }).eq("order_id", orderId).neq("status", "delivered");
    await db.from("load_orders").update({ status: "delivered" }).eq("order_id", orderId);
  }

  // Conditional update: a concurrent change makes this a no-op instead of skipping a step.
  const { data: updated } = await db.from("orders").update({ status: to }).eq("id", orderId).eq("status", order.status).select("*");
  if (!updated?.length) throw new HttpError(409, "The order changed meanwhile — refresh and try again");
  await event(orderId, to, actorId, note);
  const next = updated[0] as OrderRow;
  if (to !== "cancelled") await notify(next, to);
  return next;
}

/** Packing: one pack per `casesPerPack` cases, each with its HL-… batch pack number, booked into stock. */
async function createPacks(order: OrderRow, actorId: string) {
  const db = supabaseAdmin();
  if (!order.route_code) throw new HttpError(409, "Assign a delivery route to this order before packing");
  const { count } = await db.from("packs").select("id", { count: "exact", head: true }).eq("order_id", order.id);
  if (count) return; // already packed
  const catalog = await getCatalog();
  const { data: items } = await db.from("order_items").select("id, product_id, qty").eq("order_id", order.id);
  const today = new Date();
  const packDate = istToday(today);
  const rows: { pack_no: string; order_id: string; order_item_id: string; cases: number }[] = [];
  for (const item of items ?? []) {
    const product = findProduct(catalog, item.product_id);
    const n = packsFor(product?.unit ?? "case", item.qty, catalog.settings.casesPerPack);
    for (let i = 0; i < n; i++) {
      const { data: batch, error } = await db.rpc("next_pack_batch", { p_district: order.district_code, p_date: packDate, p_route: order.route_code });
      if (error) throw new Error(error.message);
      const cases = product?.unit === "case" ? Math.min(catalog.settings.casesPerPack, item.qty - i * catalog.settings.casesPerPack) : 0;
      rows.push({ pack_no: packNumber(order.district_code, today, order.route_code, batch as number), order_id: order.id, order_item_id: item.id, cases });
    }
  }
  const { data: packs, error } = await db.from("packs").insert(rows).select("id");
  if (error) throw new Error(error.message);
  await db.from("stock_entries").insert((packs ?? []).map((p) => ({ pack_id: p.id, order_id: order.id, movement: "in", ref: "packed" })));
  await db.from("pack_orders").update({ status: "packed", packed_at: today.toISOString(), packed_by: actorId }).eq("order_id", order.id);
}

export { regDataFor };
