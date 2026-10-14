import "server-only";
import { headers } from "next/headers";
import { HttpError } from "./auth";

/*
 * Small in-memory rate limiter (per server instance) for expensive endpoints such as the AI
 * designer and uploads. It is a first line of defence; put a CDN/WAF rule in front for more.
 */
const hits = new Map<string, number[]>();

export async function rateLimit(bucket: string, limit: number, windowMs: number, key?: string) {
  const h = await headers();
  const ip = key ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? "local";
  const k = `${bucket}:${ip}`;
  const now = Date.now();
  const list = (hits.get(k) ?? []).filter((t) => now - t < windowMs);
  if (list.length >= limit) throw new HttpError(429, "Too many requests — please wait a minute and try again.");
  list.push(now);
  hits.set(k, list);
  if (hits.size > 5000) for (const [kk, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(kk);
}
