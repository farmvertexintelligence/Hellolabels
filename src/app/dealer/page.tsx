import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ActionForm } from "@/components/ActionForm";
import { Eyebrow } from "@/components/Squares";
import { formatInr } from "@/lib/commerce/pricing";
import { districtByCode } from "@/lib/districts";
import { getDict } from "@/lib/i18n/server";
import { addShop, requestAd } from "@/lib/server/actions/dealer";
import { requireRole } from "@/lib/server/auth";
import { getCatalog } from "@/lib/server/catalog";
import { supabaseAdmin } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Dealer portal", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function DealerPortal() {
  const user = await requireRole(null, "/dealer");
  const { t, lang } = await getDict();
  const db = supabaseAdmin();
  const { data: dealer } = await db.from("dealers").select("*").eq("id", user.id).maybeSingle();
  if (!dealer) redirect("/dealer/apply");
  const district = districtByCode(dealer.district_code);
  if (dealer.status !== "approved") {
    return (
      <div className="wrap section" style={{ maxWidth: 640 }}>
        <Eyebrow>{t.dealer.portal}</Eyebrow>
        <h1 style={{ fontSize: "2rem" }}>{lang === "ta" ? district?.ta : district?.en}</h1>
        <div className="note">Application status: <b>{dealer.status}</b>{dealer.rejected_reason ? ` — ${dealer.rejected_reason}` : ""}</div>
      </div>
    );
  }
  const catalog = await getCatalog();
  const [{ data: orders }, { data: shops }, { data: ledger }, { data: ads }] = await Promise.all([
    db.from("orders").select("id, order_no, status, total_paise, delivery_date, ship_name").eq("placed_by_dealer_id", user.id).order("created_at", { ascending: false }).limit(50),
    db.from("dealer_shops").select("*").eq("dealer_id", user.id).order("name"),
    db.from("dealer_ledger").select("kind, amount_paise, created_at, note").eq("dealer_id", user.id).order("created_at", { ascending: false }).limit(200),
    db.from("ad_bookings").select("id, start_date, end_date, status, amount_paise, paid, advertisers(name)").eq("district_code", dealer.district_code).order("start_date", { ascending: false }).limit(50),
  ]);
  const sum = (k: string) => (ledger ?? []).filter((l) => l.kind === k).reduce((a, l) => a + l.amount_paise, 0);
  const commissionPct = Number(dealer.commission_pct ?? catalog.settings.dealerCommissionPct);
  const adPct = Number(dealer.ad_share_pct ?? catalog.settings.dealerAdSharePct);

  return (
    <div className="wrap section">
      <Eyebrow>{t.dealer.portal}</Eyebrow>
      <h1 style={{ fontSize: "2rem" }}>{dealer.full_name} · {lang === "ta" ? district?.ta : district?.en}</h1>
      <div className="grid grid-4" style={{ margin: "16px 0 32px" }}>
        <div className="card kpi"><span className="tiny">{t.dealer.commission}</span><b>{commissionPct}%</b></div>
        <div className="card kpi"><span className="tiny">{t.dealer.adShare}</span><b>{adPct}%</b></div>
        <div className="card kpi"><span className="tiny">{t.dealer.earnings} · {t.dealer.commission}</span><b>{formatInr(sum("commission"))}</b></div>
        <div className="card kpi"><span className="tiny">{t.dealer.earnings} · {t.dealer.adShare}</span><b>{formatInr(sum("ad_share"))}</b><span className="tiny">Paid out {formatInr(-sum("payout"))}</span></div>
      </div>

      <div className="grid grid-2" style={{ alignItems: "start" }}>
        <section className="stack">
          <div className="row between">
            <h2 style={{ fontSize: "1.3rem", margin: 0 }}>{t.dealer.deliveries}</h2>
            <Link className="btn btn-coral btn-sm" href="/design?segment=shop&template=shop">＋ {t.dealer.placeOrder}</Link>
          </div>
          <p className="tiny">Design the shop&rsquo;s label, add it to the cart, and choose the shop at checkout.</p>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>{t.order.orderNo}</th><th>Shop</th><th>{t.order.status}</th><th className="num">{t.order.total}</th></tr></thead>
              <tbody>
                {(orders ?? []).map((o) => (
                  <tr key={o.id}>
                    <td><Link className="link" href={`/orders/${o.id}`}>{o.order_no}</Link><div className="tiny">{o.delivery_date}</div></td>
                    <td>{o.ship_name}</td>
                    <td><span className="pill">{t.status[o.status as keyof typeof t.status]}</span></td>
                    <td className="num">{formatInr(o.total_paise)}</td>
                  </tr>
                ))}
                {!orders?.length && <tr><td colSpan={4}>—</td></tr>}
              </tbody>
            </table>
          </div>

          <h2 style={{ fontSize: "1.3rem", marginTop: 24 }}>{t.dealer.shops}</h2>
          {(shops ?? []).map((s) => (
            <div key={s.id} className="card small"><b className="ink">{s.name}</b> · {s.phone}<div className="tiny">{s.address}</div></div>
          ))}
          <details className="card">
            <summary className="link" style={{ cursor: "pointer" }}>＋ Add a shop</summary>
            <ActionForm action={addShop} submit="Add shop" className="stack" >
              <input className="input" name="name" placeholder="Shop name" required />
              <input className="input" name="owner" placeholder="Owner name" />
              <input className="input" name="phone" placeholder="Phone (10 digits)" inputMode="numeric" required />
              <textarea className="textarea" name="address" placeholder="Full address" required />
              <input className="input" name="pincode" placeholder="Pincode" inputMode="numeric" />
              <input className="input" name="gstin" placeholder="GSTIN (optional)" />
            </ActionForm>
          </details>
        </section>

        <section className="stack">
          <h2 style={{ fontSize: "1.3rem", margin: 0 }}>{t.dealer.ads}</h2>
          <p className="tiny">One advertiser per district at a time. The ad is printed on the 20% ad strip of every Shop label delivered in {district?.en} during the booked dates.</p>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Advertiser</th><th>Dates</th><th>Status</th><th className="num">Amount</th></tr></thead>
              <tbody>
                {(ads ?? []).map((a) => (
                  <tr key={a.id}>
                    <td>{(a.advertisers as unknown as { name: string } | null)?.name}</td>
                    <td className="tiny">{a.start_date} → {a.end_date}</td>
                    <td><span className="pill">{a.status}{a.paid ? " · paid" : ""}</span></td>
                    <td className="num">{formatInr(a.amount_paise)}</td>
                  </tr>
                ))}
                {!ads?.length && <tr><td colSpan={4}>—</td></tr>}
              </tbody>
            </table>
          </div>
          <details className="card">
            <summary className="link" style={{ cursor: "pointer" }}>＋ Book ad space</summary>
            <ActionForm action={requestAd} submit="Send for approval">
              <input className="input" name="advertiser" placeholder="Advertiser name" required />
              <input className="input" name="business" placeholder="Business" />
              <input className="input" name="phone" placeholder="Advertiser phone" required />
              <div className="grid grid-2">
                <label className="field"><span>From</span><input className="input" type="date" name="start" required /></label>
                <label className="field"><span>To</span><input className="input" type="date" name="end" required /></label>
              </div>
              <input className="input" name="amount" placeholder="Amount ₹" inputMode="decimal" required />
              <label className="field"><span>Ad artwork (portrait, at least 600 × 800 px)</span><input className="input" type="file" name="creative" accept="image/jpeg,image/png" /></label>
            </ActionForm>
          </details>

          <h2 style={{ fontSize: "1.3rem", marginTop: 24 }}>{t.dealer.earnings}</h2>
          <div className="table-wrap">
            <table className="table">
              <tbody>
                {(ledger ?? []).slice(0, 30).map((l, i) => (
                  <tr key={i}><td className="tiny">{new Date(l.created_at).toLocaleDateString("en-IN")}</td><td>{l.kind}</td><td className="tiny">{l.note}</td><td className="num">{formatInr(l.amount_paise)}</td></tr>
                ))}
                {!ledger?.length && <tr><td>—</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
