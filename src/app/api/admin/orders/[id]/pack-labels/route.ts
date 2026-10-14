import { NextResponse } from "next/server";
import { apiUser, handle } from "@/lib/server/auth";
import { packLabelsPdf } from "@/lib/server/print-files";

export const runtime = "nodejs";

export const GET = handle(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  await apiUser(["admin"]);
  const { id } = await params;
  const pdf = await packLabelsPdf(id);
  return new NextResponse(new Uint8Array(pdf), { headers: { "content-type": "application/pdf", "content-disposition": `inline; filename="packs-${id}.pdf"` } });
});
