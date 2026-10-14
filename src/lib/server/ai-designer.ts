import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import * as z from "zod/v4";
import type { LabelSize, Segment } from "@/lib/catalog/types";
import { designsFromBrief } from "@/lib/design/brief";
import { FONTS, FONT_IDS } from "@/lib/design/fonts";
import { MOTIFS, MOTIF_IDS } from "@/lib/design/motifs";
import { sanitizeDesign } from "@/lib/design/sanitize";
import type { Design } from "@/lib/design/types";
import { computeZones } from "@/lib/design/zones";
import { env, features } from "@/lib/env";

/*
 * The AI label designer. Claude reads the customer's brief (English or Tamil) and any uploaded
 * logo/photo, and returns label layouts as structured JSON in millimetres. The JSON is then
 * sanitised (fonts, motifs, colours, bounds) and the locked zones are drawn by our renderer, so
 * the AI can never move or cover the regulatory panel or the ad strip.
 */

const ElementSchema = z.object({
  type: z.enum(["text", "shape", "motif", "image"]),
  name: z.string().describe("Short role name: names, date, subtitle, message, band, border, logo, photo…"),
  role: z.enum(["content", "background"]).describe("background = decorative art that may run to the label edge; content = must stay inside the design area"),
  x: z.number(),
  y: z.number(),
  w: z.number(),
  h: z.number(),
  rotation: z.number().describe("Degrees; usually 0"),
  text: z.string().describe("Text elements only, else empty"),
  font: z.enum(["none", ...FONT_IDS]),
  weight: z.number().int(),
  sizePt: z.number().describe("Maximum font size in points; text shrinks to fit its box"),
  color: z.string().describe("#RRGGBB — text colour, motif main colour, or shape fill"),
  color2: z.string().describe("#RRGGBB second motif colour, or empty"),
  align: z.enum(["left", "center", "right"]),
  uppercase: z.boolean(),
  letterSpacing: z.number().describe("em, 0 to 0.3"),
  shape: z.enum(["rect", "ellipse", "line", "none"]),
  stroke: z.string().describe("#RRGGBB outline for shapes, or empty"),
  strokeMm: z.number(),
  radiusMm: z.number(),
  motif: z.enum(["none", ...MOTIF_IDS]),
  imageAsset: z.number().int().describe("Index of the customer's uploaded image for image elements, else -1"),
  circle: z.boolean().describe("Circle-crop the image"),
});

const DesignSchema = z.object({
  name: z.string().describe("2–4 word style name, e.g. 'Temple gold'"),
  background: z.object({ color: z.string(), color2: z.string().describe("Second gradient colour or empty"), gradient: z.enum(["none", "linear", "radial"]) }),
  elements: z.array(ElementSchema),
});

export const FourDesigns = z.object({ designs: z.array(DesignSchema) });
export const OneDesign = z.object({ design: DesignSchema, note: z.string().describe("One short sentence telling the customer what changed") });

const SYSTEM = `You design custom labels for hellolabels, a label printer in Mettur, Tamil Nadu. Most labels wrap around packaged drinking-water bottles for weddings, birthdays, housewarmings, temple festivals, Tamil festivals (Pongal, Deepavali, Tamil New Year), corporate events, or a shop's own branded water. Customers write in English or Tamil.

Coordinates are millimetres from the top-left corner of the label's cut line. You are told the label size and the DESIGN AREA rectangle. Rules:
- Every "content" element (all text, logos, photos) must lie fully inside the design area.
- "background" elements (colour bands, borders, big decorative motifs) may extend to the label edges but should still mostly sit in the design area.
- The regulatory panel (FSSAI, ISI, batch, MRP…) and, on Shop labels, a 20% advertisement strip are added automatically outside the design area. Never write regulatory text, prices, MRP, FSSAI or ISI yourself.
- Labels are vertical rectangles. The DESIGN AREA is the square at the top of the label; the ad strip (Shop labels) and the regulatory panel sit below it. Compose for a square: centred, balanced layouts usually work best.
- Text never smaller than the minimum size given. Use generous sizes (sizePt is a maximum; text shrinks to fit its box). Give names/titles the biggest box.
- Strong contrast: dark text on light backgrounds or light text on dark ones (WCAG 4.5:1 for small text). Text on a band must contrast with the band.
- Tamil text must use a Tamil-capable font: ${FONT_IDS.filter((f) => FONTS[f].tamil).join(", ")}. Latin fonts fall back automatically for Tamil, but a Tamil font looks better.
- Keep spelling of names, dates and Tamil words exactly as the customer wrote them. Do not invent names, dates or phone numbers; if missing, leave that line out.
- Use colours as #RRGGBB. Prefer rich, print-friendly colours (avoid neon RGB that cannot be printed in CMYK).
- Use 4–12 elements per design. Order matters: earlier elements are drawn underneath later ones.

Fonts (id: description): ${FONT_IDS.map((f) => `${f}: ${FONTS[f].label}${FONTS[f].tamil ? " [Tamil]" : ""}`).join("; ")}.
Motifs (vector ornaments, id: description): ${MOTIF_IDS.map((m) => `${m}: ${MOTIFS[m].en}${MOTIFS[m].border ? " (frame — fills its box as a border)" : ""}`).join("; ")}.
For element fields that do not apply, use: text "", font "none", motif "none", shape "none", imageAsset -1, color2 "", stroke "", numbers 0, booleans false.`;

function context(size: LabelSize, segment: Segment, minTextPt: number) {
  const z = computeZones(size, segment);
  const d = z.design;
  return `Label: ${size.widthMm} × ${size.heightMm} mm, ${size.wraps ? "wrap-around bottle label" : "vertical label"}. Segment: ${segment}.
DESIGN AREA: x=${d.x}, y=${d.y}, w=${d.w}, h=${d.h} (mm). Minimum text size: ${minTextPt} pt.`;
}

