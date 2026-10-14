import { NextResponse } from "next/server";
import { z } from "zod";
import { apiUser, handle } from "@/lib/server/auth";
import { confirmCheckout } from "@/lib/server/payments";

/**
 * Called by the browser after Razorpay Checkout succeeds. We do NOT trust it: the signature is
 * verified with our key secret and the payment is fetched from Razorpay before anything changes.
 * The webhook does the same independently, so a closed tab never loses a payment.
 */
export const POST = handle(async (req: Request) => {
  const user = await apiUser();
  const body = z
    .object({ razorpay_order_id: z.string().min(5).max(64), razorpay_payment_id: z.string().min(5).max(64), razorpay_signature: z.string().length(64) })
    .parse(await req.json());
  const order = await confirmCheckout(user, body);
  return NextResponse.json({ orderId: order.id, status: order.status });
});
