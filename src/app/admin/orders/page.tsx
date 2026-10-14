import Link from "next/link";
import { formatInr } from "@/lib/commerce/pricing";
import { STATUS_TEXT, type OrderStatus } from "@/lib/commerce/logistics";
import { supabaseAdmin } from "@/lib/supabase/server";

const FILTERS: (OrderStatus | "all")[] = ["all", "pending_payment", "placed", "design_approved", "printed", "packed", "loaded", "delivered", "cancelled"];

export default async function AdminOrders({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  const { status = "all", q } = await searchParams;
  let query = supabaseAdmin().from("orders").select("id, order_no, status, segment, total_paise, amount_paid_paise, delivery_date, ship_name, ship_phone, district_code, route_code, placed_by_dealer_id, created_at").order("created_at", { ascending: false }).limit(200);
  if (status !== "all") query = query.eq("status", status);
  if (q) query = query.or(`order_no.ilike.%${q.replace(/[%,()]/g, "")}%,ship_phone.ilike.%${q.replace(/\D/g, "")}%,ship_name.ilike.%${q.replace(/[%,()]/g, "")}%`);
  const { data: orders } = await query;
  return (
    <div className="stack">
      <h1 style={{ fontSize: "1.8rem", margin: 0 }}>Orders</h1>
      <form className="row">
        <input className="input" name="q" defaultValue={q} placeholder="Order no, phone or name" style={{ maxWidth: 320 }} />
        <input type="hidden" name="status" value={status} />
        <button className="btn btn-sm">Search</button>
      </form>
      <div className="admin-nav">
        {FILTERS.map((f) => (
          <Link key={f} href={`/admin/orders?status=${f}`} aria-current={status === f ? "page" : undefined}>{f === "all" ? "All" : STATUS_TEXT[f].en}</Link>
        ))}
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Order</th><th>Customer</th><th>Segment</th><th>Status</th><th>Deliver</th><th>Route</th><th className="num">Total</th><th className="num">Paid</th></tr></thead>
          <tbody>
            {(orders ?? []).map((o) => (
              <tr key={o.id}>
                <td><Link className="link" href={`/admin/orders/${o.id}`}>{o.order_no}</Link>{o.placed_by_dealer_id && <div className="tiny">via dealer</div>}</td>
                <td>{o.ship_name}<div className="tiny">{o.ship_phone}</div></td>
                <td>{o.segment}</td>
                <td><span className="pill">{STATUS_TEXT[o.status as OrderStatus].en}</span></td>
                <td>{o.delivery_date}</td>
                <td>{o.district_code} {o.route_code ?? <span className="error-text">—</span>}</td>
                <td className="num">{formatInr(o.total_paise)}</td>
                <td className="num">{formatInr(o.amount_paid_paise)}</td>
              </tr>
            ))}
            {!orders?.length && <tr><td colSpan={8}>No orders.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
