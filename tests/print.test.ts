import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { DEFAULT_CATALOG, DEFAULT_LABEL_SIZES } from "@/lib/catalog/defaults";
import { regDataFor } from "@/lib/design/regdata";
import { TEMPLATES, buildTemplate } from "@/lib/design/templates";
import { MEMJET_MAX_PRINT_WIDTH_MM, labelsToPrint, planImposition } from "@/lib/print/imposition";
import { proofPdf, rasterizeLabel, rollPdf } from "@/lib/print/pdf";

describe("imposition for the Memjet QM210D", () => {
  it("never exceeds the 215.9 mm print width and covers the quantity", () => {
    for (const s of DEFAULT_LABEL_SIZES) {
      for (const qty of [1, 240, 2473, 48000]) {
        const imp = planImposition(s.widthMm, s.heightMm, qty);
        const used = imp.offsetXMm * 2 + imp.across * imp.cellAcrossMm + (imp.across - 1) * 3;
        expect(imp.across).toBeGreaterThanOrEqual(1);
        expect(imp.across * imp.cellAcrossMm).toBeLessThanOrEqual(MEMJET_MAX_PRINT_WIDTH_MM);
        expect(used).toBeCloseTo(imp.rollWidthMm, 5);
        expect(imp.labelsPrinted).toBeGreaterThanOrEqual(qty);
      }
    }
  });
  it("turns wide wrap labels sideways and fits several across", () => {
    const imp = planImposition(212, 55, 2400); // 500 ml wrap label
    expect(imp.rotated).toBe(true);
    expect(imp.across).toBeGreaterThanOrEqual(2);
    const big = planImposition(322, 90, 1000); // 2 litre wrap: longer than the print width
    expect(big.rotated).toBe(true);
    // On the widest roll, three 500 ml labels fit across.
    const wide = planImposition(212, 55, 2400, { rollWidthsMm: [215.9], sideMarginMm: 3, gapMm: 3, bleedMm: 2, allowRotate: true, maxFrameLengthMm: 600 });
    expect(wide.across).toBe(3);
  });
  it("chooses the layout that uses the least stock", () => {
    const imp = planImposition(50, 50, 5000);
    for (const w of [215.9, 200, 160, 130, 108]) {
      const fixed = planImposition(50, 50, 5000, { rollWidthsMm: [w], sideMarginMm: 3, gapMm: 3, bleedMm: 2, allowRotate: true, maxFrameLengthMm: 600 });
      expect(imp.rollWidthMm * imp.rollLengthMm).toBeLessThanOrEqual(fixed.rollWidthMm * fixed.rollLengthMm + 1e-6);
    }
  });
  it("adds spoilage", () => {
    expect(labelsToPrint(240, 3)).toBe(248);
  });
});

describe("print files", () => {
  const s = DEFAULT_LABEL_SIZES.find((x) => x.id === "pet-250")!;
  const t = TEMPLATES.find((x) => x.id === "wedding")!;
  const input = {
    design: buildTemplate(t, 1, t.defaults.ta, s, "event"),
    size: s,
    segment: "event" as const,
    reg: regDataFor(DEFAULT_CATALOG, "water-250-plastic", { batchNo: "HL261014-00001", mfg: new Date("2026-10-14T05:00:00Z") }),
    adHref: null,
    images: new Map<string, string>(),
    minTextPt: 6,
    dpi: 300,
  };

  it("renders a CMYK image at ≥300 DPI including the 2 mm bleed", async () => {
    const { jpeg, pxWidth } = await rasterizeLabel(input);
    const meta = await sharp(jpeg).metadata();
    expect(meta.space).toBe("cmyk");
    expect(meta.channels).toBe(4);
    expect(pxWidth / ((s.widthMm + 4) / 25.4)).toBeGreaterThanOrEqual(299);
  });
  it("makes a proof with crop marks and a roll layout as wide as the roll", async () => {
    const proof = await PDFDocument.load(await proofPdf(input, "test"));
    const page = proof.getPage(0);
    expect(page.getWidth()).toBeCloseTo(((s.widthMm + 24) * 72) / 25.4, 1);
    const { pdf, imposition } = await rollPdf(input, 500, "test");
    const roll = await PDFDocument.load(pdf);
    expect(roll.getPage(0).getWidth()).toBeCloseTo((imposition.rollWidthMm * 72) / 25.4, 1);
    expect(imposition.frames * imposition.labelsPerFrame).toBeGreaterThanOrEqual(500);
  });
});
