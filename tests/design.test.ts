import { describe, expect, it } from "vitest";
import { DEFAULT_CATALOG, DEFAULT_LABEL_SIZES } from "@/lib/catalog/defaults";
import { designsFromBrief, detectTemplate, parseBrief, parseDate } from "@/lib/design/brief";
import { imageDpi, runChecks } from "@/lib/design/checks";
import { contrastRatio } from "@/lib/design/color";
import { regDataFor } from "@/lib/design/regdata";
import { sanitizeDesign } from "@/lib/design/sanitize";
import { TEMPLATES, buildTemplate } from "@/lib/design/templates";
import type { Design, TextElement } from "@/lib/design/types";
import { AD_SHARE, BLEED_MM, SAFE_MM, computeZones, contains, intersects } from "@/lib/design/zones";
import { serverMeasure } from "@/lib/print/server-fonts";

const size = (id: string) => DEFAULT_LABEL_SIZES.find((s) => s.id === id)!;
const reg = regDataFor(DEFAULT_CATALOG, "water-500-plastic");

describe("zones", () => {
  it("reserves bleed, safe area, regulatory panel and the 20% shop ad strip", () => {
    const s = size("pet-500");
    const z = computeZones(s, "shop");
    expect(z.design.w).toBe(z.design.h); // the customer's design area is a square
    expect(z.design.w).toBe(s.widthMm - 2 * SAFE_MM);
    expect(z.regPanel!.y + z.regPanel!.h).toBeCloseTo(s.heightMm, 5); // panel runs to the bottom edge
    expect(z.adStrip!.y).toBeLessThan(z.regPanel!.y); // ad strip sits between the square and the panel
    expect(z.bleed.w).toBe(s.widthMm + 2 * BLEED_MM);
    expect(z.safe.x).toBe(SAFE_MM);
    expect(z.adStrip!.w * z.adStrip!.h).toBeCloseTo(s.widthMm * s.heightMm * AD_SHARE, 0);
    expect(z.regPanel).not.toBeNull();
    expect(contains(z.safe, z.design)).toBe(true);
    for (const l of z.locked) expect(intersects(z.design, l.box)).toBe(false);
    expect(computeZones(s, "event").adStrip).toBeNull();
  });
  it("puts the regulatory panel as a bottom band on flat labels", () => {
    const flat = { ...size("jar-front"), hasRegPanel: true, heightMm: 120 };
    const z = computeZones(flat, "event");
    expect(z.regPanel!.y + z.regPanel!.h).toBe(flat.heightMm);
    expect(z.design.y + z.design.h).toBeLessThanOrEqual(z.regPanel!.y - SAFE_MM + 1e-9);
  });
});

describe("templates", () => {
  // Every ready template must pass every print check on every label size it can be used on.
  for (const s of DEFAULT_LABEL_SIZES) {
    for (const t of TEMPLATES) {
      for (const lang of ["en", "ta"] as const) {
        it(`${t.id} fits ${s.id} (${lang})`, () => {
          for (let i = 0; i < 4; i++) {
            const segment = s.hasRegPanel ? (t.segment === "shop" ? "shop" : "event") : "label";
            const d = buildTemplate(t, i, t.defaults[lang], s, segment);
            const r = runChecks(d, { size: s, segment, reg: s.hasRegPanel ? reg : null, measure: serverMeasure, minTextPt: 6 });
            expect(r.issues.filter((x) => x.level === "error"), `${t.id} style ${i}`).toEqual([]);
          }
        });
      }
    }
  }
});

