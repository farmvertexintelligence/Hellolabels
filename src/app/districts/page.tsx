import type { Metadata } from "next";
import Link from "next/link";
import { Eyebrow } from "@/components/Squares";
import { DISTRICTS } from "@/lib/districts";
import { getDict } from "@/lib/i18n/server";

export const metadata: Metadata = {
  title: "Custom water bottle labels across Tamil Nadu — all 38 districts",
  description: "hellolabels delivers custom labelled water bottles to every district of Tamil Nadu from Mettur, Salem.",
};

export default async function Districts() {
  const { t, lang } = await getDict();
  return (
    <div className="wrap section">
      <Eyebrow>{t.footer.districts}</Eyebrow>
      <h1>{t.footer.districts}</h1>
      <ul className="grid grid-4" style={{ listStyle: "none", padding: 0 }}>
        {DISTRICTS.map((d) => (
          <li key={d.code}><Link className="card card-link" href={`/districts/${d.slug}`}><b className="ink">{lang === "ta" ? d.ta : d.en}</b><div className="tiny">{lang === "ta" ? d.en : d.ta}</div></Link></li>
        ))}
      </ul>
    </div>
  );
}
