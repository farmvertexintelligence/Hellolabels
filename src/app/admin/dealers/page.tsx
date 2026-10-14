import { ActionForm } from "@/components/ActionForm";
import { formatInr } from "@/lib/commerce/pricing";
import { districtByCode } from "@/lib/districts";
import { dealerDecision } from "@/lib/server/actions/admin";
import { getCatalog } from "@/lib/server/catalog";
import { supabaseAdmin } from "@/lib/supabase/server";

export default async function DealersAdmin() {
  const db = supabaseAdmin();
  const catalog = await getCatalog();
  const [{ data: dealers }, { data: ledger }] = await Promise.all([
    db.from("dealers").select("*").order("status").order("created_at", { ascending: false }),
    db.from("dealer_ledger").select("dealer_id, kind, amount_paise"),
  ]);
  const bal = (id: string, kind?: string) => (ledger ?? []).filter((l) => l.dealer_id === id && (!kind || l.kind === kind)).reduce((a, l) => a + l.amount_paise, 0);
  return (
    <div className="stack">
      <h1 style={{ fontSize: "1.8rem", margin: 0 }}>Dealers</h1>
      <p className="small">One approved dealer per district. Default commission {catalog.settings.dealerCommissionPct}% · ad share {catalog.settings.dealerAdSharePct}% (change in Regulatory &amp; settings, or per dealer below). Aadhaar copies are encrypted; opening one is recorded in the audit log.</p>
      {(dealers ?? []).map((d) => (
        <article key={d.id} className="card stack">
          <div className="row between">
            <div>
              <b className="ink">{d.full_name}</b> · {districtByCode(d.district_code)?.en} ({d.district_code})
              <div className="small">{d.phone} · {d.profession} · age {d.age} · Aadhaar ••••{d.aadhaar_last4}</div>
              <div className="tiny">{d.address}</div>
              <div className="tiny">Consent {d.consent_version} at {new Date(d.consent_at).toLocaleString("en-IN")}</div>
            </div>
            <span className={`pill ${d.status === "approved" ? "pill-ok" : d.status === "pending" ? "pill-warn" : "pill-err"}`}>{d.status}</span>
          </div>
          <div className="row">
            {d.kyc_path ? <a className="btn btn-ghost btn-sm" href={`/api/admin/dealers/${d.id}/kyc`} target="_blank" rel="noopener noreferrer">🔒 View Aadhaar</a> : <span className="tiny">KYC file deleted</span>}
            {d.status !== "approved" && (
              <ActionForm action={dealerDecision} submit="Approve" small className="row"><input type="hidden" name="dealerId" value={d.id} /><input type="hidden" name="action" value="approve" /></ActionForm>
            )}
            {d.status === "pending" && (
              <ActionForm action={dealerDecision} submit="Reject" small danger className="row">
                <input type="hidden" name="dealerId" value={d.id} /><input type="hidden" name="action" value="reject" />
                <input className="input" name="reason" placeholder="Reason" style={{ maxWidth: 200 }} />
              </ActionForm>
            )}
            {d.status === "approved" && (
              <ActionForm action={dealerDecision} submit="Suspend" small danger confirm="Suspend this dealer?" className="row"><input type="hidden" name="dealerId" value={d.id} /><input type="hidden" name="action" value="suspend" /></ActionForm>
            )}
          </div>
          {d.status === "approved" && (
            <div className="row">
              <ActionForm action={dealerDecision} submit="Save terms" small className="row">
                <input type="hidden" name="dealerId" value={d.id} /><input type="hidden" name="action" value="terms" />
                <input className="input" name="commissionPct" defaultValue={d.commission_pct ?? ""} placeholder={`Commission % (${catalog.settings.dealerCommissionPct})`} style={{ maxWidth: 170 }} />
                <input className="input" name="adSharePct" defaultValue={d.ad_share_pct ?? ""} placeholder={`Ad share % (${catalog.settings.dealerAdSharePct})`} style={{ maxWidth: 160 }} />
              </ActionForm>
              <span className="small">Commission {formatInr(bal(d.id, "commission"))} · Ad share {formatInr(bal(d.id, "ad_share"))} · <b>Balance {formatInr(bal(d.id))}</b></span>
              <ActionForm action={dealerDecision} submit="Record payout" small className="row">
                <input type="hidden" name="dealerId" value={d.id} /><input type="hidden" name="action" value="payout" />
                <input className="input" name="amount" placeholder="₹" style={{ maxWidth: 100 }} />
                <input className="input" name="note" placeholder="UTR / note" style={{ maxWidth: 160 }} />
              </ActionForm>
            </div>
          )}
        </article>
      ))}
      {!dealers?.length && <p>No applications yet.</p>}
    </div>
  );
}
