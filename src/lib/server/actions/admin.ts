"use server";
import crypto from "node:crypto";
import { revalidatePath, revalidateTag } from "next/cache";
import sharp from "sharp";
import { z } from "zod";
import type { BusinessSettings, RegulatoryInfo } from "@/lib/catalog/types";
import { loadPlan, type OrderStatus } from "@/lib/commerce/logistics";
import { districtByCode } from "@/lib/districts";
import { regDataFor } from "@/lib/design/regdata";
import { layoutRegPanel } from "@/lib/design/regpanel";
import { computeZones } from "@/lib/design/zones";
import { serverMeasure } from "@/lib/print/server-fonts";
import { supabaseAdmin } from "@/lib/supabase/server";
import { apiUser, audit, HttpError } from "../auth";
import { CATALOG_TAG, getCatalog } from "../catalog";
import { advanceStatus, getOrder } from "../orders";
import { recordOfflinePayment, refundPayment } from "../payments";
import { generatePrintFiles } from "../print-files";
import { putFile, removeFile } from "../storage";
import { num, paise, run, str, type ActionResult } from "./result";

const admin = () => apiUser(["admin"]);
const db = () => supabaseAdmin();

function catalogChanged() {
  revalidateTag(CATALOG_TAG);
  revalidatePath("/", "layout");
}

/* ───────────── Catalogue ───────────── */

export async function savePrices(_p: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const a = await admin();
    const rows: { product_id: string; segment: string; unit_price_paise: number; is_placeholder: boolean; updated_by: string; updated_at: string }[] = [];
    for (const [k, v] of fd.entries()) {
      const m = k.match(/^price:(.+):(event|shop|label)$/);
      if (!m || typeof v !== "string" || !v.trim()) continue;
      const p = Math.round(Number(v.replace(/[₹,\s]/g, "")) * 100);
      if (!Number.isFinite(p) || p <= 0) throw new HttpError(400, `Bad price for ${m[1]} (${m[2]})`);
      rows.push({ product_id: m[1], segment: m[2], unit_price_paise: p, is_placeholder: false, updated_by: a.id, updated_at: new Date().toISOString() });
    }
    const { error } = await db().from("prices").upsert(rows);
    if (error) throw new Error(error.message);
    await audit(a.id, "prices_saved", "prices", null, { count: rows.length });
    catalogChanged();
    return `Saved ${rows.length} prices`;
  });
}

export async function saveProduct(_p: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const a = await admin();
    const id = str(fd, "id");
    const mrp = str(fd, "mrp");
    const patch = {
      min_qty: num(fd, "minQty"),
      qty_step: num(fd, "qtyStep") || 1,
      mrp_paise: mrp ? paise(fd, "mrp") : null,
      hsn: str(fd, "hsn"),
      gst_rate_pct: num(fd, "gst"),
      active: fd.get("active") === "on",
      updated_at: new Date().toISOString(),
    };
    z.object({ min_qty: z.number().int().positive(), qty_step: z.number().int().positive(), hsn: z.string().regex(/^\d{4,8}$/), gst_rate_pct: z.number().min(0).max(28) }).parse(patch);
    const { error } = await db().from("products").update(patch).eq("id", id);
    if (error) throw new Error(error.message);
    await audit(a.id, "product_saved", "product", id, patch);
    catalogChanged();
    return "Saved";
  });
}

