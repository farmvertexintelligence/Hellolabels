import { NextResponse } from "next/server";
import { apiUser, handle, HttpError } from "@/lib/server/auth";
import { signedUrl } from "@/lib/server/storage";
import { supabaseAdmin } from "@/lib/supabase/server";

export const GET = handle(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  await apiUser(["admin"]);
  const { id } = await params;
  const { data } = await supabaseAdmin().from("ad_bookings").select("creative_path").eq("id", id).maybeSingle();
  if (!data?.creative_path) throw new HttpError(404, "No artwork");
  return NextResponse.redirect(await signedUrl("ad-creatives", data.creative_path, 600));
});
