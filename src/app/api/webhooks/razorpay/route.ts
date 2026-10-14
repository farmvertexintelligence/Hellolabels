import { NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/lib/commerce/razorpay-signature";
import { env, features } from "@/lib/env";
import { applyRazorpayPayment, applyRazorpayRefund, type RzpPayment } from "@/lib/server/payments";
import { supabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * Razorpay webhook (Dashboard → Webhooks → https://<site>/api/webhooks/razorpay) with events:
 * payment.authorized, payment.captured, payment.failed, order.paid, refund.processed, refund.failed.
 * The raw body is verified with RAZORPAY_WEBHOOK_SECRET; each event id is processed once.
 */
export async function POST(req: Request) {
  if (!features.payments) return NextResponse.json({ error: "payments not configured" }, { status: 503 });
  const raw = await req.text();
  if (!verifyWebhookSignature(raw, req.headers.get("x-razorpay-signature"), env.razorpayWebhookSecret!)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }
  const body = JSON.parse(raw) as { event: string; payload: { payment?: { entity: RzpPayment }; refund?: { entity: Parameters<typeof applyRazorpayRefund>[0] } } };
  const eventId = req.headers.get("x-razorpay-event-id") ?? `${body.event}:${body.payload.payment?.entity.id ?? body.payload.refund?.entity.id}:${body.payload.payment?.entity.status ?? body.payload.refund?.entity.status}`;
  const db = supabaseAdmin();

  const { error: dup } = await db.from("webhook_events").insert({ id: eventId, event: body.event, payload: body });
  if (dup) {
    // Already seen: succeed if it was processed, otherwise let it run again (a previous attempt failed).
    const { data } = await db.from("webhook_events").select("processed_at").eq("id", eventId).maybeSingle();
    if (data?.processed_at) return NextResponse.json({ ok: true, duplicate: true });
  }
  try {
    if (body.payload.payment && ["payment.authorized", "payment.captured", "payment.failed", "order.paid"].includes(body.event)) {
      await applyRazorpayPayment(body.payload.payment.entity);
    }
    if (body.payload.refund && body.event.startsWith("refund.")) {
      await applyRazorpayRefund(body.payload.refund.entity);
    }
    await db.from("webhook_events").update({ processed_at: new Date().toISOString(), error: null }).eq("id", eventId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("webhook failed", e);
    await db.from("webhook_events").update({ error: String(e) }).eq("id", eventId);
    // 500 → Razorpay retries the delivery.
    return NextResponse.json({ error: "processing failed" }, { status: 500 });
  }
}
