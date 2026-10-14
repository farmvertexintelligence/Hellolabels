import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase/server";

/** Print order → Pack order → Stock → Load order, created automatically for every paid order. */
export default async function Production() {
  const db = supabaseAdmin();
  const [{ data: prints }, { data: packsTodo }, { data: stock }, { data: unassigned }] = await Promise.all([
    db.from("print_orders").select("status, created_at, orders!inner(id, order_no, status, delivery_date, district_code)").neq("status", "printed").order("created_at").limit(100),
    db.from("pack_orders").select("status, orders!inner(id, order_no, status, delivery_date, route_code)").eq("status", "pending").limit(100),
    db.from("packs").select("pack_no, status, created_at, orders(order_no, delivery_date)").eq("status", "packed").order("created_at").limit(200),
    db.from("load_orders").select("status, orders!inner(id, order_no, status, delivery_date, district_code, route_code)").eq("status", "unassigned").limit(200),
  ]);
  type O = { id: string; order_no: string; status: string; delivery_date: string; district_code?: string; route_code?: string | null };
  const o = (x: unknown) => x as O;
  return (
    <div className="grid grid-2" style={{ alignItems: "start" }}>
      <section className="stack">
        <h2 style={{ fontSize: "1.2rem" }}>1 · Print orders</h2>
        <div className="table-wrap"><table className="table"><thead><tr><th>Order</th><th>Status</th><th>Deliver</th></tr></thead><tbody>
          {(prints ?? []).map((p, i) => <tr key={i}><td><Link className="link" href={`/admin/orders/${o(p.orders).id}`}>{o(p.orders).order_no}</Link></td><td>{p.status} · {o(p.orders).status}</td><td>{o(p.orders).delivery_date}</td></tr>)}
          {!prints?.length && <tr><td colSpan={3}>Nothing to print.</td></tr>}
        </tbody></table></div>
        <p className="tiny">Approve the design on the order page — the CMYK proof and Memjet roll PDFs are made automatically.</p>
      </section>
      <section className="stack">
        <h2 style={{ fontSize: "1.2rem" }}>2 · Pack orders</h2>
        <div className="table-wrap"><table className="table"><thead><tr><th>Order</th><th>Status</th><th>Route</th></tr></thead><tbody>
          {(packsTodo ?? []).filter((p) => ["printed", "design_approved"].includes(o(p.orders).status)).map((p, i) => <tr key={i}><td><Link className="link" href={`/admin/orders/${o(p.orders).id}`}>{o(p.orders).order_no}</Link></td><td>{o(p.orders).status}</td><td>{o(p.orders).route_code ?? <span className="error-text">set route</span>}</td></tr>)}
        </tbody></table></div>
      </section>
      <section className="stack">
        <h2 style={{ fontSize: "1.2rem" }}>3 · Stock (packed, in warehouse)</h2>
        <div className="table-wrap"><table className="table"><thead><tr><th>Pack</th><th>Order</th><th>Deliver</th></tr></thead><tbody>
          {(stock ?? []).map((s) => <tr key={s.pack_no}><td className="tiny">{s.pack_no}</td><td>{(s.orders as unknown as { order_no: string }).order_no}</td><td>{(s.orders as unknown as { delivery_date: string }).delivery_date}</td></tr>)}
          {!stock?.length && <tr><td colSpan={3}>Warehouse is empty.</td></tr>}
        </tbody></table></div>
      </section>
      <section className="stack">
        <h2 style={{ fontSize: "1.2rem" }}>4 · Load orders waiting for a truck</h2>
        <div className="table-wrap"><table className="table"><thead><tr><th>Order</th><th>Status</th><th>Route</th><th>Deliver</th></tr></thead><tbody>
          {(unassigned ?? []).filter((l) => o(l.orders).status !== "cancelled").map((l, i) => <tr key={i}><td><Link className="link" href={`/admin/orders/${o(l.orders).id}`}>{o(l.orders).order_no}</Link></td><td>{o(l.orders).status}</td><td>{o(l.orders).district_code} {o(l.orders).route_code}</td><td>{o(l.orders).delivery_date}</td></tr>)}
        </tbody></table></div>
        <Link className="btn btn-sm" href="/admin/trips">Plan trucks →</Link>
      </section>
    </div>
  );
}
