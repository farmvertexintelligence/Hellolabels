import type { Metadata } from "next";
import Link from "next/link";
import { Eyebrow } from "@/components/Squares";
import { features } from "@/lib/env";
import { getDict } from "@/lib/i18n/server";
import { getUser } from "@/lib/server/auth";
import { supabaseAdmin } from "@/lib/supabase/server";
import { ApplyForm } from "./ApplyForm";

export const metadata: Metadata = { title: "Become a dealer — one per district", description: "Earn commission on shop orders and a share of local ad revenue as the hellolabels dealer for your district." };
export const dynamic = "force-dynamic";

export default async function Apply() {
  const { t } = await getDict();
  const user = await getUser().catch(() => null);
  const taken = features.serviceRole ? ((await supabaseAdmin().from("dealers").select("district_code").eq("status", "approved")).data ?? []).map((d) => d.district_code as string) : [];
  const mine = user && features.serviceRole ? (await supabaseAdmin().from("dealers").select("status").eq("id", user.id).maybeSingle()).data : null;
  return (
    <div className="wrap section" style={{ maxWidth: 680 }}>
      <Eyebrow>{t.nav.dealers}</Eyebrow>
      <h1 style={{ fontSize: "2.2rem" }}>{t.dealer.applyTitle}</h1>
      <p className="lead">{t.dealer.applyLead}</p>
      <ul className="small">
        <li>{t.dealer.placeOrder}</li>
        <li>{t.dealer.commission} · {t.dealer.adShare}</li>
        <li>{t.dealer.deliveries}</li>
        <li>{t.dealer.ads}</li>
      </ul>
      {!user ? (
        <Link className="btn btn-coral" href="/login?next=/dealer/apply">{t.nav.login} →</Link>
      ) : mine && mine.status !== "rejected" ? (
        <div className="note">Application status: <b>{mine.status}</b>. <Link className="link" href="/dealer">{t.dealer.portal} →</Link></div>
      ) : (
        <ApplyForm taken={taken} />
      )}
    </div>
  );
}
