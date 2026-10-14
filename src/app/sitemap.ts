import type { MetadataRoute } from "next";
import { DEFAULT_PRODUCTS } from "@/lib/catalog/defaults";
import { DISTRICTS } from "@/lib/districts";
import { env } from "@/lib/env";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = env.siteUrl.replace(/\/$/, "");
  const now = new Date();
  const page = (path: string, priority: number) => ({ url: `${base}${path}`, lastModified: now, priority });
  return [
    page("/", 1),
    page("/products", 0.9),
    page("/design", 0.9),
    page("/templates", 0.8),
    page("/districts", 0.6),
    page("/dealer/apply", 0.5),
    page("/track", 0.3),
    page("/privacy", 0.2),
    page("/refund-policy", 0.2),
    page("/terms", 0.2),
    ...DEFAULT_PRODUCTS.map((p) => page(`/products/${p.slug}`, 0.8)),
    ...DISTRICTS.map((d) => page(`/districts/${d.slug}`, 0.6)),
  ];
}
