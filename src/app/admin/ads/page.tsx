import { ActionForm } from "@/components/ActionForm";
import { formatInr } from "@/lib/commerce/pricing";
import { DISTRICTS, districtByCode } from "@/lib/districts";
import { adDecision, createAd } from "@/lib/server/actions/admin";
import { supabaseAdmin } from "@/lib/supabase/server";

export default async function AdsAdmin() {
  const { data: ads } = await supabaseAdmin().from("ad_bookings").select("*, advertisers(name, business, phone)").order("start_date", { ascending: false }).limit(200);
  return (
    <div className="stack">
      <h1 style={{ fontSize: "1.8rem", margin: 0 }}>Ad bookings</h1>
      <p className="small">An approved ad is printed on the 20% ad strip of every Shop label delivered in its district between the dates. One ad per district per day (the database refuses overlaps).</p>
      <div className="table-wrap"><table className="table"><thead><tr><th>District</th><th>Advertiser</th><th>Dates</th><th>Status</th><th className="num">Amount</th><th>Actions</th></tr></thead><tbody>
        {(ads ?? []).map((a) => {
          const adv = a.advertisers as { name: string; business: string | null; phone: string } | null;
          return (
            <tr key={a.id}>
              <td>{districtByCode(a.district_code)?.en}</td>
              <td>{adv?.name}<div className="tiny">{adv?.business} {adv?.phone}</div>{a.creative_path && <a className="link tiny" href={`/api/admin/ads/${a.id}/creative`} target="_blank">artwork</a>}</td>
              <td className="tiny">{a.start_date} → {a.end_date}</td>
              <td><span className="pill">{a.status}{a.paid ? " · paid" : ""}</span>{a.dealer_id && <div className="tiny">via dealer</div>}</td>
              <td className="num">{formatInr(a.amount_paise)}</td>
              <td>
                <div className="row" style={{ gap: 4 }}>
                  {a.status === "pending" && ["approve", "reject"].map((x) => (
                    <ActionForm key={x} action={adDecision} submit={x} small danger={x === "reject"} className="row"><input type="hidden" name="adId" value={a.id} /><input type="hidden" name="action" value={x} /></ActionForm>
                  ))}
                  {!a.paid && a.status !== "rejected" && <ActionForm action={adDecision} submit="paid" small className="row"><input type="hidden" name="adId" value={a.id} /><input type="hidden" name="action" value="paid" /></ActionForm>}
                  {["approved", "pending"].includes(a.status) && <ActionForm action={adDecision} submit="cancel" small danger className="row"><input type="hidden" name="adId" value={a.id} /><input type="hidden" name="action" value="cancel" /></ActionForm>}
                  <ActionForm action={adDecision} submit="upload art" small className="row"><input type="hidden" name="adId" value={a.id} /><input type="hidden" name="action" value="creative" /><input type="file" name="creative" accept="image/jpeg,image/png" style={{ maxWidth: 170 }} /></ActionForm>
                </div>
              </td>
            </tr>
          );
        })}
        {!ads?.length && <tr><td colSpan={6}>No bookings.</td></tr>}
      </tbody></table></div>
      <h2 style={{ fontSize: "1.2rem" }}>New booking</h2>
      <ActionForm action={createAd} submit="Create booking" className="card stack">
        <div className="grid grid-3">
          <select className="select" name="district" required>{DISTRICTS.map((d) => <option key={d.code} value={d.code}>{d.en}</option>)}</select>
          <input className="input" name="advertiser" placeholder="Advertiser" required />
          <input className="input" name="business" placeholder="Business" />
          <input className="input" name="phone" placeholder="Phone" required />
          <input className="input" type="date" name="start" required />
          <input className="input" type="date" name="end" required />
          <input className="input" name="amount" placeholder="Amount ₹" required />
          <input className="input" type="file" name="creative" accept="image/jpeg,image/png" />
        </div>
      </ActionForm>
    </div>
  );
}
