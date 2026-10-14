import { NextResponse } from "next/server";
import { apiUser, handle, HttpError } from "@/lib/server/auth";
import { DesignBody, cleanDesign } from "@/lib/server/designs";
import { supabaseAdmin } from "@/lib/supabase/server";

export const GET = handle(async () => {
  const user = await apiUser();
  const { data } = await supabaseAdmin().from("designs").select("id, name, product_id, label_size_id, segment, updated_at").eq("owner_id", user.id).order("updated_at", { ascending: false }).limit(100);
  return NextResponse.json({ designs: data ?? [] });
});

export const POST = handle(async (req: Request) => {
  const user = await apiUser();
  const b = DesignBody.parse(await req.json());
  const doc = await cleanDesign(b);
  const { count } = await supabaseAdmin().from("designs").select("id", { count: "exact", head: true }).eq("owner_id", user.id);
  if ((count ?? 0) >= 200) throw new HttpError(409, "You have 200 saved designs. Delete some to save more.");
  const { data, error } = await supabaseAdmin()
    .from("designs")
    .insert({ owner_id: user.id, name: b.name, product_id: b.productId, label_size_id: b.labelSizeId, segment: b.segment, doc })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return NextResponse.json({ id: data.id });
});
