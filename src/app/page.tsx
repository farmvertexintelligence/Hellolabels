import Link from "next/link";
import { ProductCard } from "@/components/ProductCard";
import { FlipCard, Tabs } from "@/components/shop/Interactive";
import { LabelBottle } from "@/components/shop/LabelBottle";
import { ScrollStory } from "@/components/shop/ScrollStory";
import { Eyebrow } from "@/components/Squares";
import { findLabelSize, findPrice, labelProducts, waterProducts } from "@/lib/catalog/helpers";
import { formatInr } from "@/lib/commerce/pricing";
import { TEMPLATES } from "@/lib/design/templates";
import { BLEED_MM } from "@/lib/design/zones";
import { DISTRICTS } from "@/lib/districts";
import { getDict } from "@/lib/i18n/server";
import { getCatalog } from "@/lib/server/catalog";

export const revalidate = 300;

const SEG_LINKS = ["/design?segment=event", "/design?segment=shop&template=shop", "/products?for=bulk", "/products#labels"];
const SEG_COLORS = ["#FF6A4D", "#1EC8A8", "#7B5CF0", "#FFC845"];
const SEG_ICONS = ["💍", "🏪", "🚌", "🏷️"];
const FLIP_COLORS = ["#8E1B1B", "#7B5CF0", "#2E5E3A", "#141A26", "#B22A12", "#0E6BA8", "#C1440E", "#2A0F4A", "#1B5E20"];

