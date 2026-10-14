import "server-only";
import path from "node:path";
import * as fontkit from "fontkit";
import { FONTS, fontFile, scriptRuns, tamilFallback, type FontId } from "@/lib/design/fonts";
import type { TextRun } from "@/lib/design/regpanel";
import type { Measure } from "@/lib/design/text-layout";

type FkFont = fontkit.Font;

const FONT_DIR = path.join(process.cwd(), "assets", "fonts");
const cache = new Map<string, FkFont>();

function load(font: FontId, weight: number): FkFont {
  const file = fontFile(font, weight);
  let f = cache.get(file);
  if (!f) {
    f = fontkit.openSync(path.join(FONT_DIR, file)) as FkFont;
    cache.set(file, f);
  }
  return f;
}

/**
 * Splits text into runs that each use a font that has the glyphs: the chosen font, then its Tamil
 * fallback, then Noto Sans Tamil / DM Sans. Characters no font can draw (emoji) are dropped rather
 * than printed as empty boxes.
 */
function pieces(text: string, font: FontId, weight: number): { text: string; font: FkFont }[] {
  const chain = [load(font, weight), load(tamilFallback(font), weight), load("notosanstamil", weight), load("dmsans", weight)];
  const out: { text: string; font: FkFont }[] = [];
  for (const r of scriptRuns(text)) {
    const preferred = r.tamil && !FONTS[font].tamil ? chain[1] : chain[0];
    for (const ch of r.text) {
      const cp = ch.codePointAt(0)!;
      // Combining marks / joiners stay with the previous run so shaping sees whole syllables.
      const joining = /[\p{M}\u200C\u200D]/u.test(ch);
      const f = joining && out.length ? out[out.length - 1].font : [preferred, ...chain].find((c) => c.hasGlyphForCodePoint(cp) || /\s/.test(ch));
      if (!f) continue;
      const last = out[out.length - 1];
      if (last && last.font === f) last.text += ch;
      else out.push({ text: ch, font: f });
    }
  }
  return out;
}

function advance(text: string, font: FontId, weight: number, sizeMm: number, ls = 0): number {
  let w = 0;
  let chars = 0;
  for (const p of pieces(text, font, weight)) {
    const run = p.font.layout(p.text);
    w += (run.advanceWidth / p.font.unitsPerEm) * sizeMm;
    chars += [...p.text].length;
  }
  return w + Math.max(0, chars - 1) * ls * sizeMm;
}

/** Exact text width from the real font files (with OpenType shaping, so Tamil conjuncts are right). */
export const serverMeasure: Measure = (text, font, weight, sizeMm, ls) => advance(text, font, weight, sizeMm, ls ?? 0);

/** Converts a text run into an SVG path (vector outlines), so the printer never needs the fonts. */
export function outlineRun(run: TextRun): string {
  const total = advance(run.text, run.font, run.weight, run.sizeMm, run.letterSpacing ?? 0);
  let pen = run.anchor === "middle" ? run.x - total / 2 : run.anchor === "end" ? run.x - total : run.x;
  const ls = (run.letterSpacing ?? 0) * run.sizeMm;
  const skew = run.italic ? 0.2 : 0; // slant right for synthetic italics
  let d = "";
  for (const p of pieces(run.text, run.font, run.weight)) {
    const glyphRun = p.font.layout(p.text);
    const scale = run.sizeMm / p.font.unitsPerEm;
    glyphRun.glyphs.forEach((g, i) => {
      const pos = glyphRun.positions[i];
      const gx = pen + pos.xOffset * scale;
      const gy = run.y - pos.yOffset * scale;
      // fontkit paths are y-up in font units; flip and move to the pen position.
      const path = g.path.transform(scale, 0, skew * scale, -scale, gx, gy);
      d += path.toSVG();
      pen += pos.xAdvance * scale + ls;
    });
  }
  return d;
}
