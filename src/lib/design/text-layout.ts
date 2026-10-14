import { FONTS, hasTamil, ptToMm, type FontId } from "./fonts";
import type { TextElement } from "./types";

/** Width in mm of a single line of text. Browser: canvas; server: fontkit; tests: estimate. */
export type Measure = (text: string, font: FontId, weight: number, sizeMm: number, letterSpacingEm?: number) => number;

export interface TextLayout {
  lines: string[];
  sizePt: number;
  sizeMm: number;
  lineHeightMm: number;
  /** Top of the first line box, in label mm. */
  top: number;
  /** True if the text still does not fit its box at the smallest allowed size. */
  overflow: boolean;
}

export const ABSOLUTE_MIN_PT = 4;

export function displayText(el: Pick<TextElement, "text" | "uppercase">): string {
  return el.uppercase ? el.text.toLocaleUpperCase("en-IN") : el.text;
}

function wrap(text: string, maxW: number, widthOf: (s: string) => number): string[] {
  const out: string[] = [];
  for (const para of text.split(/\r?\n/)) {
    const words = para.split(/\s+/).filter(Boolean);
    if (!words.length) {
      out.push("");
      continue;
    }
    let line = words[0];
    for (const word of words.slice(1)) {
      const next = `${line} ${word}`;
      if (widthOf(next) <= maxW) line = next;
      else {
        out.push(line);
        line = word;
      }
    }
    out.push(line);
  }
  return out;
}

function fits(el: TextElement, sizePt: number, measure: Measure) {
  const sizeMm = ptToMm(sizePt);
  const widthOf = (s: string) => measure(s, el.font, el.weight, sizeMm, el.letterSpacing);
  const lines = wrap(displayText(el), el.w, widthOf);
  const lineHeightMm = sizeMm * el.lineHeight;
  const height = lines.length * lineHeightMm;
  const widest = Math.max(0, ...lines.map(widthOf));
  return { lines, sizeMm, lineHeightMm, ok: widest <= el.w + 0.01 && height <= el.h + 0.01 };
}

/**
 * Wraps the text to its box. With autoFit the size shrinks (0.25 pt steps) until it fits, but never
 * below `minPt` — if it still overflows, `overflow` is set and the pre-checkout check reports it.
 */
export function layoutText(el: TextElement, measure: Measure, minPt = ABSOLUTE_MIN_PT): TextLayout {
  let sizePt = el.sizePt;
  let r = fits(el, sizePt, measure);
  if (el.autoFit) {
    const floor = Math.max(ABSOLUTE_MIN_PT, Math.min(minPt, el.sizePt));
    while (!r.ok && sizePt - 0.25 >= floor) {
      sizePt -= 0.25;
      r = fits(el, sizePt, measure);
    }
  }
  const blockH = r.lines.length * r.lineHeightMm;
  const top = el.y + Math.max(0, (el.h - blockH) / 2);
  return { lines: r.lines, sizePt, sizeMm: r.sizeMm, lineHeightMm: r.lineHeightMm, top, overflow: !r.ok };
}

/** Rough text width used when no real font metrics are available (tests, first server pass). */
export const estimateMeasure: Measure = (text, font, weight, sizeMm, ls = 0) => {
  const f = FONTS[font];
  let k = f.family === "Great Vibes" ? 0.42 : f.family === "Cinzel" ? 0.68 : f.family === "Oswald" ? 0.45 : 0.53;
  if (weight >= 700) k *= 1.06;
  let w = 0;
  for (const ch of text) {
    if (ch === " ") w += 0.28;
    else if (hasTamil(ch)) w += 0.62;
    else if (/[A-Z0-9]/.test(ch)) w += k * 1.18;
    else w += k;
  }
  return w * sizeMm + Math.max(0, [...text].length - 1) * ls * sizeMm;
};
