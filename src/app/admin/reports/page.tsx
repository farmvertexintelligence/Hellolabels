import { formatInr } from "@/lib/commerce/pricing";
import { istToday } from "@/lib/commerce/logistics";
import { DISTRICTS, districtByCode } from "@/lib/districts";
import { supabaseAdmin } from "@/lib/supabase/server";

export default async function Reports({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const sp = await searchParams;
  const to = sp.to ?? istToday();
  const from = sp.from ?? `${to.slice(0, 7)}-01`;
  const db = supabaseAdmin();
  const end = `${to}T23:59:59+05:30`;
  const start = `${from}T00:00:00+05:30`;
  const [{ data: orders }, { data: payments }, { data: ledger }, { data: ads }] = await Promise.all([
    db.from("orders").select("segment, district_code, total_paise, taxable_paise, cgst_paise, sgst_paise, igst_paise, status, placed_by_dealer_id").gte("created_at", start).lte("created_at", end).not("status", "in", "(pending_payment,cancelled)"),
    db.from("payments").select("provider, method, purpose, amount_paise, refunded_paise, status").gte("created_at", start).lte("created_at", end),
    db.from("dealer_ledger").select("dealer_id, kind, amount_paise, dealers(full_name, district_code)").gte("created_at", start).lte("created_at", end),
    db.from("ad_bookings").select("district_code, amount_paise, paid, status").lte("start_date", to).gte("end_date", from).in("status", ["approved", "live", "ended"]),
  ]);
  const sum = <T,>(xs: T[] | null, f: (x: T) => number) => (xs ?? []).reduce((a, x) => a + f(x), 0);
  const group = <T,>(xs: T[] | null, k: (x: T) => string) => {
    const m = new Map<string, T[]>();
    for (const x of xs ?? []) m.set(k(x), [...(m.get(k(x)) ?? []), x]);
    return [...m.entries()].sort();
  };
  const captured = (payments ?? []).filter((p) => ["captured", "partially_refunded", "refunded"].includes(p.status));

  return (
    <div className="stack">
      <h1 style={{ fontSize: "1.8rem", margin: 0 }}>Reports</h1>
      <form className="row card">
        <label className="field"><span>From</span><input className="input" type="date" name="from" defaultValue={from} /></label>
        <label className="field"><span>To</span><input className="input" type="date" name="to" defaultValue={to} /></label>
        <button className="btn btn-sm">Show</button>
      </form>
      <div className="grid grid-4">
        <div className="card kpi"><span className="tiny">Sales (invoice value)</span><b>{formatInr(sum(orders, (o) => o.total_paise))}</b><span className="tiny">{orders?.length ?? 0} orders</span></div>
        <div className="card kpi"><span className="tiny">Taxable value</span><b>{formatInr(sum(orders, (o) => o.taxable_paise))}</b></div>
        <div className="card kpi"><span className="tiny">GST (C+S / I)</span><b>{formatInr(sum(orders, (o) => o.cgst_paise + o.sgst_paise))}</b><span className="tiny">IGST {formatInr(sum(orders, (o) => o.igst_paise))}</span></div>
        <div className="card kpi"><span className="tiny">Collected (net of refunds)</span><b>{formatInr(sum(captured, (p) => p.amount_paise - (p.refunded_paise ?? 0)))}</b></div>
      </div>

      <div className="grid grid-2" style={{ alignItems: "start" }}>
        <section>
          <h2 style={{ fontSize: "1.2rem" }}>Sales by segment</h2>
          <div className="table-wrap"><table className="table"><tbody>
            {group(orders, (o) => o.segment).map(([k, xs]) => <tr key={k}><td>{k}</td><td className="num">{xs.length}</td><td className="num">{formatInr(sum(xs, (o) => o.total_paise))}</td></tr>)}
          </tbody></table></div>
          <h2 style={{ fontSize: "1.2rem" }}>Sales by district</h2>
          <div className="table-wrap"><table className="table"><tbody>
            {group(orders, (o) => o.district_code).map(([k, xs]) => <tr key={k}><td>{districtByCode(k)?.en ?? k}</td><td className="num">{xs.length}</td><td className="num">{formatInr(sum(xs, (o) => o.total_paise))}</td></tr>)}
          </tbody></table></div>
        </section>
        <section>
          <h2 style={{ fontSize: "1.2rem" }}>Payments by method</h2>
          <div className="table-wrap"><table className="table"><tbody>
            {group(payments, (p) => `${p.provider} · ${p.method ?? "-"} · ${p.status}`).map(([k, xs]) => <tr key={k}><td>{k}</td><td className="num">{xs.length}</td><td className="num">{formatInr(sum(xs, (p) => p.amount_paise))}</td></tr>)}
          </tbody></table></div>
          <h2 style={{ fontSize: "1.2rem" }}>Dealer commissions &amp; ad shares</h2>
          <div className="table-wrap"><table className="table"><tbody>
            {group(ledger, (l) => `${(l.dealers as unknown as { full_name: string; district_code: string })?.full_name} (${(l.dealers as unknown as { district_code: string })?.district_code}) · ${l.kind}`).map(([k, xs]) => <tr key={k}><td>{k}</td><td className="num">{formatInr(sum(xs, (l) => l.amount_paise))}</td></tr>)}
          </tbody></table></div>
          <h2 style={{ fontSize: "1.2rem" }}>Ad revenue by district</h2>
          <div className="table-wrap"><table className="table"><tbody>
            {DISTRICTS.filter((d) => (ads ?? []).some((a) => a.district_code === d.code)).map((d) => {
              const xs = (ads ?? []).filter((a) => a.district_code === d.code);
              return <tr key={d.code}><td>{d.en}</td><td className="num">{xs.length} ads</td><td className="num">{formatInr(sum(xs, (a) => a.amount_paise))}</td><td className="num tiny">paid {formatInr(sum(xs.filter((a) => a.paid), (a) => a.amount_paise))}</td></tr>;
            })}
          </tbody></table></div>
        </section>
      </div>
    </div>
  );
}
