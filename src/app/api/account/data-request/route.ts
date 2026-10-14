import { NextResponse } from "next/server";
import { z } from "zod";
import { apiUser, handle } from "@/lib/server/auth";
import { rateLimit } from "@/lib/server/rate-limit";
import { supabaseAdmin } from "@/lib/supabase/server";

/** DPDP Act 2023: data principal requests (access, correction, erasure, withdraw consent, grievance). */
export const POST = handle(async (req: Request) => {
  const user = await apiUser();
  await rateLimit("dpdp", 5, 24 * 3600_000, user.id);
  const b = z.object({ kind: z.enum(["access", "correction", "erasure", "grievance", "withdraw_consent"]), details: z.string().max(1000).default("") }).parse(await req.json());
  await supabaseAdmin().from("data_requests").insert({ user_id: user.id, phone: user.phone ?? "", kind: b.kind, details: b.details || null });
  return NextResponse.json({ ok: true });
});
