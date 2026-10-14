import { NextResponse } from "next/server";
import { z } from "zod";
import { apiUser, handle } from "@/lib/server/auth";
import { assertOnMyTrip } from "@/lib/server/driver";
import { recordOfflinePayment } from "@/lib/server/payments";

/** Balance collected at the door (cash or UPI to the company QR). */
export const POST = handle(async (req: Request) => {
  const user = await apiUser(["driver", "admin"]);
  const b = z.object({ orderId: z.string().uuid(), amountPaise: z.number().int().positive(), method: z.enum(["cash", "upi_offline"]) }).parse(await req.json());
  await assertOnMyTrip(b.orderId, user);
  await recordOfflinePayment(b.orderId, b.amountPaise, b.method, user);
  return NextResponse.json({ ok: true });
});
