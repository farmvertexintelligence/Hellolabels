import { NextResponse } from "next/server";
import { z } from "zod";
import { features } from "@/lib/env";
import { handle } from "@/lib/server/auth";
import { signedUrls } from "@/lib/server/storage";
import { supabaseAdmin } from "@/lib/supabase/server";

/** Short-lived preview URLs for uploaded images referenced by a design (paths are unguessable UUIDs). */
export const POST = handle(async (req: Request) => {
  if (!features.serviceRole) return NextResponse.json({ urls: {} });
  const { paths } = z.object({ paths: z.array(z.string().regex(/^uploads\/[0-9a-f-]{36}\.(jpg|png)$/)).max(30) }).parse(await req.json());
  if (!paths.length) return NextResponse.json({ urls: {} });
  const { data } = await supabaseAdmin().from("uploads").select("path, preview_path").in("path", paths);
  const previews = (data ?? []).map((r) => r.preview_path ?? r.path);
  const signed = await signedUrls("uploads", previews, 6 * 3600);
  const urls = Object.fromEntries((data ?? []).map((r) => [r.path, signed[r.preview_path ?? r.path]]).filter(([, u]) => u));
  return NextResponse.json({ urls }, { headers: { "cache-control": "private, max-age=3600" } });
});