export async function saveLabelSize(_p: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const a = await admin();
    const id = str(fd, "id");
    const catalog = await getCatalog({ fresh: true });
    const current = catalog.labelSizes.find((x) => x.id === id);
    if (!current) throw new HttpError(404, "Label size not found");
    const patch = {
      width_mm: num(fd, "width"),
      height_mm: num(fd, "height"),
      diameter_mm: str(fd, "diameter") ? num(fd, "diameter") : null,
      has_reg_panel: fd.get("hasRegPanel") === "on",
      is_placeholder: false,
      updated_at: new Date().toISOString(),
    };
    z.object({ width_mm: z.number().min(15).max(215), height_mm: z.number().min(15).max(499) }).parse(patch);
    if (patch.height_mm < patch.width_mm) throw new HttpError(400, "Labels are vertical rectangles: height must be at least the width");
    // The square design, the 20% shop ad strip and the regulatory panel must all fit at a readable size.
    if (patch.has_reg_panel) {
      const size = { ...current, widthMm: patch.width_mm, heightMm: patch.height_mm, hasRegPanel: true, wraps: false };
      const product = catalog.products.find((p) => p.labelSizeIds.includes(id));
      const reg = regDataFor(catalog, product?.id ?? "water-500-plastic");
      const zones = computeZones(size, "shop");
      if (!zones.regPanel || layoutRegPanel(zones.regPanel, reg!, serverMeasure, catalog.settings.minTextPt, false).overflow) {
        let need = patch.height_mm;
        while (need < 499) {
          need += 5;
          const zz = computeZones({ ...size, heightMm: need }, "shop");
          if (zz.regPanel && !layoutRegPanel(zz.regPanel, reg!, serverMeasure, catalog.settings.minTextPt, false).overflow) break;
        }
        throw new HttpError(400, `Too short for the square design + 20% ad strip + regulatory panel at ${catalog.settings.minTextPt} pt. At ${patch.width_mm} mm wide the label needs about ${need} mm height.`);
      }
    }
    const { error } = await db().from("label_sizes").update(patch).eq("id", id);
    if (error) throw new Error(error.message);
    await audit(a.id, "label_size_saved", "label_size", id, patch);
    catalogChanged();
    return "Saved — new designs use this size";
  });
}

export async function saveRegulatory(_p: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const a = await admin();
    const value: RegulatoryInfo = {
      packagerName: str(fd, "packagerName"),
      packagerAddress: str(fd, "packagerAddress"),
      fssaiLicence: str(fd, "fssaiLicence"),
      bisLicence: str(fd, "bisLicence"),
      isStandard: str(fd, "isStandard") || "IS 14543",
      shelfLifeDays: num(fd, "shelfLifeDays"),
      customerCare: str(fd, "customerCare"),
    };
    if (!/^\d{14}$/.test(value.fssaiLicence)) throw new HttpError(400, "FSSAI licence numbers have 14 digits");
    if (!value.packagerName || value.packagerAddress.length < 10) throw new HttpError(400, "Enter the packager name and full address");
    await db().from("app_settings").upsert({ key: "regulatory", value, updated_by: a.id, updated_at: new Date().toISOString() });
    await audit(a.id, "regulatory_saved", "settings", "regulatory", value as unknown as Record<string, unknown>);
    catalogChanged();
    return "Saved — printed on every new water label";
  });
}

export async function saveBusiness(_p: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const a = await admin();
    const current = (await getCatalog({ fresh: true })).settings;
    const value: BusinessSettings = {
      ...current,
      legalName: str(fd, "legalName"),
      gstin: str(fd, "gstin").toUpperCase(),
      address: str(fd, "address"),
      whatsappNumber: str(fd, "whatsappNumber"),
      pricesIncludeGst: fd.get("pricesIncludeGst") === "on",
      dealerCommissionPct: num(fd, "dealerCommissionPct"),
      dealerAdSharePct: num(fd, "dealerAdSharePct"),
      advancePct: num(fd, "advancePct"),
      advanceMinOrderPaise: paise(fd, "advanceMinOrder"),
      minTextPt: num(fd, "minTextPt"),
      casesPerPack: num(fd, "casesPerPack"),
      spoilagePct: num(fd, "spoilagePct"),
      catalogReady: fd.get("catalogReady") === "on",
    };
    z.object({ dealerCommissionPct: z.number().min(0).max(50), dealerAdSharePct: z.number().min(0).max(100), advancePct: z.number().min(0).max(100), minTextPt: z.number().min(4).max(12), casesPerPack: z.number().int().min(1).max(50), spoilagePct: z.number().min(0).max(20) }).parse(value);
    if (value.catalogReady) {
      const c = await getCatalog({ fresh: true });
      const missing = [...c.prices.filter((p) => p.isPlaceholder).map((p) => `price ${p.productId}/${p.segment}`), ...c.labelSizes.filter((s) => s.isPlaceholder && c.products.some((p) => p.active && p.labelSizeIds.includes(s.id))).map((s) => `size ${s.id}`), ...c.products.filter((p) => p.active && p.kind === "water_bottle" && !p.mrpPaise).map((p) => `MRP ${p.id}`)];
      if (c.regulatory.fssaiLicence.includes("[")) missing.push("FSSAI licence");
      if (missing.length) throw new HttpError(400, `Cannot open ordering yet. Still placeholder: ${missing.slice(0, 8).join(", ")}${missing.length > 8 ? "…" : ""}`);
    }
    await db().from("app_settings").upsert({ key: "business", value, updated_by: a.id, updated_at: new Date().toISOString() });
    await audit(a.id, "business_saved", "settings", "business", value as unknown as Record<string, unknown>);
    catalogChanged();
    return "Saved";
  });
}

