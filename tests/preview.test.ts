// Renders every template for a few label sizes to PNG when PREVIEW_DIR is set (visual review aid).
import fs from "node:fs";
import path from "node:path";
import { Resvg } from "@resvg/resvg-js";
import { describe, it } from "vitest";
import { DEFAULT_LABEL_SIZES, DEFAULT_REGULATORY } from "@/lib/catalog/defaults";
import { previewRegData } from "@/lib/design/regpanel";
import { renderLabelSvg } from "@/lib/design/render";
import { TEMPLATES, buildTemplate } from "@/lib/design/templates";
import { outlineRun, serverMeasure } from "@/lib/print/server-fonts";

const dir = process.env.PREVIEW_DIR;
describe.skipIf(!dir)("template previews", () => {
  it("renders", () => {
    fs.mkdirSync(dir!, { recursive: true });
    for (const sizeId of process.env.PREVIEW_SIZES?.split(",") ?? ["pet-500", "jar-front"]) {
      const size = DEFAULT_LABEL_SIZES.find((s) => s.id === sizeId)!;
      for (const t of TEMPLATES) {
        const segment = t.segment;
        const rows: string[] = [];
        for (let i = 0; i < 4; i++) {
          const d = buildTemplate(t, i, t.defaults[i % 2 ? "ta" : "en"], size, segment);
          const svg = renderLabelSvg(d, {
            size, segment, adHref: null, measure: serverMeasure, minTextPt: 6, resolveImage: () => null, outline: outlineRun, guides: process.env.PREVIEW_GUIDES === "1",
            reg: size.hasRegPanel ? previewRegData({ ...DEFAULT_REGULATORY, volumeMl: 500, mrpPaise: 2000 }, 180) : null,
          });
          rows.push(svg);
        }
        const png = rows.map((svg) => new Resvg(svg, { fitTo: { mode: "width", value: 300 } }).render());
        const h = Math.max(...png.map((p) => p.height));
        let x = 0;
        const imgs = png.map((p) => { const s = `<image href="data:image/png;base64,${p.asPng().toString("base64")}" x="${x}" y="0" width="${p.width}" height="${p.height}"/>`; x += p.width + 10; return s; }).join("");
        const sheet = new Resvg(`<svg xmlns="http://www.w3.org/2000/svg" width="${x}" height="${h}"><rect width="${x}" height="${h}" fill="#888"/>${imgs}</svg>`).render().asPng();
        fs.writeFileSync(path.join(dir!, `${sizeId}-${t.id}.png`), sheet);
      }
    }
  });
});