describe("checks", () => {
  const s = size("pet-500");
  const base = (els: Design["elements"]): Design => ({ v: 1, labelSizeId: s.id, segment: "event", background: { color: "#FFFFFF" }, elements: els });
  const z = computeZones(s, "event");
  const text = (p: Partial<TextElement>): TextElement => ({ id: "t", type: "text", x: z.design.x + 5, y: z.design.y + 5, w: z.design.w - 10, h: 15, text: "Priya & Arun", font: "dmsans", weight: 700, sizePt: 20, color: "#141A26", align: "center", lineHeight: 1.15, autoFit: true, ...p });
  const opts = { size: s, segment: "event" as const, reg, measure: serverMeasure, minTextPt: 6 };

  it("passes a clean design", () => {
    expect(runChecks(base([text({})]), opts).ok).toBe(true);
  });
  it("catches tiny text", () => {
    const r = runChecks(base([text({ sizePt: 4, autoFit: false })]), opts);
    expect(r.issues.some((i) => i.check === "text-size" && i.level === "error")).toBe(true);
  });
  it("catches text outside the safe area", () => {
    const r = runChecks(base([text({ x: 0.5 })]), opts);
    expect(r.issues.some((i) => i.check === "safe-area")).toBe(true);
  });
  it("catches anything covering the regulatory panel", () => {
    const r = runChecks(base([text({ y: z.regPanel!.y - 5 })]), opts);
    expect(r.issues.some((i) => i.check === "regulatory")).toBe(true);
  });
  it("catches low contrast", () => {
    const r = runChecks(base([text({ color: "#F0F0F0" })]), opts);
    expect(r.issues.some((i) => i.check === "contrast" && i.level === "error")).toBe(true);
    expect(contrastRatio("#141A26", "#FFFFFF")).toBeGreaterThan(15);
  });
  it("catches low-resolution photos", () => {
    const img = { id: "i", type: "image" as const, x: z.design.x, y: z.design.y, w: 40, h: 40, src: "uploads/x.jpg", pxWidth: 200, pxHeight: 200, fit: "cover" as const };
    expect(imageDpi(img)).toBe(126); // 200 px over 40 mm
    const r = runChecks(base([img]), opts);
    expect(r.issues.find((i) => i.check === "image-quality")?.level).toBe("error");
    expect(runChecks(base([{ ...img, pxWidth: 600, pxHeight: 600 }]), opts).issues.find((i) => i.check === "image-quality")).toBeUndefined();
  });
});

describe("sanitize", () => {
  it("cleans untrusted AI/browser JSON and keeps content inside the design area", () => {
    const s = size("pet-500");
    const z = computeZones(s, "shop");
    const d = sanitizeDesign(
      {
        background: { color: "red" },
        elements: [
          { type: "text", text: "Hi", font: "Comic Sans", x: -50, y: 0, w: 30, h: 10, sizePt: 1, color: "javascript:alert(1)" },
          { type: "image", src: "https://evil.example/x.png", x: 10, y: 10, w: 10, h: 10 },
          { type: "image", src: "uploads/ok.jpg", x: 10, y: 10, w: 10, h: 10 },
          { type: "motif", motif: "not-a-motif" },
          { type: "script" },
        ],
      },
      s,
      "shop",
      { minTextPt: 6, allowedImage: (src) => src.startsWith("uploads/") },
    );
    expect(d.background.color).toBe("#F6F3EC");
    expect(d.elements).toHaveLength(2);
    const t = d.elements[0] as TextElement;
    expect(t.font).toBe("dmsans");
    expect(t.sizePt).toBe(6);
    expect(t.color).toBe("#141A26");
    expect(t.x).toBeGreaterThanOrEqual(z.design.x);
    expect(d.elements[1].type).toBe("image");
  });
});

describe("brief", () => {
  it("understands English and Tamil briefs", () => {
    const p = parseBrief("Wedding of Priya and Arun, 8 Nov 2026, traditional red and gold", "event", "en");
    expect(p.template.id).toBe("wedding");
    expect(p.fields.title).toBe("Priya & Arun");
    expect(p.fields.date).toBe("08 Nov 2026");
    expect(p.colors).toContain("#D4A437");
    expect(detectTemplate("இனிய பொங்கல் வாழ்த்துக்கள் செல்வம் குடும்பம்", "event").id).toBe("pongal");
    expect(detectTemplate("Sri Murugan Bakery water bottles", "event").id).toBe("shop");
    expect(parseDate("14/01/2027")).toBe("14 Jan 2027");
  });
  it("returns four different designs", () => {
    const ds = designsFromBrief("Birthday of Aadhya, 14 Dec", size("pet-500"), "event", "en");
    expect(ds).toHaveLength(4);
    expect(new Set(ds.map((d) => JSON.stringify(d.background))).size).toBeGreaterThan(1);
  });
});
