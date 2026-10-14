import type { LabelSize, Segment } from "@/lib/catalog/types";
import { clampInto } from "./checks";
import { isHex, normalizeHex } from "./color";
import { isFontId, nearestWeight } from "./fonts";
import { isMotifId } from "./motifs";
import { newId } from "./templates";
import type { Design, DesignElement } from "./types";
import { computeZones } from "./zones";

const num = (v: unknown, d: number, min = -1e4, max = 1e4) => {
  const n = typeof v === "number" && Number.isFinite(v) ? v : d;
  return Math.min(max, Math.max(min, n));
};
const color = (v: unknown, d: string) => (isHex(v) ? normalizeHex(v as string) : d);
const str = (v: unknown, max = 400) => (typeof v === "string" ? v.slice(0, max) : "");

/**
 * Turns untrusted design JSON (from the browser or the AI) into a valid Design for this label:
 * unknown fonts/motifs/colours are replaced, sizes are bounded, content elements are pulled into
 * the design area and background elements into the bleed box. Locked zones are never part of a
 * design — they are drawn by the renderer — so nothing here can remove or move them.
 */
export function sanitizeDesign(raw: unknown, size: LabelSize, segment: Segment, opts: { minTextPt: number; allowedImage?: (src: string) => boolean }): Design {
  const r = (raw ?? {}) as Record<string, unknown>;
  const z = computeZones(size, segment);
  const bg = (r.background ?? {}) as Record<string, unknown>;
  const elements: DesignElement[] = [];
  const seen = new Set<string>();
  const rawEls = Array.isArray(r.elements) ? r.elements.slice(0, 60) : [];

  for (const item of rawEls) {
    const e = (item ?? {}) as Record<string, unknown>;
    let id = str(e.id, 40).replace(/[^\w-]/g, "") || newId();
    if (seen.has(id)) id = newId();
    seen.add(id);
    const role = e.role === "background" ? "background" : "content";
    const area = role === "background" ? z.bleed : z.design;
    const box = clampInto({ x: num(e.x, area.x), y: num(e.y, area.y), w: num(e.w, 10, 0.5, 1000), h: num(e.h, 10, 0.5, 1000) }, area);
    const common = {
      id,
      name: str(e.name, 40) || undefined,
      ...box,
      rotation: num(e.rotation, 0, -180, 180) || undefined,
      opacity: e.opacity === undefined ? undefined : num(e.opacity, 1, 0.05, 1),
    };
    if (e.type === "text") {
      const font = isFontId(e.font) ? e.font : "dmsans";
      const t = str(e.text, 300);
      if (!t.trim()) continue;
      elements.push({
        ...common,
        role: "content",
        type: "text",
        text: t,
        font,
        weight: nearestWeight(font, num(e.weight, 400, 100, 900)),
        sizePt: num(e.sizePt, 12, opts.minTextPt, 200),
        color: color(e.color, "#141A26"),
        align: e.align === "left" || e.align === "right" ? e.align : "center",
        lineHeight: num(e.lineHeight, 1.15, 0.8, 2.5),
        letterSpacing: num(e.letterSpacing, 0, -0.1, 0.5) || undefined,
        italic: e.italic === true || undefined,
        uppercase: e.uppercase === true || undefined,
        autoFit: e.autoFit !== false,
      });
    } else if (e.type === "image") {
      const src = str(e.src, 600);
      if (!src || (opts.allowedImage && !opts.allowedImage(src))) continue;
      elements.push({
        ...common,
        role,
        type: "image",
        src,
        pxWidth: num(e.pxWidth, 0, 0, 50000),
        pxHeight: num(e.pxHeight, 0, 0, 50000),
        fit: e.fit === "contain" ? "contain" : "cover",
        radiusMm: num(e.radiusMm, 0, 0, 100) || undefined,
        circle: e.circle === true || undefined,
      });
    } else if (e.type === "shape") {
      const shape = e.shape === "ellipse" || e.shape === "line" ? e.shape : "rect";
      elements.push({
        ...common,
        role,
        type: "shape",
        shape,
        fill: e.fill === null || e.fill === "none" ? null : color(e.fill, "#FFFFFF"),
        stroke: isHex(e.stroke) ? normalizeHex(e.stroke as string) : null,
        strokeMm: num(e.strokeMm, 0.3, 0.1, 10),
        radiusMm: num(e.radiusMm, 0, 0, 100) || undefined,
      });
    } else if (e.type === "motif" && isMotifId(e.motif)) {
      elements.push({ ...common, role, type: "motif", motif: e.motif, color: color(e.color, "#B5452A"), color2: isHex(e.color2) ? normalizeHex(e.color2 as string) : undefined });
    }
  }

  return {
    v: 1,
    labelSizeId: size.id,
    segment,
    name: str(r.name, 60) || undefined,
    templateId: str(r.templateId, 40) || undefined,
    background: {
      color: color(bg.color, "#F6F3EC"),
      color2: isHex(bg.color2) ? normalizeHex(bg.color2 as string) : undefined,
      gradient: bg.gradient === "linear" || bg.gradient === "radial" ? bg.gradient : "none",
      angle: num(bg.angle, 0, -360, 360),
    },
    elements,
  };
}
