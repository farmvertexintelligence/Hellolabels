import "server-only";
import { parsePackNumber } from "@/lib/commerce/logistics";
import { supabaseAdmin } from "@/lib/supabase/server";
import { HttpError, type SessionUser } from "./auth";
import { advanceStatus, getOrder } from "./orders";

/** The driver's trip that carries this order (admins may act on any). */
async function assertOnMyTrip(orderId: string, user: SessionUser) {
  if (user.role === "admin") return;
  const { data } = await supabaseAdmin().from("load_orders").select("trip_id, trips!inner(driver_id)").eq("order_id", orderId).maybeSingle();
  const driverId = (data?.trips as unknown as { driver_id: string } | null)?.driver_id;
  if (driverId !== user.id) throw new HttpError(403, "This order is not on your truck");
}

/**
 * Scan of a pack QR at the customer's door: marks the pack delivered. When every pack of the
 * order is delivered, the order moves to Delivered (customer gets SMS/WhatsApp).
 */
export async function scanPack(packNo: string, user: SessionUser) {
  if (!parsePackNumber(packNo)) throw new HttpError(400, "Not a hellolabels pack code");
  const db = supabaseAdmin();
  const { data: pack } = await db.from("packs").select("id, order_id, status").eq("pack_no", packNo.trim().toUpperCase()).maybeSingle();
  if (!pack) throw new HttpError(404, "Pack not found");
  await assertOnMyTrip(pack.order_id, user);
  const order = await getOrder(pack.order_id);
  if (!order) throw new HttpError(404, "Order not found");
  if (pack.status !== "delivered") {
    await db.from("packs").update({ status: "delivered", delivered_at: new Date().toISOString(), delivered_by: user.id }).eq("id", pack.id);
  }
  const { data: packs } = await db.from("packs").select("status").eq("order_id", pack.order_id);
  const remaining = (packs ?? []).filter((p) => p.status !== "delivered").length;
  let status = order.status;
  if (remaining === 0 && order.status !== "delivered") {
    if (order.status === "packed") status = (await advanceStatus(order.id, "loaded", user.id, "Loaded (confirmed by delivery scan)")).status;
    status = (await advanceStatus(order.id, "delivered", user.id, `Delivered — scanned by driver`)).status;
  }
  return { orderNo: order.order_no, customer: order.ship_name, remaining, status, balancePaise: order.total_paise - order.amount_paid_paise };
}

export { assertOnMyTrip };
