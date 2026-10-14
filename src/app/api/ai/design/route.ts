import { NextResponse } from "next/server";
import { z } from "zod";
import { findLabelSize, findProduct } from "@/lib/catalog/helpers";
import { getUser, handle, HttpError } from "@/lib/server/auth";
import { generateDesigns } from "@/lib/server/ai-designer";
import { loadAiImages } from "@/lib/server/ai-images";
import { getCatalog } from "@/lib/server/catalog";
import { rateLimit } from "@/lib/server/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 120;

const Body = z.object({
  brief: z.string().trim().min(3).max(600),
  labelSizeId: z.string().max(60),
  productId: z.string().max(60),
  segment: z.enum(["event", "shop", "label"]),
  lang: z.enum(["en", "ta"]),
  images: z.array(z.string().max(80)).max(3).default([]),
});

export const POST = handle(async (req: Request) => {
  const user = await getUser().catch(() => null);
  await rateLimit("ai-design", user ? 20 : 6, 60 * 60_000, user?.id);
  const b = Body.parse(await req.json());
  const catalog = await getCatalog();
  const product = findProduct(catalog, b.productId);
  const size = findLabelSize(catalog, b.labelSizeId);
  if (!product || !size || !product.labelSizeIds.includes(size.id)) throw new HttpError(400, "Unknown product or label size");
  const segment = product.kind === "label_only" ? "label" : b.segment === "label" ? "event" : b.segment;
  const result = await generateDesigns({ brief: b.brief, size, segment, lang: b.lang, minTextPt: catalog.settings.minTextPt, images: await loadAiImages(b.images) });
  return NextResponse.json(result);
});
