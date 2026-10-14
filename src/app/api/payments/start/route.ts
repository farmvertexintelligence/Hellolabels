import { NextResponse } from "next/server";
import { z } from "zod";
import { apiUser, handle } from "@/lib/server/auth";
import { startPayment } from "@/lib/server/payments";

/** Retry a failed payment, or pay the balance of an advance order online. */
export const POST = handle(async (req: Request) => {
  const user = await apiUser();
  const { orderId } = z.object({ orderId: z.string().uuid() }).parse(await req.json());
  return NextResponse.json(await startPayment(orderId, user));
});
