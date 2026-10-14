import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { describe, expect, it } from "vitest";
import { DEFAULT_LABEL_SIZES } from "@/lib/catalog/defaults";
import { sanitizeDesign } from "@/lib/design/sanitize";
import { computeZones } from "@/lib/design/zones";
import { FourDesigns, OneDesign, toRaw } from "@/lib/server/ai-designer";

type Raw = Parameters<typeof toRaw>[0];

describe("AI designer output", () => {
  it("schemas compile to structured-output formats", () => {
    expect(() => betaZodOutputFormat(FourDesigns)).not.toThrow();
    expect(() => betaZodOutputFormat(OneDesign)).not.toThrow();
  });

  it("turns a model response into a valid design inside the square", () => {
    const size = DEFAULT_LABEL_SIZES.find((s) => s.id === "pet-500")!;
    const sample = {
      name: "Temple gold",
      background: { color: "#8E1B1B", color2: "", gradient: "none" as const },
      elements: [
        { type: "text" as const, name: "names", role: "content" as const, x: 5, y: 20, w: 52, h: 14, rotation: 0, text: "பிரியா & அருண்", font: "arima", weight: 700, sizePt: 30, color: "#F8E7C2", color2: "", align: "center" as const, uppercase: false, letterSpacing: 0, shape: "none" as const, stroke: "", strokeMm: 0, radiusMm: 0, motif: "none", imageAsset: -1, circle: false },
        { type: "motif" as const, name: "border", role: "background" as const, x: 2, y: 2, w: 58, h: 58, rotation: 0, text: "", font: "none", weight: 400, sizePt: 0, color: "#D4A437", color2: "#F3C969", align: "center" as const, uppercase: false, letterSpacing: 0, shape: "none" as const, stroke: "", strokeMm: 0, radiusMm: 0, motif: "border-temple", imageAsset: -1, circle: false },
        { type: "text" as const, name: "too low", role: "content" as const, x: 5, y: 100, w: 52, h: 10, rotation: 0, text: "8 Nov 2026", font: "dmsans", weight: 700, sizePt: 14, color: "#FFFFFF", color2: "", align: "center" as const, uppercase: false, letterSpacing: 0, shape: "none" as const, stroke: "", strokeMm: 0, radiusMm: 0, motif: "none", imageAsset: -1, circle: false },
      ],
    };
    const d = sanitizeDesign(toRaw(sample as unknown as Raw, []), size, "event", { minTextPt: 6 });
    const z = computeZones(size, "event");
    expect(d.elements).toHaveLength(3);
    const low = d.elements[2];
    // Content the model placed over the regulatory panel is pulled back into the square.
    expect(low.y + low.h).toBeLessThanOrEqual(z.design.y + z.design.h + 1e-6);
  });
});
