import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BottleIcon } from "@/components/BottleIcon";
import { Eyebrow } from "@/components/Squares";
import { findLabelSize, findPrice, findProductBySlug, GLASS_PACKING_NOTE, notSellableReason } from "@/lib/catalog/helpers";
import { DEFAULT_PRODUCTS } from "@/lib/catalog/defaults";
import { formatInr } from "@/lib/commerce/pricing";
import { TEMPLATES } from "@/lib/design/templates";
import { getDict } from "@/lib/i18n/server";
import { getCatalog } from "@/lib/server/catalog";

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
  const size = findLabelSize(catalog, p.labelSizeIds[0]);
  const ev = findPrice(catalog, p, "event");
  const sh = findPrice(catalog, p, "shop");
  const closed = notSellableReason(catalog, p, p.kind === "label_only" ? "label" : "event");
  const name = lang === "ta" ? p.nameTa : p.nameEn;
  const ld = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.nameEn,
    brand: { "@type": "Brand", name: "hellolabels" },
    description: `${p.nameEn} with a custom printed label`,
    offers: ev && !closed ? { "@type": "Offer", priceCurrency: "INR", price: (ev.unitPricePaise / 100).toFixed(2), availability: "https://schema.org/InStock" } : undefined,
  };
  return (
    <div className="wrap section">
      <nav className="small" aria-label="Breadcrumb"><Link href="/products" className="link">{t.product.allProducts}</Link> / {name}</nav>
      <div className="hero-grid" style={{ marginTop: 20 }}>
        <div className="card" style={{ display: "grid", placeItems: "center", minHeight: 280 }}>
          {p.kind === "water_bottle" ? <BottleIcon volumeMl={p.volumeMl!} glass={p.bottleType === "glass"} height={240} /> : (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="label-thumb" src={`/api/preview?t=birthday&s=2&size=${size?.id}&lang=${lang}&w=400`} alt="" width={400} style={{ width: "55%" }} />
          )}
        </div>
        <div className="stack">
          <Eyebrow>{p.kind === "water_bottle" ? t.product.waterTitle : t.product.labelsTitle}</Eyebrow>
          <h1 style={{ fontSize: "clamp(1.8rem,5vw,2.8rem)" }}>{name}</h1>
          <div className="card stack">
            {p.kind === "water_bottle" ? (
              <>
                {ev && <div className="row between"><span>{t.product.priceEvent}</span><b className="ink">{formatInr(ev.unitPricePaise)} <span className="tiny">/ {t.product.perBottle}</span></b></div>}
                {sh && <div className="row between"><span>{t.product.priceShop}</span><b className="ink">{formatInr(sh.unitPricePaise)} <span className="tiny">/ {t.product.perBottle}</span></b></div>}
                <div className="row between"><span>{t.product.minOrder}</span><b className="ink">{p.minQty} {t.product.cases} ({p.minQty * p.caseSize} {t.order.bottles})</b></div>
                <div className="tiny">{t.product.bottlesPerCase} · {t.product.capsWhite} · {t.product.gstIncl}</div>
              </>
            ) : (
              <>
                {ev && <div className="row between"><span>{t.product.priceLabel}</span><b className="ink">{formatInr(ev.unitPricePaise)}</b></div>}
                <div className="row between"><span>{t.product.minOrder}</span><b className="ink">{p.minQty} {t.order.labels}</b></div>
              </>
            )}
            {size && <div className="row between"><span>{t.product.labelSize}</span><b className="ink">{p.labelSizeIds.map((id) => { const s = findLabelSize(catalog, id)!; return `${s.widthMm} × ${s.heightMm} mm`; }).join(" · ")}</b></div>}
          </div>
          {p.bottleType === "glass" && <div className="note">🫧 {GLASS_PACKING_NOTE[lang]}</div>}
          {closed && <div className="note note-warn small">{t.product.notSellable}</div>}
          <div className="row">
            <Link className="btn btn-coral" href={`/design?product=${p.id}&segment=event`}>✨ {t.product.designThis}</Link>
            {p.kind === "water_bottle" && <Link className="btn btn-ghost" href={`/design?product=${p.id}&segment=shop&template=shop`}>{t.home.segments[1].cta}</Link>}
          </div>
        </div>
      </div>
      {size && (
        <section style={{ marginTop: 48 }}>
          <h2 style={{ fontSize: "1.4rem" }}>{t.home.templatesTitle}</h2>
          <div className="label-grid">
            {TEMPLATES.slice(0, 4).map((tp, i) => (
              <Link key={tp.id} href={`/design?product=${p.id}&template=${tp.id}`} className="card-link">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/preview?t=${tp.id}&s=${i}&size=${size.id}&lang=${lang}&w=360`} alt={`${tp.en} template on ${p.nameEn}`} loading="lazy" />
              </Link>
            ))}
          </div>
        </section>
      )}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
    </div>
  );
}
