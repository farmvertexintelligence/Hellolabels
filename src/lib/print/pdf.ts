import "server-only";
import { Resvg } from "@resvg/resvg-js";
import { PDFDocument, StandardFonts, cmyk, degrees, type PDFImage, type PDFPage } from "pdf-lib";
import sharp from "sharp";
import type { LabelSize, Segment } from "@/lib/catalog/types";
import { renderLabelSvg } from "@/lib/design/render";
import type { Design, RegPanelData } from "@/lib/design/types";
import { BLEED_MM } from "@/lib/design/zones";
import { DEFAULT_ROLL_SPEC, planImposition, type Imposition, type RollSpec } from "./imposition";
import { outlineRun, serverMeasure } from "./server-fonts";

export const PRINT_DPI = 600; // Memjet prints at 1600 dpi; 600 dpi artwork is ≥ the 300 dpi minimum.
const PT_PER_MM = 72 / 25.4;
const mm = (v: number) => v * PT_PER_MM;
const REGISTRATION = cmyk(1, 1, 1, 1);

export interface PrintInput {
  design: Design;
  size: LabelSize;
  segment: Segment;
  reg: RegPanelData | null;
  /** Data URI of the booked ad creative for Shop labels. */
  adHref: string | null;
  /** Data URIs for every image element `src` in the design. */
  images: Map<string, string>;
  minTextPt: number;
  dpi?: number;
}

/** Renders the label (with bleed) to a CMYK JPEG at print resolution. Text is converted to outlines. */
export async function rasterizeLabel(input: PrintInput): Promise<{ jpeg: Buffer; pxWidth: number; pxHeight: number; svg: string }> {
  const dpi = Math.max(300, input.dpi ?? PRINT_DPI);
  const svg = renderLabelSvg(input.design, {
    size: input.size,
    segment: input.segment,
    reg: input.reg,
    adHref: input.adHref,
    measure: serverMeasure,
    minTextPt: input.minTextPt,
    resolveImage: (src) => input.images.get(src) ?? null,
    outline: outlineRun,
    guides: false,
  });
  const widthMm = input.size.widthMm + 2 * BLEED_MM;
  const pxWidth = Math.round((widthMm / 25.4) * dpi);
  const png = new Resvg(svg, { fitTo: { mode: "width", value: pxWidth }, font: { loadSystemFonts: false }, background: "#FFFFFF" }).render().asPng();
  const img = sharp(png, { limitInputPixels: false }).flatten({ background: "#FFFFFF" });
  const meta = await img.metadata();
  // ICC-managed RGB → CMYK conversion; pdf-lib embeds the CMYK JPEG as DeviceCMYK.
  const jpeg = await img.withIccProfile("cmyk").jpeg({ quality: 92, chromaSubsampling: "4:4:4" }).toBuffer();
  return { jpeg, pxWidth: meta.width ?? pxWidth, pxHeight: meta.height ?? 0, svg };
}

function cropMarks(page: PDFPage, x: number, y: number, w: number, h: number, offset = 3, len = 5) {
  // (x, y) = bottom-left of the trim box, all in mm. Marks sit outside the bleed.
  const t = 0.25;
  const line = (x1: number, y1: number, x2: number, y2: number) =>
    page.drawLine({ start: { x: mm(x1), y: mm(y1) }, end: { x: mm(x2), y: mm(y2) }, thickness: t, color: REGISTRATION });
  for (const cx of [x, x + w]) {
    line(cx, y - offset, cx, y - offset - len);
    line(cx, y + h + offset, cx, y + h + offset + len);
  }
  for (const cy of [y, y + h]) {
    line(x - offset, cy, x - offset - len, cy);
    line(x + w + offset, cy, x + w + offset + len, cy);
  }
}

