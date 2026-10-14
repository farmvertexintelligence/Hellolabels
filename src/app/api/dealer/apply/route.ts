import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { aadhaarLast4, encryptFile, isValidAadhaar, sniffKycType } from "@/lib/commerce/aadhaar";
import { districtByCode } from "@/lib/districts";
import { env } from "@/lib/env";
import { apiUser, audit, handle, HttpError } from "@/lib/server/auth";
import { rateLimit } from "@/lib/server/rate-limit";
import { putFile } from "@/lib/server/storage";
import { supabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";
const CONSENT_VERSION = "dealer-kyc-2026-10";

const Fields = z.object({
  name: z.string().trim().min(2).max(80),
  age: z.coerce.number().int().min(18).max(100),
  address: z.string().trim().min(10).max(400),
  phone: z.string().trim().regex(/^[6-9]\d{9}$/),
  profession: z.string().trim().min(2).max(80),
  districtCode: z.string().length(3),
  aadhaar: z.string().trim(),
  consent: z.literal("yes"),
});

/** Dealer application. The Aadhaar copy is encrypted here before it is stored (DPDP Act 2023). */
export const POST = handle(async (req: Request) => {
  const user = await apiUser();
  await rateLimit("dealer-apply", 5, 24 * 3600_000, user.id);
  if (!env.aadhaarKey) throw new HttpError(503, "Dealer applications are not open yet.");
  const form = await req.formData();
  const f = Fields.parse(Object.fromEntries([...form.entries()].filter(([, v]) => typeof v === "string")));
  if (!districtByCode(f.districtCode)) throw new HttpError(400, "Choose a district");
  if (!isValidAadhaar(f.aadhaar)) throw new HttpError(400, "Aadhaar number is not valid");
  const file = form.get("kyc");
  if (!(file instanceof File) || file.size === 0) throw new HttpError(400, "Upload your Aadhaar card");
  if (file.size > 5 * 1024 * 1024) throw new HttpError(413, "File must be under 5 MB");
  const buf = Buffer.from(await file.arrayBuffer());
  const mime = sniffKycType(buf);
  if (!mime) throw new HttpError(415, "Upload a JPG, PNG or PDF");

  const db = supabaseAdmin();
  const { data: existing } = await db.from("dealers").select("status").eq("id", user.id).maybeSingle();
  if (existing && existing.status !== "rejected") throw new HttpError(409, "You have already applied");
  const { data: taken } = await db.from("dealers").select("id").eq("district_code", f.districtCode).eq("status", "approved").maybeSingle();
  if (taken) throw new HttpError(409, "This district already has a dealer");

  const path = `kyc/${user.id}/${crypto.randomUUID()}.bin`;
  await putFile("kyc", path, encryptFile(buf, env.aadhaarKey, user.id), "application/octet-stream");
  const row = {
    id: user.id,
    status: "pending",
    full_name: f.name,
    age: f.age,
    address: f.address,
    phone: f.phone,
    profession: f.profession,
    district_code: f.districtCode,
    aadhaar_last4: aadhaarLast4(f.aadhaar),
    kyc_path: path,
    kyc_mime: mime,
    consent_version: CONSENT_VERSION,
    consent_at: new Date().toISOString(),
    rejected_reason: null,
  };
  const { error } = await db.from("dealers").upsert(row);
  if (error) throw new Error(error.message);
  await audit(user.id, "dealer_applied", "dealer", user.id, { district: f.districtCode });
  return NextResponse.json({ ok: true });
});