export async function saveRoute(_p: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    await admin();
    const district = str(fd, "district").toUpperCase();
    const code = str(fd, "code").toUpperCase();
    if (!districtByCode(district) || !/^R\d{1,2}$/.test(code)) throw new HttpError(400, "District code (e.g. SLM) and route code (R1–R99) needed");
    const split = (k: string) => str(fd, k).split(/[,\n]/).map((x) => x.trim()).filter(Boolean);
    await db().from("routes").upsert({ district_code: district, code, name: str(fd, "name") || code, pincodes: split("pincodes"), stops: split("stops") });
    revalidatePath("/admin/routes");
    return "Route saved";
  });
}

/* ───────────── Orders ───────────── */

export async function setOrderStatus(_p: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const a = await admin();
    const id = str(fd, "orderId");
    const to = str(fd, "to") as OrderStatus;
    if (to === "design_approved") await advanceStatus(id, to, a.id, str(fd, "note") || undefined).then(() => generatePrintFiles(id));
    else await advanceStatus(id, to, a.id, str(fd, "note") || undefined);
    revalidatePath(`/admin/orders/${id}`);
    revalidatePath("/admin/orders");
    return to === "design_approved" ? "Design approved — print files generated" : `Moved to ${to}`;
  });
}

export async function regeneratePrintFiles(_p: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    await admin();
    const id = str(fd, "orderId");
    const r = await generatePrintFiles(id);
    revalidatePath(`/admin/orders/${id}`);
    return `Print files ready (${r.map((x) => `${x.labels} labels, ${x.imposition.across} across on ${x.imposition.rollWidthMm} mm`).join("; ")})`;
  });
}

export async function setOrderRoute(_p: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    await admin();
    const id = str(fd, "orderId");
    const route = str(fd, "route").toUpperCase();
    if (!/^R\d{1,2}$/.test(route)) throw new HttpError(400, "Route like R1, R2…");
    const o = await getOrder(id);
    if (!o) throw new HttpError(404, "Order not found");
    if (["packed", "loaded", "delivered"].includes(o.status)) throw new HttpError(409, "Packs are already numbered with the old route");
    await db().from("orders").update({ route_code: route }).eq("id", id);
    revalidatePath(`/admin/orders/${id}`);
    return "Route set";
  });
}

export async function recordPayment(_p: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const a = await admin();
    const id = str(fd, "orderId");
    await recordOfflinePayment(id, paise(fd, "amount"), str(fd, "method") === "upi_offline" ? "upi_offline" : "cash", a);
    revalidatePath(`/admin/orders/${id}`);
    return "Payment recorded";
  });
}

export async function refund(_p: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const a = await admin();
    const reason = str(fd, "reason");
    if (reason.length < 3) throw new HttpError(400, "Give a reason");
    await refundPayment(str(fd, "paymentId"), paise(fd, "amount"), reason, a);
    revalidatePath(`/admin/orders/${str(fd, "orderId")}`);
    return "Refund requested — status updates when Razorpay confirms";
  });
}

/* ───────────── Dealers & users ───────────── */

export async function dealerDecision(_p: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const a = await admin();
    const id = str(fd, "dealerId");
    const action = str(fd, "action");
    const d = (await db().from("dealers").select("*").eq("id", id).single()).data;
    if (!d) throw new HttpError(404, "Dealer not found");
    if (action === "approve") {
      const { error } = await db().from("dealers").update({ status: "approved", approved_at: new Date().toISOString(), approved_by: a.id, rejected_reason: null, kyc_purge_after: null }).eq("id", id);
      if (error) throw new HttpError(409, error.message.includes("one_per_district") ? "This district already has an approved dealer" : error.message);
      await db().from("profiles").update({ role: "dealer", district_code: d.district_code }).eq("id", id);
    } else if (action === "reject" || action === "suspend") {
      const purge = new Date(Date.now() + 90 * 86400_000).toISOString().slice(0, 10);
      await db().from("dealers").update({ status: action === "reject" ? "rejected" : "suspended", rejected_reason: str(fd, "reason") || null, kyc_purge_after: purge }).eq("id", id);
      await db().from("profiles").update({ role: "customer" }).eq("id", id).eq("role", "dealer");
    } else if (action === "terms") {
      const c = str(fd, "commissionPct");
      const s = str(fd, "adSharePct");
      await db().from("dealers").update({ commission_pct: c === "" ? null : Number(c), ad_share_pct: s === "" ? null : Number(s) }).eq("id", id);
    } else if (action === "payout") {
      const amount = paise(fd, "amount");
      if (!(amount > 0)) throw new HttpError(400, "Enter the amount paid");
      await db().from("dealer_ledger").insert({ dealer_id: id, kind: "payout", amount_paise: -amount, note: str(fd, "note") || "Payout" });
    } else throw new HttpError(400, "Unknown action");
    await audit(a.id, `dealer_${action}`, "dealer", id);
    revalidatePath("/admin/dealers");
    return "Done";
  });
}