/** Single-label proof: label with 2 mm bleed, crop marks and a slug line. */
export async function proofPdf(input: PrintInput, title: string): Promise<Uint8Array> {
  const { jpeg } = await rasterizeLabel(input);
  const pdf = await PDFDocument.create();
  setMeta(pdf, title);
  const margin = 12;
  const W = input.size.widthMm;
  const H = input.size.heightMm;
  const page = pdf.addPage([mm(W + 2 * margin), mm(H + 2 * margin + 6)]);
  const img = await pdf.embedJpg(jpeg);
  const bx = margin - BLEED_MM;
  const by = margin + 6 - BLEED_MM;
  page.drawImage(img, { x: mm(bx), y: mm(by), width: mm(W + 2 * BLEED_MM), height: mm(H + 2 * BLEED_MM) });
  cropMarks(page, margin, margin + 6, W, H);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  page.drawText(`${title}  ·  trim ${W} × ${H} mm  ·  bleed ${BLEED_MM} mm  ·  CMYK ${input.dpi ?? PRINT_DPI} dpi`, {
    x: mm(margin),
    y: mm(3),
    size: 6,
    font,
    color: cmyk(0, 0, 0, 1),
  });
  return pdf.save();
}

function drawCell(page: PDFPage, img: PDFImage, imp: Imposition, col: number, row: number, frameH: number) {
  // Rows run from the top of the frame downwards; PDF y is bottom-up.
  const x = imp.offsetXMm + col * (imp.cellAcrossMm + (imp.pitchMm - imp.cellAlongMm));
  const yTop = frameH - row * imp.pitchMm - (imp.pitchMm - imp.cellAlongMm) / 2;
  if (!imp.rotated) {
    page.drawImage(img, { x: mm(x), y: mm(yTop - imp.cellAlongMm), width: mm(imp.cellAcrossMm), height: mm(imp.cellAlongMm) });
  } else {
    // Rotated 90° clockwise: the label's width runs along the roll.
    page.drawImage(img, { x: mm(x), y: mm(yTop), width: mm(imp.cellAlongMm), height: mm(imp.cellAcrossMm), rotate: degrees(-90) });
  }
}

/**
 * Roll layout for the Memjet: one page = one repeat frame, page width = roll width. The label is
 * embedded once and placed many times. Cut-line ticks are drawn in the side margins and gaps.
 */
export async function rollPdf(input: PrintInput, quantity: number, title: string, spec: RollSpec = DEFAULT_ROLL_SPEC): Promise<{ pdf: Uint8Array; imposition: Imposition }> {
  const imp = planImposition(input.size.widthMm, input.size.heightMm, quantity, { ...spec, bleedMm: BLEED_MM });
  const { jpeg } = await rasterizeLabel(input);
  const pdf = await PDFDocument.create();
  setMeta(pdf, `${title} — ${imp.frames} frame(s) × ${imp.labelsPerFrame} labels`);
  const img = await pdf.embedJpg(jpeg);
  const page = pdf.addPage([mm(imp.rollWidthMm), mm(imp.frameLengthMm)]);
  for (let r = 0; r < imp.rowsPerFrame; r++) for (let c = 0; c < imp.across; c++) drawCell(page, img, imp, c, r, imp.frameLengthMm);

  // Cut-line ticks: along the left/right margins for every row, and at the frame start for every column.
  const gap = imp.pitchMm - imp.cellAlongMm;
  const tick = (x1: number, y1: number, x2: number, y2: number) =>
    page.drawLine({ start: { x: mm(x1), y: mm(y1) }, end: { x: mm(x2), y: mm(y2) }, thickness: 0.2, color: REGISTRATION });
  const left = imp.offsetXMm;
  const right = imp.offsetXMm + imp.across * imp.cellAcrossMm + (imp.across - 1) * gap;
  const len = Math.max(0, Math.min(2.5, left - 0.5));
  for (let r = 0; r < imp.rowsPerFrame; r++) {
    const yTop = imp.frameLengthMm - r * imp.pitchMm - gap / 2 - BLEED_MM;
    const yBottom = yTop - (imp.cellAlongMm - 2 * BLEED_MM);
    for (const y of [yTop, yBottom]) {
      if (len > 0) {
        tick(left - 0.5 - len, y, left - 0.5, y);
        tick(right + 0.5, y, right + 0.5 + len, y);
      }
    }
  }
  return { pdf: await pdf.save(), imposition: imp };
}

function setMeta(pdf: PDFDocument, title: string) {
  pdf.setTitle(title);
  pdf.setAuthor("hellolabels");
  pdf.setCreator("hellolabels print engine");
  pdf.setProducer("hellolabels");
  pdf.setSubject("Print-ready label artwork: CMYK, 2 mm bleed, crop marks");
}
