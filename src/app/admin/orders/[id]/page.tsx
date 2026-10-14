import { notFound } from "next/navigation";
import { ActionForm } from "@/components/ActionForm";
import { findLabelSize, findProduct } from "@/lib/catalog/helpers";
import { canMoveTo, ORDER_STATUSES, STATUS_TEXT, type OrderStatus } from "@/lib/commerce/logistics";
import { formatInr } from "@/lib/commerce/pricing";
import { regDataFor } from "@/lib/design/regdata";
import { renderLabelSvg } from "@/lib/design/render";
import type { Design } from "@/lib/design/types";
import { districtByCode } from "@/lib/districts";
import { outlineRun, serverMeasure } from "@/lib/print/server-fonts";
import { recordPayment, refund, regeneratePrintFiles, setOrderRoute, setOrderStatus } from "@/lib/server/actions/admin";
import { getCatalog } from "@/lib/server/catalog";
import { getOrder } from "@/lib/server/orders";
import { signedUrls } from "@/lib/server/storage";
import { supabaseAdmin } from "@/lib/supabase/server";

export default async function AdminOrder({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await getOrder(id);
  if (!order) notFound();
  const db = supabaseAdmin();
  const catalog = await getCatalog();
  const [{ data: items }, { data: events }, { data: payments }, { data: packs }, { data: notes }, { data: routes }] = await Promise.all([
    db.from("order_items").select("*").eq("order_id", id),
    db.from("order_events").select("*").eq("order_id", id).order("created_at"),
    db.from("payments").select("*").eq("order_id", id).order("created_at"),
    db.from("packs").select("pack_no, status, cases").eq("order_id", id).order("pack_no"),
    db.from("notifications").select("channel, status, error, created_at, template").eq("order_id", id).order("created_at", { ascending: false }).limit(20),
    db.from("routes").select("code, name").eq("district_code", order.district_code),
  ]);
  // Uploaded photos for the previews.
  const srcs = (items ?? []).flatMap((i) => (i.design as Design).elements.flatMap((e) => (e.type === "image" ? [e.src] : [])));
  const urls = srcs.length ? await signedUrls("uploads", srcs, 3600) : {};
  const next = [...ORDER_STATUSES, "cancelled" as const].filter((s) => canMoveTo(order.status, s as OrderStatus) && s !== "placed");

  return (
    <div className="stack">
      <div className="row between">
        <h1 style={{ fontSize: "1.8rem", margin: 0 }}>{order.order_no}</h1>
        <span className="pill">{STATUS_TEXT[order.status].en}</span>
      </div>
      <div className="grid grid-2" style={{ alignItems: "start" }}>
        <div className="card small stack">
          <div><b className="ink">{order.ship_name}</b> · <a className="link" href={`tel:+91${order.ship_phone}`}>{order.ship_phone}</a></div>
          <div>{order.ship_address}, {districtByCode(order.district_code)?.en} {order.ship_pincode}</div>
          <div>Deliver on <b>{order.delivery_date}</b> · Segment <b>{order.segment}</b> · Plan <b>{order.payment_plan}</b></div>
          {order.buyer_gstin && <div>GSTIN {order.buyer_gstin} {order.buyer_legal_name}</div>}
          <div>Total {formatInr(order.total_paise)} · Paid {formatInr(order.amount_paid_paise)} · Refunded {formatInr(order.amount_refunded_paise)}</div>
          {order.invoice_no && <a className="link" href={`/api/orders/${order.id}/invoice`} target="_blank">Invoice {order.invoice_no}</a>}
          <ActionForm action={setOrderRoute} submit="Set route" small className="row">
            <input type="hidden" name="orderId" value={order.id} />
            <select className="select" name="route" defaultValue={order.route_code ?? ""} style={{ width: "auto" }}>
              <option value="">Route…</option>
              {(routes ?? []).map((r) => <option key={r.code} value={r.code}>{r.code} · {r.name}</option>)}
            </select>
          </ActionForm>
        </div>
        <div className="card stack">
          <b className="ink">Next step</b>
          {next.map((s) => (
            <ActionForm key={s} action={setOrderStatus} submit={s === "cancelled" ? "Cancel order" : `Mark: ${STATUS_TEXT[s as OrderStatus].en}`} small danger={s === "cancelled"} confirm={s === "cancelled" ? "Cancel this order? Refund separately below." : undefined} className="row">
              <input type="hidden" name="orderId" value={order.id} />
              <input type="hidden" name="to" value={s} />
              {s === "design_approved" && <span className="tiny">Approving also makes the CMYK print files.</span>}
              {s === "packed" && <span className="tiny">Creates HL-… pack numbers {order.route_code ? "" : "(set a route first)"}.</span>}
            </ActionForm>
          ))}
          {packs && packs.length > 0 && <a className="btn btn-ghost btn-sm" href={`/api/admin/orders/${order.id}/pack-labels`} target="_blank">🏷 Pack labels with QR ({packs.length})</a>}
          {packs?.map((p) => <div key={p.pack_no} className="tiny">{p.pack_no} · {p.status}{p.cases ? ` · ${p.cases} case(s)` : ""}</div>)}
        </div>
      </div>

      <h2 style={{ fontSize: "1.2rem" }}>Labels</h2>
      {(items ?? []).map((it) => {
        const p = findProduct(catalog, it.product_id);
        const size = findLabelSize(catalog, it.label_size_id);
        const design = it.design as Design;
        const svg = size
          ? renderLabelSvg(design, { size, segment: design.segment, reg: size.hasRegPanel ? regDataFor(catalog, it.product_id) : null, adHref: null, measure: serverMeasure, minTextPt: catalog.settings.minTextPt, resolveImage: (s) => urls[s] ?? null, outline: outlineRun, idPrefix: `a${it.id.slice(0, 6)}` })
          : "";
        const imp = it.imposition as { across: number; rollWidthMm: number; rotated: boolean; frames: number; labelsPerFrame: number; rollLengthMm: number; wastePct: number; labels: number } | null;
        return (
          <div key={it.id} className="card stack">
            <div className="row between"><b className="ink">{p?.nameEn} × {it.qty} ({it.items} pcs)</b><span>{formatInr(it.total_paise)}</span></div>
            <div className="label-frame" dangerouslySetInnerHTML={{ __html: svg }} />
            <div className="row">
              {it.proof_pdf_path && <a className="btn btn-ghost btn-sm" href={`/api/admin/orders/${order.id}/file?item=${it.id}&kind=proof`} target="_blank">Proof PDF</a>}
              {it.roll_pdf_path && <a className="btn btn-ghost btn-sm" href={`/api/admin/orders/${order.id}/file?item=${it.id}&kind=roll`} target="_blank">Memjet roll PDF</a>}
              {imp && <span className="tiny">{imp.labels} labels · {imp.across} across on {imp.rollWidthMm} mm roll{imp.rotated ? " (rotated)" : ""} · {imp.frames} × {imp.labelsPerFrame}/frame · {(imp.rollLengthMm / 1000).toFixed(1)} m · waste {imp.wastePct}%</span>}
            </div>
          </div>
        );
      })}
      {order.status !== "pending_payment" && (
        <ActionForm action={regeneratePrintFiles} submit="Re-make print files" small className="row"><input type="hidden" name="orderId" value={order.id} /></ActionForm>
      )}

      <div className="grid grid-2" style={{ alignItems: "start" }}>
        <div className="card stack small">
          <b className="ink">Payments</b>
          {(payments ?? []).map((p) => (
            <div key={p.id} className="stack" style={{ borderBottom: "1px solid var(--line)", paddingBottom: 8 }}>
              <div className="row between"><span>{p.purpose} · {p.provider} · {p.method ?? ""}</span><b>{formatInr(p.amount_paise)}</b></div>
              <div className="tiny">{p.status}{p.refunded_paise ? ` · refunded ${formatInr(p.refunded_paise)}` : ""} · {p.provider_payment_id ?? p.provider_order_id ?? ""} {p.error_description ?? ""}</div>
              {p.provider === "razorpay" && ["captured", "partially_refunded"].includes(p.status) && (
                <ActionForm action={refund} submit="Refund" small danger confirm="Send this refund to Razorpay?" className="row">
                  <input type="hidden" name="paymentId" value={p.id} />
                  <input type="hidden" name="orderId" value={order.id} />
                  <input className="input" name="amount" placeholder="₹" defaultValue={((p.amount_paise - p.refunded_paise) / 100).toFixed(2)} style={{ width: 110 }} />
                  <input className="input" name="reason" placeholder="Reason" style={{ width: 160 }} required />
                </ActionForm>
              )}
            </div>
          ))}
          {order.total_paise > order.amount_paid_paise && order.status !== "pending_payment" && (
            <ActionForm action={recordPayment} submit="Record cash/UPI received" small className="row">
              <input type="hidden" name="orderId" value={order.id} />
              <input className="input" name="amount" defaultValue={((order.total_paise - order.amount_paid_paise) / 100).toFixed(2)} style={{ width: 120 }} />
              <select className="select" name="method" style={{ width: "auto" }}><option value="cash">Cash</option><option value="upi_offline">UPI</option></select>
            </ActionForm>
          )}
        </div>
        <div className="card stack small">
          <b className="ink">History</b>
          {(events ?? []).map((e) => <div key={e.id}>{new Date(e.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} · {STATUS_TEXT[e.status as OrderStatus].en}{e.note ? ` — ${e.note}` : ""}</div>)}
          <b className="ink" style={{ marginTop: 8 }}>Messages</b>
          {(notes ?? []).map((n, i) => <div key={i} className="tiny">{n.channel} · {n.status}{n.error ? ` (${n.error})` : ""} · {new Date(n.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</div>)}
        </div>
      </div>
    </div>
  );
}
