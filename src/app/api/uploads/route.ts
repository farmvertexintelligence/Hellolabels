import crypto from "node:crypto";
import { NextResponse } from "next/server";
import sharp, { type Metadata, type Sharp } from "sharp";
import { features } from "@/lib/env";
import { getUser, handle, HttpError } from "@/lib/server/auth";
import { rateLimit } from "@/lib/server/rate-limit";
import { putFile, signedUrl } from "@/lib/server/storage";
import { supabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";
const MAX_BYTES = 15 * 1024 * 1024;

/**
 * Logo/photo upload. The image is decoded and re-encoded with sharp (which also strips EXIF/GPS
 * data and rejects files that are not really images), stored privately, and a small preview is
 * made for fast editing on phones. The original resolution is kept for printing.
 */
export const POST = handle(async (req: Request) => {
  if (!features.serviceRole) throw new HttpError(503, "Uploads need the online store to be configured.");
  const user = await getUser().catch(() => null);
  await rateLimit("upload", 20, 10 * 60_000, user?.id);
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) throw new HttpError(400, "No file");
  if (file.size > MAX_BYTES) throw new HttpError(413, "Image is larger than 15 MB");
  const input = Buffer.from(await file.arrayBuffer());
  let img: Sharp;
  let meta: Metadata;
  try {
    img = sharp(input, { limitInputPixels: 80_000_000 }).rotate(); // apply EXIF orientation
    meta = await img.metadata();
  } catch {
    throw new HttpError(415, "This file is not a supported image (JPG, PNG or WebP)");
  }
  if (!meta.width || !meta.height || !["jpeg", "png", "webp"].includes(meta.format ?? "")) throw new HttpError(415, "Use a JPG, PNG or WebP image");
  const hasAlpha = Boolean(meta.hasAlpha);
  const id = crypto.randomUUID();
  const ext = hasAlpha ? "png" : "jpg";
  const original = hasAlpha ? await img.png({ compressionLevel: 8 }).toBuffer() : await img.jpeg({ quality: 95, mozjpeg: true }).toBuffer();
  const preview = await sharp(original).resize({ width: 1400, height: 1400, fit: "inside", withoutEnlargement: true })[hasAlpha ? "png" : "jpeg"]().toBuffer();
  const o = await sharp(original).metadata();
  const path = `uploads/${id}.${ext}`;
  const previewPath = `previews/${id}.${ext}`;
  await putFile("uploads", path, original, `image/${hasAlpha ? "png" : "jpeg"}`);
  await putFile("uploads", previewPath, preview, `image/${hasAlpha ? "png" : "jpeg"}`);
  await supabaseAdmin().from("uploads").insert({ path, preview_path: previewPath, owner_id: user?.id ?? null, px_width: o.width, px_height: o.height, bytes: original.length, mime: `image/${hasAlpha ? "png" : "jpeg"}` });
  return NextResponse.json({ src: path, url: await signedUrl("uploads", previewPath, 6 * 3600), pxWidth: o.width, pxHeight: o.height });
});
