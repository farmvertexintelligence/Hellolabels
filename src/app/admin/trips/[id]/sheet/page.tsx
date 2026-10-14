import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { PrintButton } from "@/components/PrintButton";
import { supabaseAdmin } from "@/lib/supabase/server";

/** Printable load sheet: loading order (last stop first) and the delivery run sheet. */
export default async function LoadSheet({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = supabaseAdmin();
  const { data: trip } = await db.from("trips").select("*, trucks(reg_no, name), profiles(full_name, phone)").eq("id", id).maybeSingle();
  if (!trip) notFound();
  const { data: stops } = await db.from("load_orders").select("order_id, stop_seq, load_seq, orders(order_no, ship_name, ship_phone, ship_address, ship_pincode, total_paise, amount_paid_paise)").eq("trip_id", id).order("load_seq");
  const ids = (stops ?? []).map((s) => s.order_id);
  const { data: packs } = ids.length ? await db.from("packs").select("pack_no, order_id, cases").in("order_id", ids).order("pack_no") : { data: [] };
  const qr = await QRCode.toDataURL(`trip:${id}`, { margin: 0, width: 120 });
  type O = { order_no: string; ship_name: string; ship_phone: string; ship_address: string; ship_pincode: string; total_paise: number; amount_paid_paise: number };
  const totalCases = (packs ?? []).reduce((a, p) => a + (p.cases ?? 0), 0);
  return (
    <div className="stack" style={{ background: "#fff", padding: 20, borderRadius: 12 }}>
      <div className="row between">
        <div>
          <h1 style={{ fontSize: "1.6rem", margin: 0 }}>Load sheet · {trip.trip_date}</h1>
          <div>Route {trip.district_code} {trip.route_code} · Truck {(trip.trucks as { reg_no: string })?.reg_no} · Driver {(trip.profiles as { full_name: string | null })?.full_name} {(trip.profiles as { phone: string })?.phone}</div>
          <div className="small">{stops?.length ?? 0} stops · {packs?.length ?? 0} packs · {totalCases} cases</div>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qr} alt="" width={90} height={90} />
      </div>
      <PrintButton />
      <h2 style={{ fontSize: "1.1rem" }}>1 · Load in this order (deepest in the truck first)</h2>
      <table className="table">
        <thead><tr><th>Load #</th><th>Stop #</th><th>Order</th><th>Packs</th><th>✓</th></tr></thead>
        <tbody>
          {(stops ?? []).map((s) => (
            <tr key={s.order_id}>
              <td style={{ fontSize: "1.3rem", fontWeight: 700 }}>{s.load_seq}</td>
              <td>{s.stop_seq}</td>
              <td>{(s.orders as unknown as O).order_no}<div className="tiny">{(s.orders as unknown as O).ship_name}</div></td>
              <td className="tiny">{(packs ?? []).filter((p) => p.order_id === s.order_id).map((p) => p.pack_no).join(", ")}</td>
              <td>☐</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h2 style={{ fontSize: "1.1rem" }}>2 · Deliver in this order</h2>
      <table className="table">
        <thead><tr><th>Stop</th><th>Customer</th><th>Address</th><th>Phone</th><th className="num">Collect</th><th>Sign</th></tr></thead>
        <tbody>
          {[...(stops ?? [])].sort((a, b) => (a.stop_seq ?? 0) - (b.stop_seq ?? 0)).map((s) => {
            const o = s.orders as unknown as O;
            const due = o.total_paise - o.amount_paid_paise;
            return (
              <tr key={s.order_id}>
                <td style={{ fontWeight: 700 }}>{s.stop_seq}</td>
                <td>{o.ship_name}<div className="tiny">{o.order_no}</div></td>
                <td className="small">{o.ship_address} {o.ship_pincode}</td>
                <td>{o.ship_phone}</td>
                <td className="num">{due > 0 ? `₹${(due / 100).toFixed(2)}` : "—"}</td>
                <td style={{ width: 90 }} />
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
