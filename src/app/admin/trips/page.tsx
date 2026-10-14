import Link from "next/link";
import { ActionForm } from "@/components/ActionForm";
import { istToday } from "@/lib/commerce/logistics";
import { DISTRICTS } from "@/lib/districts";
import { createTrip, saveRoute, saveTruck } from "@/lib/server/actions/admin";
import { supabaseAdmin } from "@/lib/supabase/server";

export default async function Trips({ searchParams }: { searchParams: Promise<{ date?: string; district?: string; route?: string }> }) {
  const sp = await searchParams;
  const date = sp.date ?? istToday();
  const district = sp.district ?? "SLM";
  const db = supabaseAdmin();
  const [{ data: trucks }, { data: drivers }, { data: routes }, { data: trips }, { data: ready }] = await Promise.all([
    db.from("trucks").select("*").eq("active", true).order("reg_no"),
    db.from("profiles").select("id, full_name, phone").eq("role", "driver"),
    db.from("routes").select("*").order("district_code").order("code"),
    db.from("trips").select("id, trip_date, district_code, route_code, status, trucks(reg_no), profiles(full_name, phone)").gte("trip_date", istToday()).order("trip_date").limit(50),
    db.from("load_orders").select("order_id, orders!inner(id, order_no, status, delivery_date, district_code, route_code, ship_name, ship_address)").eq("status", "unassigned").eq("orders.district_code", district).in("orders.status", ["packed", "printed", "design_approved", "placed"]).lte("orders.delivery_date", date),
  ]);
  type O = { id: string; order_no: string; status: string; delivery_date: string; route_code: string | null; ship_name: string; ship_address: string };
  const byRoute = new Map<string, O[]>();
  for (const r of ready ?? []) {
    const o = r.orders as unknown as O;
    if (sp.route && o.route_code !== sp.route) continue;
    const k = o.route_code ?? "—";
    byRoute.set(k, [...(byRoute.get(k) ?? []), o]);
  }

  return (
    <div className="stack">
      <h1 style={{ fontSize: "1.8rem", margin: 0 }}>Truck planning</h1>
      <form className="row card">
        <label className="field"><span>Delivery up to</span><input className="input" type="date" name="date" defaultValue={date} /></label>
        <label className="field"><span>District</span><select className="select" name="district" defaultValue={district}>{DISTRICTS.map((d) => <option key={d.code} value={d.code}>{d.en}</option>)}</select></label>
        <button className="btn btn-sm">Show</button>
      </form>

      {[...byRoute.entries()].map(([route, orders]) => (
        <section key={route} className="card stack">
          <h2 style={{ fontSize: "1.2rem", margin: 0 }}>Route {route} · {orders.length} order(s)</h2>
          {route === "—" ? (
            <p className="small error-text">These orders have no route yet — set one on the order page.</p>
          ) : (
            <ActionForm action={createTrip} submit="Create trip">
              <input type="hidden" name="district" value={district} />
              <input type="hidden" name="route" value={route} />
              <p className="tiny">Tick the orders in delivery order (first stop first). The load sheet loads the last stop first so the first stop&rsquo;s packs are at the door.</p>
              {orders.map((o) => (
                <label key={o.id} className="check small">
                  <input type="checkbox" name="orderId" value={o.id} defaultChecked={o.status === "packed"} />
                  <span><b>{o.order_no}</b> · {o.ship_name} · {o.ship_address.slice(0, 60)} · <i>{o.status}</i> · {o.delivery_date}</span>
                </label>
              ))}
              <div className="grid grid-3">
                <label className="field"><span>Date</span><input className="input" type="date" name="date" defaultValue={date} required /></label>
                <label className="field"><span>Truck</span><select className="select" name="truckId" required>{(trucks ?? []).map((t) => <option key={t.id} value={t.id}>{t.reg_no} {t.name ?? ""}</option>)}</select></label>
                <label className="field"><span>Driver</span><select className="select" name="driverId" required>{(drivers ?? []).map((d) => <option key={d.id} value={d.id}>{d.full_name ?? d.phone}</option>)}</select></label>
              </div>
            </ActionForm>
          )}
        </section>
      ))}
      {!byRoute.size && <p className="small">No orders waiting for a truck in this district.</p>}

      <h2 style={{ fontSize: "1.3rem" }}>Upcoming trips</h2>
      <div className="table-wrap"><table className="table"><thead><tr><th>Date</th><th>Route</th><th>Truck</th><th>Driver</th><th>Status</th><th /></tr></thead><tbody>
        {(trips ?? []).map((t) => (
          <tr key={t.id}>
            <td>{t.trip_date}</td><td>{t.district_code} {t.route_code}</td>
            <td>{(t.trucks as unknown as { reg_no: string })?.reg_no}</td>
            <td>{(t.profiles as unknown as { full_name: string | null; phone: string })?.full_name ?? (t.profiles as unknown as { phone: string })?.phone}</td>
            <td>{t.status}</td>
            <td><Link className="link" href={`/admin/trips/${t.id}`}>Stops</Link> · <Link className="link" href={`/admin/trips/${t.id}/sheet`}>Load sheet</Link></td>
          </tr>
        ))}
      </tbody></table></div>

      <div className="grid grid-2" style={{ alignItems: "start" }}>
        <div className="card stack">
          <h2 style={{ fontSize: "1.1rem", margin: 0 }}>Trucks</h2>
          {(trucks ?? []).map((t) => <div key={t.id} className="small">{t.reg_no} · {t.name} · {t.capacity_cases} cases</div>)}
          <ActionForm action={saveTruck} submit="Save truck" className="row">
            <input className="input" name="regNo" placeholder="TN 52 AB 1234" required style={{ maxWidth: 160 }} />
            <input className="input" name="name" placeholder="Name" style={{ maxWidth: 140 }} />
            <input className="input" name="capacity" placeholder="Cases" inputMode="numeric" style={{ maxWidth: 90 }} />
          </ActionForm>
          <p className="tiny">Drivers: give a staff member the driver role in Customers &amp; staff.</p>
        </div>
        <div className="card stack">
          <h2 style={{ fontSize: "1.1rem", margin: 0 }}>Routes</h2>
          {(routes ?? []).map((r) => <div key={`${r.district_code}${r.code}`} className="small"><b>{r.district_code} {r.code}</b> {r.name} · {(r.stops as string[]).join(" → ")} · pincodes {(r.pincodes as string[]).join(", ")}</div>)}
          <ActionForm action={saveRoute} submit="Save route">
            <div className="row">
              <input className="input" name="district" placeholder="SLM" required style={{ maxWidth: 90 }} />
              <input className="input" name="code" placeholder="R3" required style={{ maxWidth: 80 }} />
              <input className="input" name="name" placeholder="Name" style={{ maxWidth: 200 }} />
            </div>
            <input className="input" name="stops" placeholder="Stops in order, comma separated" />
            <input className="input" name="pincodes" placeholder="Pincodes on this route (orders are auto-assigned)" />
          </ActionForm>
        </div>
      </div>
    </div>
  );
}
