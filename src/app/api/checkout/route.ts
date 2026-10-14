import { NextResponse } from "next/server";
import { features } from "@/lib/env";
import { apiUser, handle, HttpError } from "@/lib/server/auth";
import { CheckoutSchema, createOrder } from "@/lib/server/orders";
import { startPayment } from "@/lib/server/payments";
import { rateLimit } from "@/lib/server/rate-limit";
import { supabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Creates the order from the cart (re-priced and re-checked on the server) and a Razorpay order for it. */
export const POST = handle(async (req: Request) => {
  if (!features.payments) throw new HttpError(503, "Online payments are not set up yet. Please call or WhatsApp us to order.");
  const user = await apiUser();
  await rateLimit("checkout", 10, 10 * 60_000, user.id);
  const input = CheckoutSchema.parse(await req.json());
  let dealerId: string | undefined;
  if (input.dealerShopId) {
    // Dealers order on behalf of their own shops only.
    if (user.role !== "dealer") throw new HttpError(403, "Only dealers can order for a shop");
    const { data: shop } = await supabaseAdmin().from("dealer_shops").select("id").eq("id", input.dealerShopId).eq("dealer_id", user.id).maybeSingle();
    if (!shop) throw new HttpError(403, "This shop is not in your list");
    const { data: dealer } = await supabaseAdmin().from("dealers").select("status").eq("id", user.id).maybeSingle();
    if (dealer?.status !== "approved") throw new HttpError(403, "Your dealer account is not approved yet");
    dealerId = user.id;
  }
  const order = await createOrder(user, input, { dealerId });
  const payment = await startPayment(order.id, user);
  return NextResponse.json({ orderId: order.id, orderNo: order.order_no, payment });
});
