import type { Metadata } from "next";
import Link from "next/link";
import { Eyebrow } from "@/components/Squares";
import { findProduct } from "@/lib/catalog/helpers";
import { formatInr } from "@/lib/commerce/pricing";
import { getDict } from "@/lib/i18n/server";
import { requireRole } from "@/lib/server/auth";
import { getCatalog } from "@/lib/server/catalog";
import { supabaseAdmin } from "@/lib/supabase/server";
import { DataRequest, DeleteDesign, ProfileForm } from "./AccountClient";

export const metadata: Metadata = { title: "My account", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function Account() {
  const user = await requireRole(null, "/account");
  const { t, lang } = await getDict();
  const catalog = await getCatalog();
  const db = supabaseAdmin();
  const [{ data: orders }, { data: designs }] = await Promise.all([
    db.from("orders").select("id, order_no, status, total_paise, delivery_date, created_at").eq("customer_id", user.id).order("created_at", { ascending: false }).limit(50),
    db.from("designs").select("id, name, product_id, updated_at").eq("owner_id", user.id).order("updated_at", { ascending: false }).limit(50),
  ]);
  return (
    <div className="wrap section">
      <Eyebrow>{user.phone}</Eyebrow>
      <div className="row between">
        <h1 style={{ fontSize: "2rem", margin: 0 }}>{t.account.title}</h1>
        <form action="/auth/signout" method="post"><button className="btn btn-ghost btn-sm">{t.account.signOut}</button></form>
      </div>
      {user.role !== "customer" && (
        <div className="note" style={{ marginTop: 12 }}>
          {user.role === "admin" && <Link className="link" href="/admin">Admin panel →</Link>}
          {user.role === "dealer" && <Link className="link" href="/dealer">{t.dealer.portal} →</Link>}
          {user.role === "driver" && <Link className="link" href="/driver">{t.driver.title} →</Link>}
        </div>
      )}
      <div className="grid grid-2" style={{ marginTop: 24, alignItems: "start" }}>
        <section className="stack">
          <h2 style={{ fontSize: "1.3rem" }}>{t.account.orders}</h2>
          {!orders?.length && <p>{t.account.noOrders}</p>}
          {orders?.map((o) => (
            <Link key={o.id} href={`/orders/${o.id}`} className="card card-link row between">
              <div>
                <b className="ink">{o.order_no}</b>
                <div className="tiny">{t.order.deliveryDate}: {o.delivery_date}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <span className="pill">{t.status[o.status as keyof typeof t.status]}</span>
                <div className="small ink">{formatInr(o.total_paise)}</div>
              </div>
            </Link>
          ))}
        </section>
        <section className="stack">
          <h2 style={{ fontSize: "1.3rem" }}>{t.account.designs}</h2>
          {!designs?.length && <p>{t.account.noDesigns}</p>}
          {designs?.map((d) => {
            const p = findProduct(catalog, d.product_id);
            return (
              <div key={d.id} className="card row between">
                <div>
                  <b className="ink">{d.name}</b>
                  <div className="tiny">{p ? (lang === "ta" ? p.nameTa : p.nameEn) : ""}</div>
                </div>
                <div className="row" style={{ gap: 6 }}>
                  <Link className="btn btn-sm" href={`/design?design=${d.id}`}>{t.designer.edit}</Link>
                  <DeleteDesign id={d.id} label={t.designer.delete} />
                </div>
              </div>
            );
          })}
          <h2 style={{ fontSize: "1.3rem", marginTop: 24 }}>{t.account.profile}</h2>
          <div className="card"><ProfileForm name={user.fullName ?? ""} gstin={user.gstin ?? ""} /></div>
          <h2 style={{ fontSize: "1.1rem", marginTop: 16 }}>Your data (DPDP Act)</h2>
          <div className="card"><DataRequest /></div>
        </section>
      </div>
    </div>
  );
}
