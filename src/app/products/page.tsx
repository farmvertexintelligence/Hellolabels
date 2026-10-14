import type { Metadata } from "next";
import { ProductCard } from "@/components/ProductCard";
import { Eyebrow } from "@/components/Squares";
import { labelProducts, waterProducts } from "@/lib/catalog/helpers";
import { getDict } from "@/lib/i18n/server";
import { getCatalog } from "@/lib/server/catalog";

export const revalidate = 300;
export const metadata: Metadata = {
  title: "Custom labelled water bottles, glass bottle labels, jar labels & stickers",
  description: "250 ml, 300 ml, 500 ml, 1 litre and 2 litre packaged drinking water bottles with your own label, in plastic or glass. Fixed prices, cases of 24.",
};

export default async function Products() {
  const { t, lang } = await getDict();
  const catalog = await getCatalog();
  return (
    <div className="wrap section">
      <Eyebrow>{t.nav.products}</Eyebrow>
      <h1>{t.product.waterTitle}</h1>
      <p className="lead">{t.home.sizesLead} {t.product.bottlesPerCase}.</p>
      <h2 style={{ fontSize: "1.3rem", marginTop: 32 }}>{t.product.plastic}</h2>
      <div className="grid grid-4">
        {waterProducts(catalog, "plastic").map((p) => <ProductCard key={p.id} p={p} catalog={catalog} t={t} lang={lang} />)}
      </div>
      <h2 style={{ fontSize: "1.3rem", marginTop: 32 }}>{t.product.glass}</h2>
      <div className="grid grid-4">
        {waterProducts(catalog, "glass").map((p) => <ProductCard key={p.id} p={p} catalog={catalog} t={t} lang={lang} />)}
      </div>
      <h2 id="labels" style={{ marginTop: 48 }}>{t.product.labelsTitle}</h2>
      <div className="grid grid-3">
        {labelProducts(catalog).map((p) => <ProductCard key={p.id} p={p} catalog={catalog} t={t} lang={lang} />)}
      </div>
    </div>
  );
}