export async function setUserRole(_p: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const a = await admin();
    const phone = str(fd, "phone").replace(/\D/g, "").slice(-10);
    const role = z.enum(["customer", "driver", "admin"]).parse(str(fd, "role"));
    const { data } = await db().from("profiles").select("id, role").like("phone", `%${phone}`).maybeSingle();
    if (!data) throw new HttpError(404, "No account with this phone — ask them to sign in once first");
    if (data.id === a.id && role !== "admin") throw new HttpError(400, "You cannot remove your own admin role");
    if (data.role === "dealer") throw new HttpError(400, "Change dealers from the Dealers page");
    await db().from("profiles").update({ role }).eq("id", data.id);
    await audit(a.id, "role_set", "profile", data.id, { role });
    revalidatePath("/admin/customers");
    return `Role set to ${role}`;
  });
}

/* ───────────── Trucks, trips & loading ───────────── */

export async function saveTruck(_p: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    await admin();
    const reg = str(fd, "regNo").toUpperCase();
    if (reg.length < 6) throw new HttpError(400, "Enter the registration number");
    await db().from("trucks").upsert({ reg_no: reg, name: str(fd, "name") || null, capacity_cases: num(fd, "capacity") || 200, active: true }, { onConflict: "reg_no" });
    revalidatePath("/admin/trips");
    return "Truck saved";
  });
}

/** Creates a trip for a route and date with the chosen orders as stops, in the order given. */
export async function createTrip(_p: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    await admin();
    const orderIds = fd.getAll("orderId").map(String);
    if (!orderIds.length) throw new HttpError(400, "Tick at least one order");
    const district = str(fd, "district");
    const route = str(fd, "route");
    const { data: trip, error } = await db()
      .from("trips")
      .insert({ trip_date: str(fd, "date"), district_code: district, route_code: route, truck_id: str(fd, "truckId"), driver_id: str(fd, "driverId") })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    const plan = loadPlan(orderIds.map((id, i) => ({ orderId: id, stopSeq: i + 1, packs: [] })));
    for (const step of plan) {
      await db().from("load_orders").update({ trip_id: trip.id, stop_seq: step.stopSeq, load_seq: step.loadSeq, status: "assigned" }).eq("order_id", step.orderId);
    }
    revalidatePath("/admin/trips");
    return "Trip created";
  });
}

/** Re-orders stops (1 = first delivery). Load order is recomputed: last stop is loaded first. */
export async function reorderStops(_p: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    await admin();
    const tripId = str(fd, "tripId");
    const stops = fd
      .getAll("orderId")
      .map(String)
      .map((orderId) => ({ orderId, stopSeq: Number(fd.get(`stop:${orderId}`)), packs: [] as string[] }));
    const plan = loadPlan(stops);
    for (const s of plan) await db().from("load_orders").update({ stop_seq: s.stopSeq, load_seq: s.loadSeq }).eq("order_id", s.orderId).eq("trip_id", tripId);
    revalidatePath(`/admin/trips/${tripId}`);
    return "Stops updated";
  });
}

export async function removeFromTrip(_p: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    await admin();
    await db().from("load_orders").update({ trip_id: null, stop_seq: null, load_seq: null, status: "unassigned" }).eq("order_id", str(fd, "orderId")).neq("status", "loaded");
    revalidatePath(`/admin/trips/${str(fd, "tripId")}`);
    return "Removed";
  });
}

/** Marks every packed order on the trip as Loaded on truck (customers are notified). */
export async function markTripLoaded(_p: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const a = await admin();
    const tripId = str(fd, "tripId");
    const { data: los } = await db().from("load_orders").select("order_id, orders(status)").eq("trip_id", tripId);
    let n = 0;
    for (const lo of los ?? []) {
      if ((lo.orders as unknown as { status: string }).status === "packed") {
        await advanceStatus(lo.order_id, "loaded", a.id);
        n++;
      }
    }
    await db().from("trips").update({ status: "out" }).eq("id", tripId);
    revalidatePath(`/admin/trips/${tripId}`);
    return `${n} order(s) loaded`;
  });
}

