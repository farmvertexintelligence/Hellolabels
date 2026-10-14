import { NextResponse } from "next/server";
import { z } from "zod";
import { isValidGstin } from "@/lib/commerce/gst";
import { apiUser, handle, HttpError } from "@/lib/server/auth";
import { supabaseAdmin } from "@/lib/supabase/server";

export const PUT = handle(async (req: Request) => {
  const user = await apiUser();
  const b = z.object({ name: z.string().trim().max(80), gstin: z.string().trim().toUpperCase().max(15) }).parse(await req.json());
  if (b.gstin && !isValidGstin(b.gstin)) throw new HttpError(400, "GSTIN is not valid");
  await supabaseAdmin().from("profiles").update({ full_name: b.name || null, gstin: b.gstin || null }).eq("id", user.id);
  return NextResponse.json({ ok: true });
});
