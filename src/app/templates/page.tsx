import type { Metadata } from "next";
import Link from "next/link";
import { Eyebrow } from "@/components/Squares";
import { TEMPLATES } from "@/lib/design/templates";
import { getDict } from "@/lib/i18n/server";

export const metadata: Metadata = {
  title: "Label templates — wedding, birthday, temple festival, Pongal, Deepavali",
  description: "Ready label templates for weddings, birthdays, housewarmings, corporate events, temple festivals, shops and Tamil festivals. Change the words in English or Tamil.",
};

export default async function Templates() {
  const { t, lang } = await getDict();
  return (
    <div className="wrap section">
      <Eyebrow>{t.home.templatesTitle}</Eyebrow>
      <h1>{t.home.templatesTitle}</h1>
      <p className="lead">{t.home.templatesLead}</p>
      {TEMPLATES.map((tp) => (
        <section key={tp.id} style={{ marginTop: 36 }}>
          <div className="row between">
            <h2 style={{ fontSize: "1.4rem", margin: 0 }}>{lang === "ta" ? tp.ta : tp.en}</h2>
            <Link className="btn btn-sm btn-coral" href={`/design?template=${tp.id}${tp.segment === "shop" ? "&segment=shop" : ""}`}>{t.nav.design} →</Link>
          </div>
          <div className="label-grid" style={{ marginTop: 12 }}>
            {[0, 1, 2, 3].map((s) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={s} src={`/api/preview?t=${tp.id}&s=${s}&size=pet-500&lang=${s % 2 ? "ta" : lang}&w=360`} alt={`${tp.en} label, style ${s + 1}`} loading="lazy" width={360} height={680} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
