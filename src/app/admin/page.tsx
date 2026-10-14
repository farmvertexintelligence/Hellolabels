import Link from "next/link";
import { ActionForm } from "@/components/ActionForm";
import { formatInr } from "@/lib/commerce/pricing";
import { istToday } from "@/lib/commerce/logistics";
import { resolveDataRequest } from "@/lib/server/actions/admin";
import { getCatalog } from "@/lib/server/catalog";
import { supabaseAdmin } from "@/lib/supabase/server";
import { env, features } from "@/lib/env";

export default async function AdminHome() {
  const db = supabaseAdmin();
  const catalog = await getCatalog({ fresh: true });
  const today = istToday();
  const monthStart = `${today.slice(0, 7)}-01`;
  const count = async (q: PromiseLike<{ count: number | null }>) => (await q).count ?? 0;
  const [unpaid, toApprove, toPrint, toPack, toLoad, pendingDealers, ads, month, requests, failedMsgs] = await Promise.all([
    count(db.from("orders").select("id", { count: "exact", head: true }).eq("status", "pending_payment")),
    count(db.from("orders").select("id", { count: "exact", head: true }).eq("status", "placed")),
    count(db.from("orders").select("id", { count: "exact", head: true }).eq("status", "design_approved")),
    count(db.from("orders").select("id", { count: "exact", head: true }).eq("status", "printed")),
    count(db.from("orders").select("id", { count: "exact", head: true }).eq("status", "packed")),
    count(db.from("dealers").select("id", { count: "exact", head: true }).eq("status", "pending")),
    count(db.from("ad_bookings").select("id", { count: "exact", head: true }).eq("status", "pending")),
    db.from("payments").select("amount_paise, refunded_paise").in("status", ["captured", "partially_refunded", "refunded"]).gte("captured_at", monthStart),
    db.from("data_requests").select("*").eq("status", "open").order("created_at"),
    count(db.from("notifications").select("id", { count: "exact", head: true }).eq("status", "failed").gte("created_at", `${today}T00:00:00+05:30`)),
  ]);
  const collected = (month.data ?? []).reduce((a, p) => a + p.amount_paise - (p.refunded_paise ?? 0), 0);
  const placeholders = catalog.prices.filter((p) => p.isPlaceholder).length + catalog.labelSizes.filter((s) => s.isPlaceholder).length;
  const setup = [
    [!features.payments, "Razorpay keys and webhook secret (RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET)"],
    [!features.ai, "ANTHROPIC_API_KEY for the AI designer (templates are used until then)"],
    [!env.aadhaarKey, "AADHAAR_ENCRYPTION_KEY for dealer KYC"],
    [!env.msg91AuthKey, "MSG91 SMS keys (order SMS are logged as skipped)"],
    [!env.whatsappToken, "WhatsApp Cloud API token (WhatsApp updates are logged as skipped)"],
    [placeholders > 0, `${placeholders} placeholder prices/label sizes — confirm them in Prices & sizes`],
    [catalog.regulatory.fssaiLicence.includes("["), "Regulatory details (FSSAI, ISI licence, packager) in Regulatory & settings"],
    [!catalog.settings.catalogReady, "Online ordering is closed — open it in Regulatory & settings when everything above is done"],
  ].filter(([on]) => on) as [boolean, string][];

  return (
    <div className="stack">
      <h1 style={{ fontSize: "1.8rem", margin: 0 }}>Today</h1>
      {setup.length > 0 && (
        <div className="note note-warn">
          <b>Setup to finish</b>
          <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>{setup.map(([, s]) => <li key={s} className="small">{s}</li>)}</ul>
        </div>
      )}
      <div className="grid grid-4">
        <Link href="/admin/orders?status=placed" className="card card-link kpi"><span className="tiny">Designs to approve</span><b>{toApprove}</b></Link>
        <Link href="/admin/production" className="card card-link kpi"><span className="tiny">To print</span><b>{toPrint}</b></Link>
        <Link href="/admin/production" className="card card-link kpi"><span className="tiny">To pack</span><b>{toPack}</b></Link>
        <Link href="/admin/trips" className="card card-link kpi"><span className="tiny">Packed, to load</span><b>{toLoad}</b></Link>
        <div className="card kpi"><span className="tiny">Collected this month</span><b>{formatInr(collected)}</b></div>
        <Link href="/admin/orders?status=pending_payment" className="card card-link kpi"><span className="tiny">Awaiting payment</span><b>{unpaid}</b></Link>
        <Link href="/admin/dealers" className="card card-link kpi"><span className="tiny">Dealer applications</span><b>{pendingDealers}</b></Link>
        <Link href="/admin/ads" className="card card-link kpi"><span className="tiny">Ads to approve</span><b>{ads}</b></Link>
      </div>
      {failedMsgs > 0 && <div className="note note-err small">{failedMsgs} SMS/WhatsApp messages failed today — see the order pages.</div>}
      <h2 style={{ fontSize: "1.2rem" }}>Data requests (DPDP)</h2>
      {!requests.data?.length && <p className="small">None open.</p>}
      {requests.data?.map((r) => (
        <div key={r.id} className="card row between">
          <div className="small"><b>{r.kind}</b> · {r.phone} · {new Date(r.created_at).toLocaleDateString("en-IN")}<div className="tiny">{r.details}</div></div>
          <ActionForm action={resolveDataRequest} submit="Mark done" small className="row"><input type="hidden" name="id" value={r.id} /></ActionForm>
        </div>
      ))}
    </div>
  );
}