export interface AiImage {
  /** Storage path used as the element src. */
  src: string;
  pxWidth: number;
  pxHeight: number;
  /** Small JPEG for the model to look at. */
  previewBase64: string;
}

type RawDesign = z.infer<typeof DesignSchema>;

export function toRaw(d: RawDesign, images: AiImage[]) {
  return {
    name: d.name,
    background: { color: d.background.color, color2: d.background.color2 || undefined, gradient: d.background.gradient },
    elements: d.elements.map((e) => {
      const img = e.type === "image" ? images[e.imageAsset] : undefined;
      return {
        ...e,
        font: e.font === "none" ? undefined : e.font,
        motif: e.motif === "none" ? undefined : e.motif,
        shape: e.shape === "none" ? "rect" : e.shape,
        fill: e.type === "shape" ? e.color : undefined,
        stroke: e.stroke || null,
        color2: e.color2 || undefined,
        src: img?.src,
        pxWidth: img?.pxWidth,
        pxHeight: img?.pxHeight,
        fit: "cover",
        autoFit: true,
        lineHeight: 1.15,
      };
    }),
  };
}

let anthropic: Anthropic | null = null;
const ai = () => (anthropic ??= new Anthropic({ apiKey: env.anthropicKey, timeout: 110_000, maxRetries: 1 }));

function imageBlocks(images: AiImage[]): Anthropic.Beta.BetaContentBlockParam[] {
  return images.flatMap((img, i) => [
    { type: "text" as const, text: `Uploaded image ${i} (${img.pxWidth}×${img.pxHeight}px):` },
    { type: "image" as const, source: { type: "base64" as const, media_type: "image/jpeg" as const, data: img.previewBase64 } },
  ]);
}

async function call<T extends z.ZodType>(schema: T, user: Anthropic.Beta.BetaContentBlockParam[]): Promise<z.infer<T> | null> {
  const res = await ai().beta.messages.parse({
    model: env.aiModel,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    thinking: { type: "adaptive" },
    output_config: { effort: "medium", format: betaZodOutputFormat(schema) },
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: user }],
  });
  if (res.stop_reason === "refusal" || res.stop_reason === "max_tokens") return null;
  return (res.parsed_output as z.infer<T> | null) ?? null;
}

export interface GenerateResult {
  designs: Design[];
  source: "ai" | "templates";
}

/** Four different designs for a brief. Falls back to smart templates if the AI is off or fails. */
export async function generateDesigns(opts: { brief: string; size: LabelSize; segment: Segment; lang: "en" | "ta"; minTextPt: number; images: AiImage[] }): Promise<GenerateResult> {
  const fallback = (): GenerateResult => ({
    designs: designsFromBrief(opts.brief, opts.size, opts.segment, opts.lang, opts.images[0] ? { src: opts.images[0].src, pxWidth: opts.images[0].pxWidth, pxHeight: opts.images[0].pxHeight } : undefined),
    source: "templates",
  });
  if (!features.ai) return fallback();
  try {
    const out = await call(FourDesigns, [
      ...imageBlocks(opts.images),
      {
        type: "text",
        text: `${context(opts.size, opts.segment, opts.minTextPt)}
${opts.images.length ? "Use the uploaded image(s) where they fit (logo or photo)." : "No images uploaded."}
Customer's brief (${opts.lang === "ta" ? "Tamil UI" : "English UI"}): """${opts.brief.slice(0, 600)}"""

Create exactly 4 clearly different designs (different layouts, palettes and ornaments) that fit this exact label.`,
      },
    ]);
    if (!out?.designs?.length) return fallback();
    const allowed = new Set(opts.images.map((i) => i.src));
    const designs = out.designs.slice(0, 4).map((d) => sanitizeDesign(toRaw(d, opts.images), opts.size, opts.segment, { minTextPt: opts.minTextPt, allowedImage: (s) => allowed.has(s) }));
    if (designs.some((d) => !d.elements.some((e) => e.type === "text"))) return fallback();
    return { designs, source: "ai" };
  } catch (e) {
    console.error("AI design failed, using templates", e);
    return fallback();
  }
}

/** Applies a plain-language change ("make the names bigger") to one design. */
export async function reviseDesign(opts: { design: Design; instruction: string; size: LabelSize; segment: Segment; minTextPt: number; images: AiImage[] }): Promise<{ design: Design; note: string } | null> {
  if (!features.ai) return null;
  const current = {
    name: opts.design.name ?? "Design",
    background: opts.design.background,
    elements: opts.design.elements.map((e) => {
      const idx = e.type === "image" ? opts.images.findIndex((i) => i.src === e.src) : -1;
      return { ...e, imageAsset: idx, src: undefined };
    }),
  };
  try {
    const out = await call(OneDesign, [
      ...imageBlocks(opts.images),
      {
        type: "text",
        text: `${context(opts.size, opts.segment, opts.minTextPt)}
Current design JSON:
${JSON.stringify(current)}

Customer's change request: """${opts.instruction.slice(0, 400)}"""
Return the full updated design. Change only what was asked; keep everything else (text, positions, colours) the same.`,
      },
    ]);
    if (!out) return null;
    const allowed = new Set(opts.images.map((i) => i.src));
    const design = sanitizeDesign({ ...toRaw(out.design, opts.images), templateId: opts.design.templateId }, opts.size, opts.segment, { minTextPt: opts.minTextPt, allowedImage: (s) => allowed.has(s) });
    return { design, note: out.note };
  } catch (e) {
    console.error("AI revise failed", e);
    return null;
  }
}