/* ───────────── Ads ───────────── */

export async function createAd(_p: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const a = await admin();
    const district = str(fd, "district").toUpperCase();
    if (!districtByCode(district)) throw new HttpError(400, "Choose a district");
    const { data: adv, error } = await db().from("advertisers").insert({ name: str(fd, "advertiser"), business: str(fd, "business") || null, phone: str(fd, "phone"), created_by: a.id }).select("id").single();
    if (error) throw new Error(error.message);
    const creative = await saveCreative(fd, district);
    const { data: dealer } = await db().from("dealers").select("id").eq("district_code", district).eq("status", "approved").maybeSingle();
    await db().from("ad_bookings").insert({ district_code: district, advertiser_id: adv.id, dealer_id: dealer?.id ?? null, start_date: str(fd, "start"), end_date: str(fd, "end"), amount_paise: paise(fd, "amount"), creative_path: creative, created_by: a.id });
    revalidatePath("/admin/ads");
    return "Booking created (pending)";
  });
}

async function saveCreative(fd: FormData, district: string): Promise<string | null> {
  const file = fd.get("creative");
  if (!(file instanceof File) || file.size === 0) return null;
  if (file.size > 10 * 1024 * 1024) throw new HttpError(413, "Creative must be under 10 MB");
  const img = await sharp(Buffer.from(await file.arrayBuffer())).rotate().flatten({ background: "#ffffff" }).jpeg({ quality: 92 }).toBuffer();
  const path = `ads/${district}/${crypto.randomUUID()}.jpg`;
  await putFile("ad-creatives", path, img, "image/jpeg");
  return path;
}

export async function adDecision(_p: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const a = await admin();
    const id = str(fd, "adId");
    const action = str(fd, "action");
    const { data: ad } = await db().from("ad_bookings").select("*").eq("id", id).single();
    if (!ad) throw new HttpError(404, "Booking not found");
    if (action === "creative") {
      const path = await saveCreative(fd, ad.district_code);
      if (!path) throw new HttpError(400, "Choose an image");
      if (ad.creative_path) await removeFile("ad-creatives", ad.creative_path);
      await db().from("ad_bookings").update({ creative_path: path }).eq("id", id);
    } else if (action === "approve") {
      if (!ad.creative_path) throw new HttpError(400, "Upload the ad artwork first");
      const { error } = await db().from("ad_bookings").update({ status: "approved" }).eq("id", id);
      if (error) throw new HttpError(409, "Another ad is already booked in this district for those dates");
    } else if (action === "reject" || action === "cancel") {
      await db().from("ad_bookings").update({ status: action === "reject" ? "rejected" : "cancelled" }).eq("id", id);
    } else if (action === "paid") {
      await db().from("ad_bookings").update({ paid: true }).eq("id", id);
      const dealerId = ad.dealer_id ?? (await db().from("dealers").select("id").eq("district_code", ad.district_code).eq("status", "approved").maybeSingle()).data?.id;
      if (dealerId) {
        const c = await getCatalog();
        const { data: d } = await db().from("dealers").select("ad_share_pct").eq("id", dealerId).single();
        const pct = Number(d?.ad_share_pct ?? c.settings.dealerAdSharePct);
        if (pct > 0) await db().from("dealer_ledger").upsert({ dealer_id: dealerId, kind: "ad_share", ad_booking_id: id, amount_paise: Math.round((ad.amount_paise * pct) / 100), note: `${pct}% of ad booking` }, { onConflict: "kind,ad_booking_id", ignoreDuplicates: true });
      }
    } else throw new HttpError(400, "Unknown action");
    await audit(a.id, `ad_${action}`, "ad_booking", id);
    revalidatePath("/admin/ads");
    return "Done";
  });
}

export async function resolveDataRequest(_p: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const a = await admin();
    await db().from("data_requests").update({ status: str(fd, "status") === "rejected" ? "rejected" : "done", resolved_at: new Date().toISOString() }).eq("id", str(fd, "id"));
    await audit(a.id, "data_request_resolved", "data_request", str(fd, "id"));
    revalidatePath("/admin");
    return "Updated";
  });
}
