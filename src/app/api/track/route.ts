import { NextResponse } from "next/server";
import { z } from "zod";
import { features } from "@/lib/env";
import { handle, HttpError } from "@/lib/server/auth";
import { rateLimit } from "@/lib/server/rate-limit";
import { supabaseAdmin } from "@/lib/supabase/server";

/** Public order tracking by order number + last 4 digits of the delivery phone. Shows status only. */
export const POST = handle(async (req: Request) => {
  await rateLimit("track", 20, 10 * 60_000);
  if (!features.serviceRole) throw new HttpError(503, "Tracking is not available yet");
  const { orderNo, phone4 } = z.object({ orderNo: z.string().trim().toUpperCase().max(20), phone4: z.string().regex(/^\d{4}$/) }).parse(await req.json());
  const { data: o } = await supabaseAdmin().from("orders").select("id, order_no, status, delivery_date, ship_phone").eq("order_no", orderNo).maybeSingle();
  if (!o || !o.ship_phone.endsWith(phone4)) throw new HttpError(404, "No order found with these details");
  const { data: events } = await supabaseAdmin().from("order_events").select("status, created_at").eq("order_id", o.id).order("created_at");
  return NextResponse.json({ orderNo: o.order_no, status: o.status, deliveryDate: o.delivery_date, events: events ?? [] });
});
