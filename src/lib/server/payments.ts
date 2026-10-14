import "server-only";
import Razorpay from "razorpay";
import { amountDueNow } from "@/lib/commerce/pricing";
import { verifyCheckoutSignature } from "@/lib/commerce/razorpay-signature";
import { env, features } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase/server";
import { HttpError, audit, type SessionUser } from "./auth";
import { getCatalog } from "./catalog";
import { getOrder, onOrderPaid, type OrderRow } from "./orders";

/*
 * Payment rules:
 *  - amounts always come from the order in the database, never from the browser;
 *  - a payment counts only after the server has verified it with Razorpay (signature check on the
 *    checkout callback + fetching the payment from Razorpay, or a signature-checked webhook);
 *  - every state change is idempotent, so the webhook and the callback can race safely.
 */

let rzp: Razorpay | null = null;
function client(): Razorpay {
  if (!features.payments) throw new HttpError(503, "Online payments are not set up yet");
  rzp ??= new Razorpay({ key_id: env.razorpayKeyId!, key_secret: env.razorpayKeySecret! });
  return rzp;
}

export interface RzpPayment {
  id: string;
  order_id: string;
  amount: number;
  currency: string;
  status: "created" | "authorized" | "captured" | "refunded" | "failed";
  method?: string;
  error_code?: string | null;
  error_description?: string | null;
  amount_refunded?: number;
}

type Purpose = "full" | "advance" | "balance";

/** What can be paid online for this order right now. */
export async function payableNow(order: OrderRow): Promise<{ purpose: Purpose; amountPaise: number } | null> {
  if (order.status === "cancelled") return null;
  if (order.status === "pending_payment") {
    const catalog = await getCatalog();
    const amount = amountDueNow(catalog, order.payment_plan, order.total_paise);
    return { purpose: order.payment_plan === "advance" ? "advance" : "full", amountPaise: amount - order.amount_paid_paise };
  }
  const balance = order.total_paise - order.amount_paid_paise;
  return balance > 0 ? { purpose: "balance", amountPaise: balance } : null;
}

export async function startPayment(orderId: string, user: SessionUser) {
  const order = await getOrder(orderId);
  if (!order) throw new HttpError(404, "Order not found");
  if (order.customer_id !== user.id && order.placed_by_dealer_id !== user.id && user.role !== "admin") throw new HttpError(403, "Not your order");
  const due = await payableNow(order);
  if (!due || due.amountPaise <= 0) throw new HttpError(409, "Nothing to pay on this order");

  const rOrder = await client().orders.create({
    amount: due.amountPaise,
    currency: "INR",
    receipt: `${order.order_no}-${due.purpose}`.slice(0, 40),
    notes: { order_id: order.id, order_no: order.order_no, purpose: due.purpose },
  });
  const { error } = await supabaseAdmin()
    .from("payments")
    .insert({ order_id: order.id, purpose: due.purpose, provider: "razorpay", provider_order_id: rOrder.id, amount_paise: due.amountPaise, status: "created" });
  if (error) throw new Error(error.message);
  return {
    keyId: env.razorpayKeyId!,
    razorpayOrderId: rOrder.id,
    amountPaise: due.amountPaise,
    purpose: due.purpose,
    orderNo: order.order_no,
    prefill: { name: order.ship_name, contact: order.ship_phone },
  };
}

/** Recomputes paid/refunded totals from captured payments and triggers fulfilment once enough is paid. */
async function settleOrder(orderId: string) {
  const db = supabaseAdmin();
  const { data: pays } = await db.from("payments").select("amount_paise, refunded_paise, status").eq("order_id", orderId);
  const paid = (pays ?? []).filter((p) => ["captured", "refunded", "partially_refunded"].includes(p.status)).reduce((a, p) => a + p.amount_paise, 0);
  const refunded = (pays ?? []).reduce((a, p) => a + (p.refunded_paise ?? 0), 0);
  await db.from("orders").update({ amount_paid_paise: paid, amount_refunded_paise: refunded }).eq("id", orderId);
  const order = await getOrder(orderId);
  if (!order || order.status !== "pending_payment") return;
  const catalog = await getCatalog();
  if (paid >= amountDueNow(catalog, order.payment_plan, order.total_paise)) await onOrderPaid(orderId);
}

/** Applies a payment entity that came from Razorpay itself (webhook body or API fetch). */
export async function applyRazorpayPayment(p: RzpPayment): Promise<void> {
  const db = supabaseAdmin();
  const { data: row } = await db.from("payments").select("*").eq("provider_order_id", p.order_id).maybeSingle();
  if (!row) {
    console.warn("Razorpay payment for unknown order", p.order_id);
    return;
  }
  if (p.currency !== "INR" || p.amount !== row.amount_paise) {
    await audit(null, "payment_amount_mismatch", "payment", row.id, { expected: row.amount_paise, got: p.amount, currency: p.currency });
    return;
  }

  let status = p.status;
  if (status === "authorized") {
    // Auto-capture should be on in the Razorpay dashboard; capture here as a safety net.
    const captured = (await client().payments.capture(p.id, p.amount, "INR")) as unknown as RzpPayment;
    status = captured.status;
  }

  if (status === "captured") {
    const { data: changed } = await db
      .from("payments")
      .update({ status: "captured", provider_payment_id: p.id, method: p.method ?? null, captured_at: new Date().toISOString(), raw: p })
      .eq("id", row.id)
      .in("status", ["created", "authorized", "failed"])
      .select("id");
    if (changed?.length) await settleOrder(row.order_id);
  } else if (status === "failed") {
    await db
      .from("payments")
      .update({ status: "failed", provider_payment_id: p.id, error_code: p.error_code ?? null, error_description: p.error_description ?? null, raw: p })
      .eq("id", row.id)
      .eq("status", "created");
  }
}

