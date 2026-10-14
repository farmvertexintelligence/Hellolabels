import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";

export type Bucket = "uploads" | "print-files" | "invoices" | "ad-creatives" | "kyc";

export async function putFile(bucket: Bucket, path: string, data: Buffer | Uint8Array, contentType: string) {
  const { error } = await supabaseAdmin().storage.from(bucket).upload(path, data, { contentType, upsert: true, cacheControl: "31536000" });
  if (error) throw new Error(`Upload to ${bucket}/${path} failed: ${error.message}`);
}

export async function getFile(bucket: Bucket, path: string): Promise<Buffer> {
  const { data, error } = await supabaseAdmin().storage.from(bucket).download(path);
  if (error || !data) throw new Error(`Download ${bucket}/${path} failed: ${error?.message}`);
  return Buffer.from(await data.arrayBuffer());
}

export async function signedUrl(bucket: Bucket, path: string, seconds = 3600, download?: string): Promise<string> {
  const { data, error } = await supabaseAdmin().storage.from(bucket).createSignedUrl(path, seconds, download ? { download } : undefined);
  if (error || !data) throw new Error(`Signing ${bucket}/${path} failed: ${error?.message}`);
  return data.signedUrl;
}

export async function signedUrls(bucket: Bucket, paths: string[], seconds = 3600): Promise<Record<string, string>> {
  if (!paths.length) return {};
  const { data, error } = await supabaseAdmin().storage.from(bucket).createSignedUrls(paths, seconds);
  if (error || !data) throw new Error(`Signing failed: ${error?.message}`);
  return Object.fromEntries(data.filter((d) => d.signedUrl && d.path).map((d) => [d.path!, d.signedUrl as string]));
}

export async function removeFile(bucket: Bucket, path: string) {
  await supabaseAdmin().storage.from(bucket).remove([path]);
}

export const dataUri = (buf: Buffer, mime: string) => `data:${mime};base64,${buf.toString("base64")}`;
