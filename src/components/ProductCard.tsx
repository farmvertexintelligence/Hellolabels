import Link from "next/link";
import { findLabelSize, findPrice } from "@/lib/catalog/helpers";
import type { Catalog, Product } from "@/lib/catalog/types";
import { formatInr } from "@/lib/commerce/pricing";
import { TEMPLATES } from "@/lib/design/templates";
import type { Dict, Lang } from "@/lib/i18n/dict";
import { BLEED_MM } from "@/lib/design/zones";
import { Tilt } from "./shop/Interactive";
import { LabelBottle } from "./shop/LabelBottle";

/** E-commerce product card: the bottle in 3D with a sample label, price per bottle and per case. */
export function ProductCard({ p, catalog, t, lang, index = 0 }: { p: Product; catalog: Catalog; t: Dict; lang: Lang; index?: number }) {
  const ev = findPrice(catalog, p, "event");
  const sh = findPrice(catalog, p, "shop");
  const size = findLabelSize(catalog, p.labelSizeIds[0]);
  const water = p.kind === "water_bottle";
  const from = Math.min(...[ev, sh].filter(Boolean).map((x) => x!.unitPricePaise));
  const tpl = TEMPLATES[index % TEMPLATES.length];
  const badge = p.bottleType === "glass" && water ? t.home.badgeGlass : water && (p.volumeMl ?? 0) >= 1000 ? t.home.badgeBulk : null;
  return (
    <Tilt className="pcard" >
      <Link href={`/products/${p.slug}`} className="pcard-media" aria-label={lang === "ta" ? p.nameTa : p.nameEn}>
        {badge && <span className="pcard-badge">{badge}</span>}
        {size && (
          <LabelBottle
            labels={[{ src: `/api/preview?t=${tpl.id}&s=${index % 4}&size=${size.id}&lang=${lang}&w=300`, alt: "" }]}
            angle={-10}
            labelMm={{ w: size.widthMm + 2 * BLEED_MM, h: size.heightMm + 2 * BLEED_MM }}
            volumeMl={water ? (p.volumeMl ?? 500) : 250}
            diameterMm={size.diameterMm ?? 70}
            glass={p.bottleType === "glass"}
            width={water ? 74 + Math.min(40, (p.volumeMl ?? 500) / 60) : 96}
          />
        )}
      </Link>
      <div className="pcard-body">
        <Link href={`/products/${p.slug}`} className="pcard-title">{lang === "ta" ? p.nameTa : p.nameEn}</Link>
        <div className="pcard-meta">
          {water ? `24 × · ${t.home.minCases} ${p.minQty} ${t.product.cases}` : `${t.home.minCases} ${p.minQty} ${t.order.labels}`}
          {size && ` · ${size.widthMm}×${size.heightMm} mm`}
        </div>
        {Number.isFinite(from) && (
          <div className="pcard-price">
            <span className="tiny">{t.home.from}</span> <b>{formatInr(from)}</b>
            <span className="tiny"> / {water ? t.product.perBottle : t.product.perLabel}</span>
            {water && <div className="tiny muted">{formatInr(from * p.caseSize)} {t.home.perCase}</div>}
          </div>
        )}
        <div className="pcard-actions">
          <Link className="btn btn-coral btn-sm" href={`/design?product=${p.id}`}>✨ {t.home.designLabel}</Link>
          <Link className="btn btn-ghost btn-sm" href={`/products/${p.slug}`}>{t.home.details}</Link>
        </div>
      </div>
    </Tilt>
  );
}