/** Checkout success callback: verify the signature, then confirm the payment with Razorpay's API. */
export async function confirmCheckout(user: SessionUser, body: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) {
  if (!verifyCheckoutSignature(body.razorpay_order_id, body.razorpay_payment_id, body.razorpay_signature, env.razorpayKeySecret ?? "")) {
    throw new HttpError(400, "Payment signature is not valid");
  }
  const { data: row } = await supabaseAdmin().from("payments").select("order_id").eq("provider_order_id", body.razorpay_order_id).maybeSingle();
  if (!row) throw new HttpError(404, "Payment not found");
  const order = await getOrder(row.order_id);
  if (!order || (order.customer_id !== user.id && order.placed_by_dealer_id !== user.id && user.role !== "admin")) throw new HttpError(403, "Not your order");
  const payment = (await client().payments.fetch(body.razorpay_payment_id)) as unknown as RzpPayment;
  if (payment.order_id !== body.razorpay_order_id) throw new HttpError(400, "Payment does not belong to this order");
  await applyRazorpayPayment(payment);
  return (await getOrder(row.order_id))!;
}

interface RzpRefund {
  id: string;
  payment_id: string;
  amount: number;
  status: "pending" | "processed" | "failed";
  notes?: Record<string, string>;
}

/** Admin refund (full or partial) of one captured Razorpay payment. */
export async function refundPayment(paymentId: string, amountPaise: number, reason: string, admin: SessionUser) {
  const db = supabaseAdmin();
  const { data: pay } = await db.from("payments").select("*").eq("id", paymentId).maybeSingle();
  if (!pay || pay.provider !== "razorpay" || !pay.provider_payment_id) throw new HttpError(404, "Online payment not found");
  if (!["captured", "partially_refunded"].includes(pay.status)) throw new HttpError(409, "Only captured payments can be refunded");
  if (amountPaise <= 0 || amountPaise > pay.amount_paise - pay.refunded_paise) throw new HttpError(400, "Refund amount is more than what is left on this payment");

  const { data: refundRow, error } = await db
    .from("refunds")
    .insert({ payment_id: pay.id, order_id: pay.order_id, amount_paise: amountPaise, reason, created_by: admin.id })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  const refund = (await client().payments.refund(pay.provider_payment_id, { amount: amountPaise, speed: "normal", notes: { refund_row: refundRow.id, reason: reason.slice(0, 200) } })) as unknown as RzpRefund;
  await db.from("refunds").update({ provider_refund_id: refund.id }).eq("id", refundRow.id);
  await audit(admin.id, "refund_requested", "payment", pay.id, { amountPaise, reason });
  await applyRazorpayRefund(refund);
}

/** Refund status from Razorpay (API response or webhook). Updates totals once, when processed. */
export async function applyRazorpayRefund(r: RzpRefund) {
  const db = supabaseAdmin();
  const { data: row } = await db.from("refunds").select("*").eq("provider_refund_id", r.id).maybeSingle();
  if (!row) return;
  if (r.status === "processed") {
    const { data: changed } = await db.from("refunds").update({ status: "processed", processed_at: new Date().toISOString() }).eq("id", row.id).neq("status", "processed").select("id");
    if (!changed?.length) return;
    const { data: done } = await db.from("refunds").select("amount_paise").eq("payment_id", row.payment_id).eq("status", "processed");
    const total = (done ?? []).reduce((a, x) => a + x.amount_paise, 0);
    const { data: pay } = await db.from("payments").select("amount_paise").eq("id", row.payment_id).single();
    await db
      .from("payments")
      .update({ refunded_paise: total, status: total >= pay!.amount_paise ? "refunded" : "partially_refunded" })
      .eq("id", row.payment_id);
    await settleOrder(row.order_id);
  } else if (r.status === "failed") {
    await db.from("refunds").update({ status: "failed" }).eq("id", row.id);
  }
}

/** Balance collected in cash / UPI on delivery by the driver (or entered by an admin). */
export async function recordOfflinePayment(orderId: string, amountPaise: number, method: "cash" | "upi_offline", by: SessionUser) {
  const order = await getOrder(orderId);
  if (!order) throw new HttpError(404, "Order not found");
  const balance = order.total_paise - order.amount_paid_paise;
  if (amountPaise <= 0 || amountPaise > balance) throw new HttpError(400, `Balance due is ₹${(balance / 100).toFixed(2)}`);
  await supabaseAdmin()
    .from("payments")
    .insert({ order_id: orderId, purpose: "balance", provider: method, amount_paise: amountPaise, status: "captured", captured_at: new Date().toISOString(), collected_by: by.id, method });
  await audit(by.id, "offline_payment", "order", orderId, { amountPaise, method });
  await settleOrder(orderId);
}
