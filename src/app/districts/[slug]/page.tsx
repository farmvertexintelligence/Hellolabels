import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductCard } from "@/components/ProductCard";
import { Eyebrow } from "@/components/Squares";
import { waterProducts } from "@/lib/catalog/helpers";
import { earliestDelivery } from "@/lib/commerce/logistics";
import { DISTRICTS, districtBySlug } from "@/lib/districts";
import { getDict } from "@/lib/i18n/server";
import { getCatalog } from "@/lib/server/catalog";

export const revalidate = 3600;
export const generateStaticParams = () => DISTRICTS.map((d) => ({ slug: d.slug }));

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const d = districtBySlug((await params).slug);
  if (!d) return {};
  return {
    title: `Custom labelled water bottles in ${d.en} — weddings, shops & events`,
    description: `Packaged drinking water bottles with your own label delivered in ${d.en} district (${d.ta}). Wedding, birthday, temple festival and shop bottles. Design online in English or Tamil.`,
    alternates: { canonical: `/districts/${d.slug}` },
  };
}

export default async function DistrictPage({ params }: { params: Promise<{ slug: string }> }) {
  const d = districtBySlug((await params).slug);
  if (!d) notFound();
  const { t, lang } = await getDict();
  const catalog = await getCatalog();
  const name = lang === "ta" ? d.ta : d.en;
  const days = d.zone === 1 ? "3" : d.zone === 2 ? "4" : "5";
  return (
    <div className="wrap section">
      <Eyebrow>{t.footer.districts}</Eyebrow>
      <h1>
        {lang === "ta" ? `${name} மாவட்டத்தில் உங்கள் லேபிளுடன் தண்ணீர் பாட்டில்கள்` : `Custom labelled water bottles in ${name}`}
      </h1>
      <p className="lead">
        {lang === "ta"
          ? `திருமணம், பிறந்தநாள், கோயில் திருவிழா, கடைகள் — ${name} முழுவதும் எங்கள் லாரிகளில் டெலிவரி. ஆர்டர் செய்த சுமார் ${days} வேலை நாட்களில்.`
          : `Weddings, birthdays, temple festivals and shops — delivered across ${name} by our own trucks, about ${days} working days after you order (earliest now: ${earliestDelivery(new Date(), d.zone)}).`}
      </p>
      <div className="row" style={{ margin: "20px 0 36px" }}>
        <Link href="/design" className="btn btn-coral">✨ {t.home.ctaDesign}</Link>
        <Link href="/dealer/apply" className="btn btn-ghost">{t.nav.dealers}</Link>
      </div>
      <div className="grid grid-4">
        {waterProducts(catalog, "plastic").map((p) => <ProductCard key={p.id} p={p} catalog={catalog} t={t} lang={lang} />)}
      </div>
    </div>
  );
}
