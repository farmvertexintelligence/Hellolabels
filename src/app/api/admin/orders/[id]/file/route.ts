import { NextResponse } from "next/server";
import { apiUser, handle, HttpError } from "@/lib/server/auth";
import { signedUrl } from "@/lib/server/storage";
import { supabaseAdmin } from "@/lib/supabase/server";

export const GET = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  await apiUser(["admin"]);
  const { id } = await params;
  const u = new URL(req.url);
  const { data } = await supabaseAdmin().from("order_items").select("proof_pdf_path, roll_pdf_path").eq("id", u.searchParams.get("item") ?? "").eq("order_id", id).maybeSingle();
  const path = u.searchParams.get("kind") === "roll" ? data?.roll_pdf_path : data?.proof_pdf_path;
  if (!path) throw new HttpError(404, "File not generated yet");
  return NextResponse.redirect(await signedUrl("print-files", path, 600));
});
