import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/ActionForm";
import { STATUS_TEXT, type OrderStatus } from "@/lib/commerce/logistics";
import { markTripLoaded, removeFromTrip, reorderStops } from "@/lib/server/actions/admin";
import { supabaseAdmin } from "@/lib/supabase/server";

export default async function TripPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = supabaseAdmin();
  const { data: trip } = await db.from("trips").select("*, trucks(reg_no), profiles(full_name, phone)").eq("id", id).maybeSingle();
  if (!trip) notFound();
  const { data: stops } = await db.from("load_orders").select("order_id, stop_seq, load_seq, status, orders(order_no, status, ship_name, ship_address)").eq("trip_id", id).order("stop_seq");
  return (
    <div className="stack">
      <h1 style={{ fontSize: "1.6rem", margin: 0 }}>Trip {trip.trip_date} · {trip.district_code} {trip.route_code}</h1>
      <div className="small">Truck {(trip.trucks as { reg_no: string })?.reg_no} · Driver {(trip.profiles as { full_name: string | null; phone: string })?.full_name ?? (trip.profiles as { phone: string })?.phone} · {trip.status}</div>
      <ActionForm action={reorderStops} submit="Save stop order">
        <input type="hidden" name="tripId" value={id} />
        <div className="table-wrap"><table className="table"><thead><tr><th>Stop #</th><th>Load #</th><th>Order</th><th>Customer</th><th>Status</th></tr></thead><tbody>
          {(stops ?? []).map((s) => {
            const o = s.orders as unknown as { order_no: string; status: string; ship_name: string; ship_address: string };
            return (
              <tr key={s.order_id}>
                <td><input type="hidden" name="orderId" value={s.order_id} /><input className="input" name={`stop:${s.order_id}`} defaultValue={s.stop_seq ?? ""} inputMode="numeric" style={{ width: 70 }} /></td>
                <td>{s.load_seq}</td>
                <td>{o.order_no}</td>
                <td>{o.ship_name}<div className="tiny">{o.ship_address}</div></td>
                <td>{STATUS_TEXT[o.status as OrderStatus].en}</td>
              </tr>
            );
          })}
        </tbody></table></div>
      </ActionForm>
      {(stops ?? []).filter((s) => s.status !== "loaded").map((s) => (
        <ActionForm key={s.order_id} action={removeFromTrip} submit={`Remove ${(s.orders as unknown as { order_no: string }).order_no}`} small danger className="row">
          <input type="hidden" name="orderId" value={s.order_id} /><input type="hidden" name="tripId" value={id} />
        </ActionForm>
      ))}
      <div className="row">
        <Link className="btn btn-ghost" href={`/admin/trips/${id}/sheet`}>🖨 Load sheet</Link>
        <ActionForm action={markTripLoaded} submit="All packed orders loaded ✓" className="row"><input type="hidden" name="tripId" value={id} /></ActionForm>
      </div>
    </div>
  );
}
