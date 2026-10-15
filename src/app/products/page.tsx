import type { Metadata } from "next";
import Link from "next/link";
import { ProductCard } from "@/components/ProductCard";
import { Eyebrow } from "@/components/Squares";
import { labelProducts, waterProducts } from "@/lib/catalog/helpers";
import { getDict } from "@/lib/i18n/server";
import { getCatalog } from "@/lib/server/catalog";

export const revalidate = 300;
export const metadata: Metadata = {
  title: "Shop custom labelled water bottles, glass bottle labels, jar labels & stickers",
  description: "250 ml, 300 ml, 500 ml, 1 litre and 2 litre packaged drinking water bottles with your own label, in plastic or glass. Fixed prices, cases of 24.",
};

export default async function Products() {
  const { t, lang } = await getDict();
  const catalog = await getCatalog();
  const groups = [
    { id: "plastic", title: t.product.plastic, items: waterProducts(catalog, "plastic"), offset: 0 },
    { id: "glass", title: t.product.glass, items: waterProducts(catalog, "glass"), offset: 3 },
    { id: "labels", title: t.product.labelsTitle, items: labelProducts(catalog), offset: 5 },
  ];
  return (
    <div className="wrap section" style={{ paddingTop: 28 }}>
      <div data-reveal>
        <Eyebrow>{t.nav.products}</Eyebrow>
        <h1 style={{ fontSize: "clamp(1.9rem,6vw,3rem)" }}>{t.home.shopTitle}</h1>
        <p className="lead">{t.home.shopLead}</p>
      </div>
      <nav className="seg" aria-label="Categories" style={{ position: "sticky", top: 64, zIndex: 5, background: "var(--paper)", padding: "10px 0" }}>
        {groups.map((g) => <Link key={g.id} href={`#${g.id}`}>{g.title}</Link>)}
      </nav>
      {groups.map((g) => (
        <section key={g.id} id={g.id} style={{ scrollMarginTop: 130, marginTop: 28 }}>
          <h2 style={{ fontSize: "1.4rem" }} data-reveal>{g.title}</h2>
          <div className="pgrid">
            {g.items.map((p, i) => (
              <div key={p.id} data-reveal style={{ "--d": i } as React.CSSProperties}>
                <ProductCard p={p} catalog={catalog} t={t} lang={lang} index={i + g.offset} />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
