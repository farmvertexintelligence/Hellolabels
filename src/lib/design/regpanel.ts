import { ptToMm, type FontId } from "./fonts";
import type { Measure } from "./text-layout";
import type { Box, RegPanelData } from "./types";
import { SAFE_MM } from "./zones";

/** One positioned line of text. `y` is the baseline. */
export interface TextRun {
  text: string;
  font: FontId;
  weight: number;
  sizeMm: number;
  x: number;
  y: number;
  anchor: "start" | "middle" | "end";
  color: string;
  letterSpacing?: number;
  italic?: boolean;
}

export interface PanelLayout {
  runs: TextRun[];
  /** Extra vector marks (ISI mark box). */
  marks: string;
  sizePt: number;
  overflow: boolean;
}

const INK = "#141A26";
const FONT: FontId = "dmsans";

export function formatMrp(paise: number | null): string {
  if (!paise) return "MRP ₹—";
  return `MRP ₹${(paise / 100).toFixed(2)} (incl. of all taxes)`;
}

export function formatVolume(ml: number | null): string {
  if (!ml) return "";
  return ml >= 1000 ? `Net Vol. ${ml / 1000} L` : `Net Vol. ${ml} ml`;
}

function items(d: RegPanelData) {
  return {
    title: "PACKAGED DRINKING WATER",
    isi: [d.isStandard, d.bisLicence].filter(Boolean),
    lines: [
      `fssai Lic. No. ${d.fssaiLicence}`,
      `Packed by: ${d.packagerName}, ${d.packagerAddress}`,
      `Batch No: ${d.batchNo}`,
      `Mfg: ${d.mfgDate}`,
      `Best before: ${d.bestBefore}`,
      formatMrp(d.mrpPaise),
      formatVolume(d.volumeMl),
      d.customerCare ? `Customer care: ${d.customerCare}` : "",
    ].filter(Boolean),
  };
}

function wrapWords(text: string, maxW: number, w: (s: string) => number): string[] {
  const out: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (!line || w(next) <= maxW) line = next;
    else {
      out.push(line);
      line = word;
    }
  }
  if (line) out.push(line);
  return out;
}

/**
 * Lays out the locked regulatory panel. Starts at 7 pt and shrinks to the minimum readable size; if
 * it still does not fit, `overflow` is reported (the admin must give this label a bigger panel).
 */
export function layoutRegPanel(box: Box, d: RegPanelData, measure: Measure, minPt: number, vertical: boolean): PanelLayout {
  const pad = 1.5;
  // Vertical strip (wrap labels) or bottom band (portrait labels): keep 3 mm from every cut edge.
  const inner = vertical
    ? { x: box.x + pad, y: box.y + SAFE_MM, w: box.w - 2 * pad, h: box.h - 2 * SAFE_MM }
    : { x: box.x + SAFE_MM, y: box.y + pad, w: box.w - 2 * SAFE_MM, h: box.h - pad - SAFE_MM };
  const it = items(d);
  let best: PanelLayout | null = null;

  // Blocks flow down one column, then into the next (1–3 columns, whichever fits at the largest size).
  const gap = 1.5;
  for (let cols = 1; cols <= 3; cols++) {
    const colW = (inner.w - gap * (cols - 1)) / cols;
    if (cols > 1 && colW < 18) break;
    // Largest size that fits, from 9 pt down to the minimum readable size.
    for (let pt = 9; pt >= minPt - 1e-9; pt -= 0.25) {
      const s = ptToMm(pt);
      const lh = s * 1.18;
      const width = (t: string, weight = 400) => measure(t, FONT, weight, s);
      // Each block: height and a draw function at (x, top).
      type Block = { h: number; draw: (x: number, top: number) => { runs: TextRun[]; marks: string } };
      const blocks: Block[] = [];
      const textBlock = (text: string, weight: number, anchor: "start" | "middle") => {
        const lines = wrapWords(text, colW, (t) => width(t, weight));
        blocks.push({
          h: lines.length * lh,
          draw: (x, top) => ({
            runs: lines.map((l, i) => ({ text: l, font: FONT, weight, sizeMm: s, x: anchor === "middle" ? x + colW / 2 : x, y: top + (i + 1) * lh - lh * 0.22, anchor, color: INK })),
            marks: "",
          }),
        });
      };
      textBlock(it.title, 700, cols === 1 ? "middle" : "start");
      const markH = s * 2.3;
      const markW = s * 3.6;
      blocks.push({
        h: Math.max(markH, lh * it.isi.length) + lh * 0.45,
        draw: (x, top) => {
          const y = top + lh * 0.25;
          return {
            marks: `<rect x="${x}" y="${y}" width="${markW}" height="${markH}" rx="${s * 0.3}" fill="none" stroke="${INK}" stroke-width="${Math.max(0.15, s * 0.09)}"/>`,
            runs: [
              { text: "ISI", font: FONT, weight: 700, sizeMm: s * 1.15, x: x + markW / 2, y: y + markH * 0.68, anchor: "middle", color: INK },
              ...it.isi.map((t, i) => ({ text: t, font: FONT, weight: i === 0 ? 700 : 400, sizeMm: s, x: x + markW + s * 0.6, y: y + lh * (i + 0.85), anchor: "start" as const, color: INK })),
            ],
          };
        },
      });
      for (const item of it.lines) textBlock(item, item.startsWith("MRP") || item.startsWith("Batch") ? 700 : 400, "start");

      const runs: TextRun[] = [];
      let marks = "";
      let col = 0;
      let top = inner.y;
      let overflow = false;
      for (const b of blocks) {
        if (top + b.h > inner.y + inner.h + 0.01 && top > inner.y) {
          col++;
          top = inner.y;
        }
        if (col >= cols || b.h > inner.h + 0.01) {
          overflow = true;
          break;
        }
        const out = b.draw(inner.x + col * (colW + gap), top);
        runs.push(...out.runs);
        marks += out.marks;
        top += b.h;
      }
      const tooWide = runs.some((r) => r.anchor === "start" && r.x + width(r.text, r.weight) > inner.x + inner.w + 0.05);
      const layout = { runs, marks, sizePt: pt, overflow: overflow || tooWide };
      if (!best || (!layout.overflow && best.overflow)) best = layout;
      if (!layout.overflow) return layout;
    }
  }
  return best!;
}

/** Sample values for the on-screen preview (real ones are filled when the order is printed). */
export function previewRegData(base: Omit<RegPanelData, "batchNo" | "mfgDate" | "bestBefore">, shelfLifeDays: number): RegPanelData {
  return {
    ...base,
    batchNo: "HL-SLM-YYMMDD-R0-B000",
    mfgDate: "DD/MM/YYYY",
    bestBefore: `${Math.round(shelfLifeDays / 30)} months from mfg`,
  };
}
