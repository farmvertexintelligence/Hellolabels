import { NextResponse } from "next/server";
import { apiUser, handle, HttpError } from "@/lib/server/auth";
import { supabaseAdmin } from "@/lib/supabase/server";
import { DesignBody, cleanDesign } from "@/lib/server/designs";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handle(async (_req: Request, { params }: Ctx) => {
  const user = await apiUser();
  const { id } = await params;
  const { data } = await supabaseAdmin().from("designs").select("*").eq("id", id).eq("owner_id", user.id).maybeSingle();
  if (!data) throw new HttpError(404, "Design not found");
  return NextResponse.json(data);
});

export const PUT = handle(async (req: Request, { params }: Ctx) => {
  const user = await apiUser();
  const { id } = await params;
  const b = DesignBody.parse(await req.json());
  const doc = await cleanDesign(b);
  const { data } = await supabaseAdmin()
    .from("designs")
    .update({ name: b.name, product_id: b.productId, label_size_id: b.labelSizeId, segment: b.segment, doc })
    .eq("id", id)
    .eq("owner_id", user.id)
    .select("id");
  if (!data?.length) throw new HttpError(404, "Design not found");
  return NextResponse.json({ id });
});

export const DELETE = handle(async (_req: Request, { params }: Ctx) => {
  const user = await apiUser();
  const { id } = await params;
  await supabaseAdmin().from("designs").delete().eq("id", id).eq("owner_id", user.id);
  return NextResponse.json({ ok: true });
});
