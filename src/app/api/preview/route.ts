import { Resvg } from "@resvg/resvg-js";
import { NextResponse, type NextRequest } from "next/server";
import { findLabelSize } from "@/lib/catalog/helpers";
import { regDataFor } from "@/lib/design/regdata";
import { renderLabelSvg } from "@/lib/design/render";
import { TEMPLATES, buildTemplate } from "@/lib/design/templates";
import { outlineRun, serverMeasure } from "@/lib/print/server-fonts";
import { getCatalog } from "@/lib/server/catalog";

export const runtime = "nodejs";

/** PNG thumbnail of a ready template on a label size: /api/preview?t=wedding&s=0&size=pet-500&lang=ta&w=720 */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const def = TEMPLATES.find((x) => x.id === q.get("t")) ?? TEMPLATES[0];
  const style = Math.min(3, Math.max(0, Number(q.get("s") ?? 0) | 0));
  const lang = q.get("lang") === "ta" ? "ta" : "en";
  const width = Math.min(1200, Math.max(200, Number(q.get("w") ?? 720) | 0));
  const catalog = await getCatalog();
  const size = findLabelSize(catalog, q.get("size") ?? "pet-500") ?? findLabelSize(catalog, "pet-500")!;
  const segment = def.segment === "shop" && size.wraps ? "shop" : size.hasRegPanel ? "event" : "label";
  const design = buildTemplate(def, style, def.defaults[lang], size, segment);
  const productId = catalog.products.find((p) => p.labelSizeIds.includes(size.id))?.id ?? "water-500-plastic";
  const svg = renderLabelSvg(design, {
    size,
    segment,
    reg: size.hasRegPanel ? regDataFor(catalog, productId) : null,
    adHref: null,
    measure: serverMeasure,
    minTextPt: catalog.settings.minTextPt,
    resolveImage: () => null,
    outline: outlineRun,
    lang,
  });
  const png = new Resvg(svg, { fitTo: { mode: "width", value: width }, font: { loadSystemFonts: false } }).render().asPng();
  return new NextResponse(new Uint8Array(png), {
    headers: { "content-type": "image/png", "cache-control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=604800" },
  });
}
