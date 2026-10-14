import Link from "next/link";
import { BottleIcon } from "@/components/BottleIcon";
import { Eyebrow } from "@/components/Squares";
import { findPrice, waterProducts } from "@/lib/catalog/helpers";
import { formatInr } from "@/lib/commerce/pricing";
import { TEMPLATES } from "@/lib/design/templates";
import { getDict } from "@/lib/i18n/server";
import { getCatalog } from "@/lib/server/catalog";

export const revalidate = 300;

const SEG_LINKS = ["/design?segment=event", "/design?segment=shop&template=shop", "/products?for=bulk", "/products#labels"];
const SEG_COLORS = ["var(--coral)", "var(--teal)", "var(--purple)", "var(--yellow)"];

export default async function Home() {
  const { t, lang } = await getDict();
  const catalog = await getCatalog();
  const bottles = waterProducts(catalog, "plastic");

  return (
    <>
      <section className="hero">
        <div className="wrap hero-grid">
          <div>
            <Eyebrow>{t.home.eyebrow}</Eyebrow>
            <h1>{t.home.title}</h1>
            <p className="lead">{t.home.lead}</p>
            <div className="row" style={{ marginTop: 24 }}>
              <Link href="/design" className="btn btn-coral">
                ✨ {t.home.ctaDesign}
              </Link>
              <Link href="/products" className="btn btn-ghost">
                {t.home.ctaProducts}
              </Link>
            </div>
            <ul className="trust">
              {t.home.trust.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </div>
          <div className="label-frame">
            <div className="grid" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
              {[
                ["wedding", 0, "Wedding label"],
                ["shop", 0, "Shop label with the local ad strip"],
                ["pongal", 1, "Pongal label"],
              ].map(([id, st, alt], i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={id as string} className="label-thumb" src={`/api/preview?t=${id}&s=${st}&size=pet-500&lang=${lang}&w=360`} alt={alt as string} width={360} height={680} fetchPriority={i === 0 ? "high" : "auto"} />
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <Eyebrow>{t.home.forWho}</Eyebrow>
          <div className="grid grid-4">
            {t.home.segments.map((s, i) => (
              <Link key={s.title} href={SEG_LINKS[i]} className="card card-link stack">
                <span style={{ width: 36, height: 6, borderRadius: 3, background: SEG_COLORS[i], display: "block" }} />
                <h3>{s.title}</h3>
                <p className="small">{s.body}</p>
                <span className="link small">{s.cta} →</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <Eyebrow>{t.home.how}</Eyebrow>
          <ol className="grid grid-4" style={{ listStyle: "none", padding: 0, margin: 0, gridTemplateColumns: undefined }}>
            {t.home.steps.map((s, i) => (
              <li key={s.title} className="card">
                <div className="step-num" style={{ background: SEG_COLORS[i % 4] }}>{i + 1}</div>
                <h3 style={{ fontSize: "1.1rem" }}>{s.title}</h3>
                <p className="small" style={{ margin: 0 }}>{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <Eyebrow>{t.home.sizesTitle}</Eyebrow>
          <p className="lead">{t.home.sizesLead}</p>
          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", marginTop: 20 }}>
            {bottles.map((p, i) => {
              const price = findPrice(catalog, p, "event");
              return (
                <Link key={p.id} href={`/products/${p.slug}`} className="card card-link bottle-card">
                  <div style={{ display: "grid", placeItems: "center", height: 130 }}>
                    <BottleIcon volumeMl={p.volumeMl!} label={["#FF6A4D", "#FFC845", "#7B5CF0", "#1EC8A8", "#B5452A"][i % 5]} />
                  </div>
                  <div className="ink" style={{ fontWeight: 600 }}>{p.volumeMl! >= 1000 ? `${p.volumeMl! / 1000} L` : `${p.volumeMl} ml`}</div>
                  {price && (
                    <div>
                      <span className="tiny">{t.home.from} </span>
                      <span className="price">{formatInr(price.unitPricePaise)}</span>
                      <div className="tiny">{t.home.perBottle}</div>
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <Eyebrow>{t.home.templatesTitle}</Eyebrow>
          <p className="lead">{t.home.templatesLead}</p>
          <div className="label-grid" style={{ marginTop: 20 }}>
            {TEMPLATES.map((tp, i) => (
              <Link key={tp.id} href={`/design?template=${tp.id}`} className="card card-link stack" style={{ padding: 10 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="label-thumb" src={`/api/preview?t=${tp.id}&s=${i % 4}&size=pet-500&lang=${lang}&w=360`} alt={`${tp.en} label template`} width={360} height={680} loading="lazy" />
                <span className="ink small" style={{ fontWeight: 600 }}>{lang === "ta" ? tp.ta : tp.en} →</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap faq" style={{ maxWidth: 820 }}>
          <Eyebrow>{t.home.faqTitle}</Eyebrow>
          {t.home.faq.map((f) => (
            <details key={f.q}>
              <summary>{f.q}</summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="wrap center stack" style={{ maxWidth: 760 }}>
          <h2>{t.home.ctaBandTitle}</h2>
          <div>
            <Link href="/design" className="btn btn-coral">
              ✨ {t.home.ctaDesign}
            </Link>
          </div>
        </div>
      </section>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "LocalBusiness",
            name: "hellolabels",
            slogan: "Every label says hello",
            description: "Custom label printing and packaged drinking water bottles with your own label.",
            address: { "@type": "PostalAddress", streetAddress: "Kolathur, Mettur Tk", addressLocality: "Salem District", addressRegion: "Tamil Nadu", postalCode: "636303", addressCountry: "IN" },
            areaServed: "Tamil Nadu",
          }),
        }}
      />
    </>
  );
}
