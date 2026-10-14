import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Eyebrow } from "@/components/Squares";
import { findProduct, GLASS_PACKING_NOTE } from "@/lib/catalog/helpers";
import type { Segment } from "@/lib/catalog/types";
import { ORDER_STATUSES } from "@/lib/commerce/logistics";
import { formatInr } from "@/lib/commerce/pricing";
import type { Design } from "@/lib/design/types";
import { districtByCode } from "@/lib/districts";
import { getDict } from "@/lib/i18n/server";
import { requireRole } from "@/lib/server/auth";
import { getCatalog } from "@/lib/server/catalog";
import { getOrder } from "@/lib/server/orders";
import { payableNow } from "@/lib/server/payments";
import { supabaseAdmin } from "@/lib/supabase/server";
import { AutoRefresh, PayButton, ReorderButton } from "./OrderActions";

export const metadata: Metadata = { title: "Your order", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function OrderPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ pay?: string }> }) {
  const { id } = await params;
  const { pay } = await searchParams;
  const user = await requireRole(null, `/orders/${id}`);
  const { t, lang } = await getDict();
  const order = await getOrder(id);
  if (!order || (order.customer_id !== user.id && order.placed_by_dealer_id !== user.id && user.role !== "admin")) notFound();
  const catalog = await getCatalog();
  const db = supabaseAdmin();
  const [{ data: items }, { data: events }, { data: payments }] = await Promise.all([
    db.from("order_items").select("product_id, label_size_id, qty, items, total_paise, design, design_id").eq("order_id", id),
    db.from("order_events").select("status, created_at, note").eq("order_id", id).order("created_at"),
    db.from("payments").select("purpose, provider, amount_paise, status, created_at, method").eq("order_id", id).order("created_at"),
  ]);
  const due = await payableNow(order);
  const reached = new Map((events ?? []).map((e) => [e.status, e.created_at as string]));
  const currentIdx = ORDER_STATUSES.indexOf(order.status as (typeof ORDER_STATUSES)[number]);
  const hasGlass = (items ?? []).some((i) => findProduct(catalog, i.product_id)?.bottleType === "glass");

  return (
    <div className="wrap section" style={{ maxWidth: 820 }}>
      <AutoRefresh active={pay === "ok" && order.status === "pending_payment"} />
      <Eyebrow>{t.order.orderNo} {order.order_no}</Eyebrow>
      <h1 style={{ fontSize: "2rem" }}>{t.status[order.status]}</h1>
      {pay === "ok" && order.status === "pending_payment" && <div className="note">{t.order.paymentPending}</div>}
      {pay === "ok" && order.status !== "pending_payment" && <div className="note note-ok">{t.order.placed}</div>}
      {pay === "failed" && <div className="note note-err">{t.order.paymentFailed}</div>}

      <div className="grid grid-2" style={{ marginTop: 20, alignItems: "start" }}>
        <div className="card">
          <ol className="timeline">
            {ORDER_STATUSES.map((s, i) => {
              const at = reached.get(s);
              const cls = order.status === "cancelled" ? "" : i < currentIdx || (i === currentIdx && s === "delivered") ? "done" : i === currentIdx ? "done current" : "";
              return (
                <li key={s} className={cls}>
                  <span className="dot">{cls.includes("done") ? "✓" : ""}</span>
                  <div>
                    <div className="ink" style={{ fontWeight: 600 }}>{t.status[s]}</div>
                    {at && <div className="tiny">{new Date(at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })}</div>}
                  </div>
                </li>
              );
            })}
          </ol>
          {order.status === "cancelled" && <div className="note note-err">{t.status.cancelled}</div>}
        </div>
        <div className="stack">
          <div className="card stack small">
            <div className="row between"><span>{t.order.deliveryDate}</span><b className="ink">{order.delivery_date}</b></div>
            <div>
              <div className="ink" style={{ fontWeight: 600 }}>{order.ship_name}</div>
              <div>{order.ship_address}, {districtByCode(order.district_code)?.[lang === "ta" ? "ta" : "en"]} {order.ship_pincode}</div>
            </div>
            <hr className="rule" />
            {(items ?? []).map((i, k) => {
              const p = findProduct(catalog, i.product_id);
              return (
                <div key={k} className="row between">
                  <span>{p ? (lang === "ta" ? p.nameTa : p.nameEn) : i.product_id} × {i.qty} {p?.unit === "case" ? t.product.cases : ""}</span>
                  <span>{formatInr(i.total_paise)}</span>
                </div>
              );
            })}
            <div className="row between ink" style={{ fontWeight: 700 }}><span>{t.order.total}</span><span>{formatInr(order.total_paise)}</span></div>
            {(payments ?? []).filter((p) => p.status === "captured" || p.status.includes("refund")).map((p, k) => (
              <div key={k} className="row between tiny"><span>✓ {p.purpose} · {p.method ?? p.provider}</span><span>{formatInr(p.amount_paise)}</span></div>
            ))}
            {order.amount_refunded_paise > 0 && <div className="row between tiny"><span>Refunded</span><span>−{formatInr(order.amount_refunded_paise)}</span></div>}
            {order.status !== "pending_payment" && order.total_paise > order.amount_paid_paise && (
              <div className="row between"><span>{t.order.balanceDue}</span><b>{formatInr(order.total_paise - order.amount_paid_paise)}</b></div>
            )}
          </div>
          {due && due.amountPaise > 0 && order.status !== "cancelled" && <PayButton orderId={order.id} label={`${t.order.payNow} ${formatInr(due.amountPaise)}`} />}
          {hasGlass && <div className="note small">🫧 {GLASS_PACKING_NOTE[lang]}</div>}
          <div className="row">
            {order.invoice_no && <a className="btn btn-ghost" href={`/api/orders/${order.id}/invoice`} target="_blank" rel="noopener">🧾 {t.order.invoice}</a>}
            <ReorderButton
              label={t.order.reorder}
              items={(items ?? []).map((i) => ({ productId: i.product_id, labelSizeId: i.label_size_id, segment: (i.design as Design).segment as Segment, qty: i.qty, design: i.design as Design, designId: i.design_id }))}
            />
          </div>
          <Link href="/account" className="link small">← {t.account.orders}</Link>
        </div>
      </div>
    </div>
  );
}
