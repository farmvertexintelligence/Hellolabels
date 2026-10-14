import "server-only";
import { z } from "zod";
import { findLabelSize, findProduct } from "@/lib/catalog/helpers";
import { sanitizeDesign } from "@/lib/design/sanitize";
import { HttpError } from "./auth";
import { getCatalog } from "./catalog";

export const DesignBody = z.object({
  name: z.string().trim().min(1).max(80),
  productId: z.string().max(60),
  labelSizeId: z.string().max(60),
  segment: z.enum(["event", "shop", "label"]),
  doc: z.unknown(),
});

export async function cleanDesign(b: z.infer<typeof DesignBody>) {
  const catalog = await getCatalog();
  const product = findProduct(catalog, b.productId);
  const size = findLabelSize(catalog, b.labelSizeId);
  if (!product || !size || !product.labelSizeIds.includes(size.id)) throw new HttpError(400, "Unknown product or label size");
  // Only server-uploaded images can be saved (browser-only images would not survive).
  return sanitizeDesign(b.doc, size, b.segment, { minTextPt: catalog.settings.minTextPt, allowedImage: (s) => s.startsWith("uploads/") });
}

