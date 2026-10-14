import type { Metadata } from "next";
import { Eyebrow } from "@/components/Squares";
import { getDict } from "@/lib/i18n/server";
import { TrackForm } from "./TrackForm";

export const metadata: Metadata = { title: "Track your order" };

export default async function Track() {
  const { t } = await getDict();
  return (
    <div className="wrap section" style={{ maxWidth: 560 }}>
      <Eyebrow>{t.nav.track}</Eyebrow>
      <h1 style={{ fontSize: "2rem" }}>{t.order.track}</h1>
      <TrackForm />
    </div>
  );
}
