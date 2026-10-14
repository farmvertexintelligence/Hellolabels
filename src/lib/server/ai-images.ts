import "server-only";
import sharp from "sharp";
import { features } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase/server";
import type { AiImage } from "./ai-designer";
import { getFile } from "./storage";

/** Loads uploaded images as small JPEGs for the AI to look at (max 3). */
export async function loadAiImages(srcs: string[]): Promise<AiImage[]> {
  if (!features.serviceRole || !srcs.length) return [];
  const { data } = await supabaseAdmin().from("uploads").select("path, preview_path, px_width, px_height").in("path", srcs.slice(0, 3));
  return Promise.all(
    (data ?? []).map(async (u) => {
      const buf = await getFile("uploads", u.preview_path ?? u.path);
      const small = await sharp(buf).flatten({ background: "#ffffff" }).resize({ width: 768, height: 768, fit: "inside" }).jpeg({ quality: 80 }).toBuffer();
      return { src: u.path, pxWidth: u.px_width, pxHeight: u.px_height, previewBase64: small.toString("base64") };
    }),
  );
}
