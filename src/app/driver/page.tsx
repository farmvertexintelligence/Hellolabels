import type { Metadata } from "next";
import { Eyebrow } from "@/components/Squares";
import { istToday } from "@/lib/commerce/logistics";
import type { Dict } from "@/lib/i18n/dict";
import { getDict } from "@/lib/i18n/server";
import { requireRole } from "@/lib/server/auth";
import { supabaseAdmin } from "@/lib/supabase/server";
import { CollectForm, Scanner } from "./Scanner";

export const metadata: Metadata = { title: "Driver", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function Driver() {
  const user = await requireRole(["driver", "admin"], "/driver");
  const { t } = await getDict();
  const db = supabaseAdmin();
  const today = istToday();
  let q = db.from("trips").select("id, trip_date, route_code, district_code, status, trucks(reg_no)").gte("trip_date", today).order("trip_date").limit(5);
  if (user.role === "driver") q = q.eq("driver_id", user.id);
  const { data: trips } = await q;

  return (
    <div className="wrap section" style={{ maxWidth: 640, paddingTop: 20 }}>
      <Eyebrow>{t.driver.title}</Eyebrow>
      <h1 style={{ fontSize: "1.8rem" }}>{t.driver.title}</h1>
      <Scanner />
      {(trips ?? []).map((trip) => (
        <TripSection key={trip.id} trip={trip as unknown as Trip} t={t} />
      ))}
      {!trips?.length && <p style={{ marginTop: 24 }}>No trips assigned.</p>}
    </div>
  );
}

type Trip = { id: string; trip_date: string; route_code: string; district_code: string; trucks: { reg_no: string } | null };

async function TripSection({ trip, t }: { trip: Trip; t: Dict }) {
  const db = supabaseAdmin();
        const { data: stops } = await db
          .from("load_orders")
          .select("stop_seq, load_seq, orders(id, order_no, status, ship_name, ship_phone, ship_address, ship_pincode, total_paise, amount_paid_paise), order_id")
          .eq("trip_id", trip.id)
          .order("stop_seq");
        const orderIds = (stops ?? []).map((s) => s.order_id);
        const { data: packs } = orderIds.length ? await db.from("packs").select("pack_no, order_id, status").in("order_id", orderIds) : { data: [] };
        return (
          <section key={trip.id} className="stack" style={{ marginTop: 24 }}>
            <h2 style={{ fontSize: "1.2rem" }}>
              {trip.trip_date} · {trip.district_code} {trip.route_code} · {trip.trucks?.reg_no}
            </h2>
            {(stops ?? []).map((s) => {
              const o = s.orders as unknown as { id: string; order_no: string; status: string; ship_name: string; ship_phone: string; ship_address: string; ship_pincode: string; total_paise: number; amount_paid_paise: number };
              const mine = (packs ?? []).filter((p) => p.order_id === s.order_id);
              const done = mine.filter((p) => p.status === "delivered").length;
              const balance = o.total_paise - o.amount_paid_paise;
              return (
                <article key={o.id} className="card stack" style={{ borderLeft: `5px solid ${o.status === "delivered" ? "var(--teal)" : "var(--coral)"}` }}>
                  <div className="row between">
                    <b className="ink">#{s.stop_seq} · {o.ship_name}</b>
                    <span className="pill">{t.status[o.status as keyof typeof t.status]}</span>
                  </div>
                  <div className="small">{o.ship_address} {o.ship_pincode}</div>
                  <div className="row">
                    <a className="btn btn-ghost btn-sm" href={`tel:+91${o.ship_phone}`}>📞 {t.driver.call}</a>
                    <a className="btn btn-ghost btn-sm" target="_blank" rel="noopener" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${o.ship_address} ${o.ship_pincode}`)}`}>📍 {t.driver.map}</a>
                  </div>
                  <div className="tiny">{o.order_no} · packs {done}/{mine.length}: {mine.map((p) => `${p.pack_no.slice(-4)}${p.status === "delivered" ? "✓" : ""}`).join(" ")}</div>
                  {balance > 0 && o.status !== "pending_payment" && <CollectForm orderId={o.id} balancePaise={balance} />}
                </article>
              );
            })}
            {!stops?.length && <p className="small">No stops yet.</p>}
          </section>
        );
      }
