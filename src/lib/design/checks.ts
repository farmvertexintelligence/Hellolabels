import type { LabelSize, Segment } from "@/lib/catalog/types";
import { contrastRatio, mix } from "./color";
import { layoutRegPanel } from "./regpanel";
import { textRuns } from "./render";
import type { Measure } from "./text-layout";
import type { Box, Design, DesignElement, RegPanelData, TextElement } from "./types";
import { boundsOf, computeZones, contains, intersects } from "./zones";

export type CheckId = "text-size" | "image-quality" | "safe-area" | "regulatory" | "contrast";

export interface CheckIssue {
  check: CheckId;
  level: "error" | "warning";
  elementId?: string;
  en: string;
  ta: string;
}

export interface CheckResult {
  ok: boolean; // no errors (warnings allowed)
  issues: CheckIssue[];
  passed: CheckId[];
}

export const MIN_DPI = 300;
const LOW_DPI = 150;

export interface CheckOptions {
  size: LabelSize;
  segment: Segment;
  reg: RegPanelData | null;
  measure: Measure;
  minTextPt: number;
}

/** Effective print resolution of an image element (lower of the two axes after cover/contain fit). */
export function imageDpi(el: { w: number; h: number; pxWidth: number; pxHeight: number; fit: "cover" | "contain" }): number {
  if (!el.pxWidth || !el.pxHeight) return 0;
  const imgAspect = el.pxWidth / el.pxHeight;
  const boxAspect = el.w / el.h;
  // Printed size of the full image in mm.
  let printedW: number;
  if (el.fit === "cover") printedW = imgAspect > boxAspect ? el.h * imgAspect : el.w;
  else printedW = imgAspect > boxAspect ? el.w : el.h * imgAspect;
  return Math.floor(el.pxWidth / (printedW / 25.4));
}

/** Colour behind a text element: the top-most solid shape covering it, else the label background. */
function backdropsFor(el: TextElement, design: Design, idx: number): { colors: string[]; overImage: boolean } {
  const tb = boundsOf(el);
  for (let i = idx - 1; i >= 0; i--) {
    const below = design.elements[i];
    if (!intersects(boundsOf(below), tb)) continue;
    if (below.type === "image") return { colors: [], overImage: true };
    if (below.type === "shape" && below.fill && below.shape !== "line" && (below.opacity ?? 1) >= 0.85 && contains(boundsOf(below), tb, 0.5)) {
      return { colors: [below.fill], overImage: false };
    }
  }
  const bg = design.background;
  if (bg.gradient && bg.gradient !== "none" && bg.color2) return { colors: [bg.color, mix(bg.color, bg.color2, 0.5), bg.color2], overImage: false };
  return { colors: [bg.color], overImage: false };
}

const label = (el: DesignElement) => el.name || (el.type === "text" ? `“${el.text.slice(0, 24)}”` : el.type);

