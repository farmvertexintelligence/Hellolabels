import { NextResponse } from "next/server";
import { decryptFile } from "@/lib/commerce/aadhaar";
import { env } from "@/lib/env";
import { apiUser, audit, handle, HttpError } from "@/lib/server/auth";
import { getFile } from "@/lib/server/storage";
import { supabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";

/** Admin-only view of a dealer's Aadhaar copy. Decrypted in memory, never cached, every view audited. */
export const GET = handle(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const admin = await apiUser(["admin"]);
  const { id } = await params;
  if (!env.aadhaarKey) throw new HttpError(503, "AADHAAR_ENCRYPTION_KEY is not set");
  const { data: d } = await supabaseAdmin().from("dealers").select("kyc_path, kyc_mime").eq("id", id).maybeSingle();
  if (!d?.kyc_path) throw new HttpError(404, "No KYC file (it may have been deleted under the retention policy)");
  const plain = decryptFile(await getFile("kyc", d.kyc_path), env.aadhaarKey, id);
  await audit(admin.id, "kyc_viewed", "dealer", id);
  return new NextResponse(new Uint8Array(plain), {
    headers: {
      "content-type": d.kyc_mime ?? "application/octet-stream",
      "content-disposition": "inline",
      "cache-control": "no-store, max-age=0",
      "x-robots-tag": "noindex",
      "content-security-policy": "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; plugin-types application/pdf",
    },
  });
});
