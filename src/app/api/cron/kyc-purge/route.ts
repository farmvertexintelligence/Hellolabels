import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { audit } from "@/lib/server/auth";
import { removeFile } from "@/lib/server/storage";
import { supabaseAdmin } from "@/lib/supabase/server";

/**
 * Daily job (vercel.json cron, with CRON_SECRET): deletes dealer KYC files whose retention period
 * has ended (rejected / ended dealerships) — DPDP storage limitation.
 */
export async function GET(req: Request) {
  if (!env.cronSecret || req.headers.get("authorization") !== `Bearer ${env.cronSecret}`) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabaseAdmin().from("dealers").select("id, kyc_path").lte("kyc_purge_after", today).not("kyc_path", "is", null);
  for (const d of data ?? []) {
    await removeFile("kyc", d.kyc_path!);
    await supabaseAdmin().from("dealers").update({ kyc_path: null, kyc_mime: null }).eq("id", d.id);
    await audit(null, "kyc_purged", "dealer", d.id);
  }
  return NextResponse.json({ purged: data?.length ?? 0 });
}
