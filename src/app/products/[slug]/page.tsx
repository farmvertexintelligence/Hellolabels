import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductCard } from "@/components/ProductCard";
import { FlipCard } from "@/components/shop/Interactive";
import { LabelBottle } from "@/components/shop/LabelBottle";
import { Eyebrow } from "@/components/Squares";
import { findLabelSize, findPrice, findProductBySlug, GLASS_PACKING_NOTE, notSellableReason } from "@/lib/catalog/helpers";
import { DEFAULT_PRODUCTS } from "@/lib/catalog/defaults";
import { TEMPLATES } from "@/lib/design/templates";
import { BLEED_MM } from "@/lib/design/zones";
import { getDict } from "@/lib/i18n/server";
import { getCatalog } from "@/lib/server/catalog";
import { BuyBox } from "./BuyBox";

export const revalidate = 300;

export function generateStaticParams() {
  return DEFAULT_PRODUCTS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const p = findProductBySlug(await getCatalog(), slug);
  if (!p) return {};
  return {
    title: `${p.nameEn} with your own label`,
    description: `${p.nameEn} printed with your names, logo or photo. Designed online with AI in English or Tamil, printed in Mettur and delivered across Tamil Nadu.`,
    alternates: { canonical: `/products/${p.slug}` },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { t, lang } = await getDict();
  const catalog = await getCatalog();
  const p = findProductBySlug(catalog, slug);
  if (!p || !p.active) notFound();
  const size = findLabelSize(catalog, p.labelSizeIds[0])!;
  const ev = findPrice(catalog, p, "event");
  const sh = findPrice(catalog, p, "shop");
  const lb = findPrice(catalog, p, "label");
  const closed = Boolean(notSellableReason(catalog, p, p.kind === "label_only" ? "label" : "event"));
  const name = lang === "ta" ? p.nameTa : p.nameEn;
  const water = p.kind === "water_bottle";
  const pv = (id: string, s: number, l: string = lang) => `/api/preview?t=${id}&s=${s}&size=${size.id}&lang=${l}&w=360`;
  const related = catalog.products.filter((x) => x.active && x.id !== p.id && x.kind === p.kind && x.bottleType === p.bottleType).slice(0, 4);
  const ld = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.nameEn,
    brand: { "@type": "Brand", name: "hellolabels" },
    description: `${p.nameEn} with a custom printed label`,
    offers: ev && !closed ? { "@type": "Offer", priceCurrency: "INR", price: (ev.unitPricePaise / 100).toFixed(2), availability: "https://schema.org/InStock" } : undefined,
  };
  return (
    <div className="wrap section" style={{ paddingTop: 20 }}>
      <nav className="small" aria-label="Breadcrumb"><Link href="/products" className="link">{t.product.allProducts}</Link> / {name}</nav>
      <div className="pdp">
        <div className="pdp-gallery" data-reveal>
          <div className="pdp-stage">
            <LabelBottle
              labels={TEMPLATES.slice(0, 4).map((tp, i) => ({ src: pv(tp.id, i, i % 2 ? "ta" : lang), alt: `${tp.en} label on ${p.nameEn}` }))}
              labelMm={{ w: size.widthMm + 2 * BLEED_MM, h: size.heightMm + 2 * BLEED_MM }}
              volumeMl={water ? (p.volumeMl ?? 500) : 250}
              diameterMm={size.diameterMm ?? 70}
              glass={p.bottleType === "glass"}
              width={190}
            />
          </div>
          <p className="tiny center">{t.product.labelSize}: {size.widthMm} × {size.heightMm} mm · {t.product.capsWhite}</p>
        </div>
        <div className="stack" data-reveal style={{ "--d": 1 } as React.CSSProperties}>
          <Eyebrow>{water ? t.product.waterTitle : t.product.labelsTitle}</Eyebrow>
          <h1 style={{ fontSize: "clamp(1.8rem,5vw,2.8rem)" }}>{name}</h1>
          <BuyBox product={p} prices={{ event: ev?.unitPricePaise, shop: sh?.unitPricePaise, label: lb?.unitPricePaise }} closed={closed} />
          {p.bottleType === "glass" && <div className="note">🫧 {GLASS_PACKING_NOTE[lang]}</div>}
          <ul className="trust">{t.home.trust.map((x) => <li key={x}>{x}</li>)}</ul>
        </div>
      </div>

      <section style={{ marginTop: 48 }}>
        <h2 style={{ fontSize: "1.5rem" }} data-reveal>{t.home.templatesTitle}</h2>
        <div className="flip-row">
          {TEMPLATES.map((tp, i) => (
            <div key={tp.id} data-reveal style={{ "--d": i % 4 } as React.CSSProperties}>
              <FlipCard
                // eslint-disable-next-line @next/next/no-img-element
                front={<img src={pv(tp.id, (i + 1) % 4)} alt={`${tp.en} template on ${p.nameEn}`} loading="lazy" />}
                title={lang === "ta" ? tp.ta : tp.en}
                sub={`${size.widthMm} × ${size.heightMm} mm`}
                href={`/design?product=${p.id}&template=${tp.id}`}
                cta={t.home.useDesign}
                color={["#8E1B1B", "#7B5CF0", "#2E5E3A", "#141A26", "#B22A12", "#0E6BA8", "#C1440E", "#2A0F4A", "#1B5E20"][i]}
              />
            </div>
          ))}
        </div>
      </section>

      {related.length > 0 && (
        <section style={{ marginTop: 40 }}>
          <h2 style={{ fontSize: "1.5rem" }} data-reveal>{t.product.allProducts}</h2>
          <div className="pgrid">
            {related.map((r, i) => <div key={r.id} data-reveal style={{ "--d": i } as React.CSSProperties}><ProductCard p={r} catalog={catalog} t={t} lang={lang} index={i + 2} /></div>)}
          </div>
        </section>
      )}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
    </div>
  );
}
