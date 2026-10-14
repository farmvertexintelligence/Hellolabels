import { NextResponse } from "next/server";
import { z } from "zod";
import { findLabelSize, findProduct } from "@/lib/catalog/helpers";
import { sanitizeDesign } from "@/lib/design/sanitize";
import { getUser, handle, HttpError } from "@/lib/server/auth";
import { reviseDesign } from "@/lib/server/ai-designer";
import { loadAiImages } from "@/lib/server/ai-images";
import { getCatalog } from "@/lib/server/catalog";
import { rateLimit } from "@/lib/server/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 120;

const Body = z.object({
  design: z.unknown(),
  instruction: z.string().trim().min(2).max(300),
  labelSizeId: z.string().max(60),
  productId: z.string().max(60),
  segment: z.enum(["event", "shop", "label"]),
});

export const POST = handle(async (req: Request) => {
  const user = await getUser().catch(() => null);
  await rateLimit("ai-revise", user ? 60 : 15, 60 * 60_000, user?.id);
  const b = Body.parse(await req.json());
  const catalog = await getCatalog();
  const product = findProduct(catalog, b.productId);
  const size = findLabelSize(catalog, b.labelSizeId);
  if (!product || !size || !product.labelSizeIds.includes(size.id)) throw new HttpError(400, "Unknown product or label size");
  const segment = product.kind === "label_only" ? "label" : b.segment === "label" ? "event" : b.segment;
  const current = sanitizeDesign(b.design, size, segment, { minTextPt: catalog.settings.minTextPt });
  const srcs = current.elements.flatMap((e) => (e.type === "image" && e.src.startsWith("uploads/") ? [e.src] : []));
  const out = await reviseDesign({ design: current, instruction: b.instruction, size, segment, minTextPt: catalog.settings.minTextPt, images: await loadAiImages(srcs) });
  if (!out) throw new HttpError(503, "The AI could not make that change right now. Try the editor, or rephrase.");
  // Keep browser-only images the AI could not see.
  const local = current.elements.filter((e) => e.type === "image" && !e.src.startsWith("uploads/"));
  return NextResponse.json({ design: { ...out.design, elements: [...out.design.elements, ...local] }, note: out.note });
});
