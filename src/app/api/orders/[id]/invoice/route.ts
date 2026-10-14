import { NextResponse } from "next/server";
import { apiUser, handle, HttpError } from "@/lib/server/auth";
import { getOrder } from "@/lib/server/orders";
import { invoicePdf } from "@/lib/server/print-files";

export const runtime = "nodejs";

export const GET = handle(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await apiUser();
  const { id } = await params;
  const order = await getOrder(id);
  if (!order) throw new HttpError(404, "Order not found");
  if (order.customer_id !== user.id && order.placed_by_dealer_id !== user.id && user.role !== "admin") throw new HttpError(403, "Not your order");
  const pdf = await invoicePdf(id);
  return new NextResponse(new Uint8Array(pdf), {
    headers: { "content-type": "application/pdf", "content-disposition": `inline; filename="${order.invoice_no!.replace(/\//g, "-")}.pdf"`, "cache-control": "private, no-store" },
  });
});