export default async function Home() {
  const { t, lang } = await getDict();
  const catalog = await getCatalog();
  const plastic = waterProducts(catalog, "plastic");
  const glass = waterProducts(catalog, "glass");
  const labels = labelProducts(catalog);
  const size = findLabelSize(catalog, "pet-500")!;
  const labelMm = { w: size.widthMm + 2 * BLEED_MM, h: size.heightMm + 2 * BLEED_MM };
  const pv = (id: string, s: number, w = 360, l: string = lang) => `/api/preview?t=${id}&s=${s}&size=pet-500&lang=${l}&w=${w}`;
  const p500 = plastic.find((p) => p.volumeMl === 500);
  const price500 = p500 ? findPrice(catalog, p500, "event") : undefined;

  return (
    <>
      {/* ── Hero ── */}
      <section className="hero2">
        <div className="hero2-bg" aria-hidden="true">
          <span className="blob b1" />
          <span className="blob b2" />
          <span className="blob b3" />
        </div>
        <div className="wrap hero2-grid">
          <div className="hero2-copy">
            <div data-reveal>
              <Eyebrow>{t.home.eyebrow}</Eyebrow>
            </div>
            <h1 data-reveal style={{ "--d": 1 } as React.CSSProperties}>{t.home.title}</h1>
            <p className="lead" data-reveal style={{ "--d": 2 } as React.CSSProperties}>{t.home.lead}</p>
            <div className="row" data-reveal style={{ marginTop: 24, "--d": 3 } as React.CSSProperties}>
              <Link href="/design" className="btn btn-coral btn-lg">✨ {t.home.ctaDesign}</Link>
              <Link href="/products" className="btn btn-ghost btn-lg">{t.home.ctaProducts}</Link>
            </div>
            <ul className="trust" data-reveal style={{ "--d": 4 } as React.CSSProperties}>
              {t.home.trust.map((x) => <li key={x}>{x}</li>)}
            </ul>
          </div>
          <div className="hero2-visual">
            <div className="hero2-ring" aria-hidden="true" />
            <div className="float">
              <LabelBottle
                labels={[
                  { src: pv("wedding", 0, 420), alt: "Wedding label on a 500 ml bottle" },
                  { src: pv("shop", 0, 420), alt: "Shop label on a 500 ml bottle" },
                  { src: pv("pongal", 1, 420, "ta"), alt: "Pongal label on a 500 ml bottle" },
                  { src: pv("birthday", 0, 420), alt: "Birthday label on a 500 ml bottle" },
                ]}
                labelMm={labelMm}
                width={210}
                mobileWidth={150}
              />
            </div>
            <span className="chip c1">✓ FSSAI · ISI</span>
            <span className="chip c2">தமிழ் ✓ English</span>
            {price500 && <span className="chip c3">500 ml {t.home.from} {formatInr(price500.unitPricePaise)}</span>}
          </div>
        </div>
      </section>

      {/* ── Categories ── */}
      <section className="wrap cats">
        {t.home.segments.map((s, i) => (
          <Link key={s.title} href={SEG_LINKS[i]} className="cat" data-reveal style={{ "--d": i, "--c": SEG_COLORS[i] } as React.CSSProperties}>
            <span className="cat-icon" aria-hidden="true">{SEG_ICONS[i]}</span>
            <span className="cat-title">{s.title}</span>
            <span className="cat-body">{s.body}</span>
            <span className="link small">{s.cta} →</span>
          </Link>
        ))}
      </section>

      {/* ── Shop ── */}
      <section className="section">
        <div className="wrap">
          <div className="row between" data-reveal>
            <div>
              <Eyebrow>{t.home.sizesTitle}</Eyebrow>
              <h2>{t.home.shopTitle}</h2>
              <p className="lead">{t.home.shopLead}</p>
            </div>
            <Link className="link" href="/products">{t.home.viewAll} →</Link>
          </div>
          <Tabs
            tabs={[
              { id: "plastic", label: t.product.plastic, content: <div className="pgrid">{plastic.map((p, i) => <div key={p.id} data-reveal style={{ "--d": i } as React.CSSProperties}><ProductCard p={p} catalog={catalog} t={t} lang={lang} index={i} /></div>)}</div> },
              { id: "glass", label: t.product.glass, content: <div className="pgrid">{glass.map((p, i) => <div key={p.id}><ProductCard p={p} catalog={catalog} t={t} lang={lang} index={i + 3} /></div>)}</div> },
              { id: "labels", label: t.home.segments[3].title, content: <div className="pgrid">{labels.map((p, i) => <div key={p.id}><ProductCard p={p} catalog={catalog} t={t} lang={lang} index={i + 5} /></div>)}</div> },
            ]}
          />
        </div>
      </section>

      {/* ── Scroll story (3D bottle turns as you scroll) ── */}
      <ScrollStory
        eyebrow={<><Eyebrow>{t.home.how}</Eyebrow><h2>{t.home.storyTitle}</h2></>}
        steps={t.home.steps}
        labels={[
          { src: pv("housewarming", 0), alt: "Housewarming label" },
          { src: pv("wedding", 1, 360, "ta"), alt: "Wedding label in Tamil" },
          { src: pv("corporate", 0), alt: "Corporate label" },
          { src: pv("temple", 0, 360, "ta"), alt: "Temple festival label" },
          { src: pv("deepavali", 0), alt: "Deepavali label" },
        ]}
        labelMm={labelMm}
      />

      {/* ── Trending designs (3D flip cards) ── */}
      <section className="section">
        <div className="wrap">
          <div data-reveal>
            <Eyebrow>{t.home.templatesTitle}</Eyebrow>
            <h2>{t.home.trendingTitle}</h2>
            <p className="lead">{t.home.trendingLead}</p>
          </div>
          <div className="flip-row">
            {TEMPLATES.map((tp, i) => (
              <div key={tp.id} data-reveal style={{ "--d": i % 4 } as React.CSSProperties}>
                <FlipCard
                  // eslint-disable-next-line @next/next/no-img-element
                  front={<img src={pv(tp.id, i % 4, 360, i % 3 === 1 ? "ta" : lang)} alt={`${tp.en} label`} loading="lazy" width={360} height={690} />}
                  title={lang === "ta" ? tp.ta : tp.en}
                  sub={`${t.home.flipHint} ↺ · 4 ${lang === "ta" ? "பாணிகள்" : "styles"} · தமிழ் / English`}
                  href={`/design?template=${tp.id}${tp.segment === "shop" ? "&segment=shop" : ""}`}
                  cta={t.home.useDesign}
                  color={FLIP_COLORS[i % FLIP_COLORS.length]}
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Banners ── */}
      <section className="wrap banners">
        <Link href="/design?segment=event" className="banner banner-event" data-reveal>
          <div>
            <h3>{t.home.bannerEventTitle}</h3>
            <p>{t.home.bannerEventBody}</p>
            <span className="btn btn-sm">{t.home.segments[0].cta} →</span>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={pv("wedding", 3, 300)} alt="" loading="lazy" className="banner-img" />
        </Link>
        <Link href="/design?segment=shop&template=shop" className="banner banner-shop" data-reveal style={{ "--d": 1 } as React.CSSProperties}>
          <div>
            <h3>{t.home.bannerShopTitle}</h3>
            <p>{t.home.bannerShopBody}</p>
            <span className="btn btn-sm">{t.home.segments[1].cta} →</span>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={pv("shop", 2, 300)} alt="" loading="lazy" className="banner-img" />
        </Link>
      </section>

      {/* ── Numbers ── */}
      <section className="wrap stats">
        {[
          [DISTRICTS.length, t.home.statDistricts],
          [5, t.home.statSizes],
          [24, t.home.statCase],
          [4, t.home.statDesigns],
        ].map(([n, label], i) => (
          <div key={String(label)} className="stat" data-reveal style={{ "--d": i } as React.CSSProperties}>
            <b data-count={n}>{n}</b>
            <span>{label}</span>
          </div>
        ))}
      </section>

      {/* ── FAQ ── */}
      <section className="section">
        <div className="wrap faq" style={{ maxWidth: 820 }}>
          <div data-reveal>
            <Eyebrow>{t.home.faqTitle}</Eyebrow>
          </div>
          {t.home.faq.map((f, i) => (
            <details key={f.q} data-reveal style={{ "--d": i } as React.CSSProperties}>
              <summary>{f.q}</summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="cta-band">
        <div className="wrap center stack" data-reveal>
          <h2>{t.home.ctaBandTitle}</h2>
          <div>
            <Link href="/design" className="btn btn-coral btn-lg">✨ {t.home.ctaDesign}</Link>
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
