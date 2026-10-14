import Link from "next/link";
import { findLabelSize, findPrice } from "@/lib/catalog/helpers";
import type { Catalog, Product } from "@/lib/catalog/types";
import { formatInr } from "@/lib/commerce/pricing";
import type { Dict, Lang } from "@/lib/i18n/dict";
import { BottleIcon } from "./BottleIcon";

export function ProductCard({ p, catalog, t, lang }: { p: Product; catalog: Catalog; t: Dict; lang: Lang }) {
  const ev = findPrice(catalog, p, "event");
  const sh = findPrice(catalog, p, "shop");
  const size = findLabelSize(catalog, p.labelSizeIds[0]);
  return (
    <Link href={`/products/${p.slug}`} className="card card-link stack">
      <div style={{ display: "grid", placeItems: "center", height: 130 }}>
        {p.kind === "water_bottle" ? (
          <BottleIcon volumeMl={p.volumeMl!} glass={p.bottleType === "glass"} />
        ) : (
          <div style={{ width: 90, height: 64, borderRadius: 10, background: "linear-gradient(135deg, var(--yellow), var(--coral))", boxShadow: "var(--shadow)" }} />
        )}
      </div>
      <h3 style={{ fontSize: "1.05rem", margin: 0 }}>{lang === "ta" ? p.nameTa : p.nameEn}</h3>
      {size && <div className="tiny">{t.product.labelSize}: {size.widthMm} × {size.heightMm} mm</div>}
      <div className="small ink">
        {p.kind === "water_bottle" ? (
          <>
            {ev && <div>{t.product.priceEvent}: <b>{formatInr(ev.unitPricePaise)}</b> / {t.product.perBottle}</div>}
            {sh && <div>{t.product.priceShop}: <b>{formatInr(sh.unitPricePaise)}</b> / {t.product.perBottle}</div>}
          </>
        ) : (
          ev && <div>{formatInr(ev.unitPricePaise)} / {t.product.perLabel}</div>
        )}
      </div>
    </Link>
  );
}