export function runChecks(design: Design, o: CheckOptions): CheckResult {
  const z = computeZones(o.size, o.segment);
  const issues: CheckIssue[] = [];

  design.elements.forEach((el, idx) => {
    const b = boundsOf(el);
    const name = label(el);

    // 1. Safe area & locked zones
    const isBackground = el.role === "background";
    const limit = isBackground ? z.bleed : z.safe;
    if (!contains(limit, b)) {
      issues.push({
        check: "safe-area",
        level: "error",
        elementId: el.id,
        en: `${name} goes outside the safe area. Keep text and logos 3 mm inside the cut line.`,
        ta: `${name} பாதுகாப்பு எல்லைக்கு வெளியே உள்ளது. எழுத்தும் லோகோவும் வெட்டுக் கோட்டிலிருந்து 3 மி.மீ உள்ளே இருக்க வேண்டும்.`,
      });
    }
    // Background art may run under the locked zones (they are printed on top of it); content may not.
    for (const l of isBackground ? [] : z.locked) {
      if (intersects(b, l.box)) {
        const what = l.kind === "regulatory" ? ["the regulatory panel", "சட்டப்படி தகவல் பகுதியை"] : l.kind === "ad" ? ["the reserved ad space", "விளம்பரப் பகுதியை"] : ["the glue overlap (hidden on the bottle)", "ஒட்டும் பகுதியை"];
        issues.push({
          check: l.kind === "regulatory" ? "regulatory" : "safe-area",
          level: "error",
          elementId: el.id,
          en: `${name} covers ${what[0]}. Move it into the design area.`,
          ta: `${name} ${what[1]} மறைக்கிறது. வடிவமைப்புப் பகுதிக்குள் நகர்த்தவும்.`,
        });
      }
    }

    // 2. Text size, 5. contrast
    if (el.type === "text") {
      const { sizePt, overflow } = textRuns(el, o.measure, o.minTextPt);
      if (sizePt < o.minTextPt - 1e-9) {
        issues.push({
          check: "text-size",
          level: "error",
          elementId: el.id,
          en: `${name} is ${sizePt.toFixed(1)} pt — too small to read when printed (minimum ${o.minTextPt} pt).`,
          ta: `${name} ${sizePt.toFixed(1)} pt — அச்சில் படிக்க மிகச் சிறியது (குறைந்தது ${o.minTextPt} pt).`,
        });
      }
      if (overflow) {
        issues.push({
          check: "text-size",
          level: "error",
          elementId: el.id,
          en: `${name} does not fit its box. Shorten the text or make the box bigger.`,
          ta: `${name} அதன் பெட்டிக்குள் அடங்கவில்லை. எழுத்தைக் குறைக்கவும் அல்லது பெட்டியைப் பெரிதாக்கவும்.`,
        });
      }
      const { colors, overImage } = backdropsFor(el, design, idx);
      if (overImage) {
        issues.push({
          check: "contrast",
          level: "warning",
          elementId: el.id,
          en: `${name} sits on a photo. Check it is easy to read, or add a solid band behind it.`,
          ta: `${name} புகைப்படத்தின் மேல் உள்ளது. எளிதாகப் படிக்க முடிகிறதா எனப் பார்க்கவும்.`,
        });
      } else {
        const ratio = Math.min(...colors.map((c) => contrastRatio(el.color, c)));
        const large = sizePt >= 18 || (sizePt >= 14 && el.weight >= 700);
        const need = large ? 3 : 4.5;
        if (ratio < need) {
          issues.push({
            check: "contrast",
            level: ratio < 2 ? "error" : "warning",
            elementId: el.id,
            en: `${name} has low contrast (${ratio.toFixed(1)}:1, needs ${need}:1). Use a darker or lighter colour.`,
            ta: `${name} பின்னணியுடன் போதுமான வேறுபாடு இல்லை (${ratio.toFixed(1)}:1). அடர்ந்த அல்லது வெளிர் நிறத்தைப் பயன்படுத்தவும்.`,
          });
        }
      }
    }

    // 3. Image quality
    if (el.type === "image") {
      const dpi = imageDpi(el);
      if (dpi < MIN_DPI) {
        issues.push({
          check: "image-quality",
          level: dpi < LOW_DPI ? "error" : "warning",
          elementId: el.id,
          en: `${name} is only ${dpi} DPI at this size (needs ${MIN_DPI}). Upload a larger photo or make it smaller.`,
          ta: `${name} இந்த அளவில் ${dpi} DPI மட்டுமே (${MIN_DPI} தேவை). பெரிய படத்தைப் பதிவேற்றவும் அல்லது சிறியதாக்கவும்.`,
        });
      }
    }
  });

  // 4. Regulatory panel present and fully visible
  if (z.regPanel) {
    if (!o.reg) {
      issues.push({ check: "regulatory", level: "error", en: "Regulatory details are missing.", ta: "சட்டப்படி தகவல்கள் இல்லை." });
    } else {
      const lay = layoutRegPanel(z.regPanel, o.reg, o.measure, o.minTextPt, o.size.wraps);
      if (lay.overflow) {
        issues.push({
          check: "regulatory",
          level: "error",
          en: "The regulatory panel does not fit this label size. Please contact hellolabels.",
          ta: "இந்த லேபிள் அளவில் சட்டப்படி தகவல் பகுதி அடங்கவில்லை. hellolabels-ஐ தொடர்பு கொள்ளவும்.",
        });
      }
    }
  }

  const failed = new Set(issues.map((i) => i.check));
  const all: CheckId[] = ["text-size", "image-quality", "safe-area", "regulatory", "contrast"];
  return { ok: !issues.some((i) => i.level === "error"), issues, passed: all.filter((c) => !failed.has(c)) };
}

/** Clamp a box into an area (used when placing AI output and after drag/resize). */
export function clampInto(b: Box, area: Box): Box {
  const w = Math.min(b.w, area.w);
  const h = Math.min(b.h, area.h);
  const x = Math.min(Math.max(b.x, area.x), area.x + area.w - w);
  const y = Math.min(Math.max(b.y, area.y), area.y + area.h - h);
  return { x, y, w, h };
}
