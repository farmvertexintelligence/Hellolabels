"use client";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { findProduct } from "@/lib/catalog/helpers";
import type { Catalog } from "@/lib/catalog/types";
import { clearCart, readCart, type CartState } from "@/lib/cart";
import { isValidGstin, gstinState } from "@/lib/commerce/gst";
import { earliestDelivery } from "@/lib/commerce/logistics";
import { advanceAllowed, amountDueNow, formatInr, priceCart } from "@/lib/commerce/pricing";
import { DISTRICTS, districtByCode } from "@/lib/districts";
import { useI18n } from "@/lib/i18n/client";
import { openRazorpay } from "@/lib/razorpay-client";

interface Props {
  catalog: Catalog;
  user: { phone: string | null; name: string | null; gstin: string | null; districtCode: string | null };
  paymentsReady: boolean;
  dealerShops?: { id: string; name: string; phone: string; address: string; pincode: string | null; district_code: string; gstin: string | null }[];
}

export function CheckoutForm({ catalog, user, paymentsReady, dealerShops }: Props) {
  const { t, lang } = useI18n();
  const router = useRouter();
  const [cart, setCart] = useState<CartState>({ items: [] });
  useEffect(() => setCart(readCart()), []);
  const [shopId, setShopId] = useState<string>("");
  const [f, setF] = useState({
    name: user.name ?? "",
    phone: (user.phone ?? "").replace(/^\+?91/, ""),
    address: "",
    pincode: "",
    districtCode: user.districtCode ?? "SLM",
    gstin: user.gstin ?? "",
    legalName: "",
    plan: "full" as "full" | "advance",
  });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  const district = districtByCode(f.districtCode)!;
  const minDate = earliestDelivery(new Date(), district.zone);
  const [date, setDate] = useState<string>("");
  useEffect(() => setDate((d) => (d && d >= minDate ? d : cart.deliveryDate && cart.deliveryDate >= minDate ? cart.deliveryDate : minDate)), [minDate, cart.deliveryDate]);
  const gstOk = !f.gstin || isValidGstin(f.gstin);
  const priced = useMemo(() => priceCart(catalog, cart.items.map((i) => ({ productId: i.productId, segment: i.segment, qty: i.qty })), f.gstin && gstOk ? gstinState(f.gstin) : "33"), [catalog, cart, f.gstin, gstOk]);
  const segment = cart.items.find((i) => findProduct(catalog, i.productId)?.kind === "water_bottle")?.segment ?? "label";
  const canAdvance = advanceAllowed(catalog, segment, priced.totalPaise);
  const dueNow = amountDueNow(catalog, canAdvance ? f.plan : "full", priced.totalPaise);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function pickShop(id: string) {
    setShopId(id);
    const s = dealerShops?.find((x) => x.id === id);
    if (s) setF({ ...f, name: s.name, phone: s.phone.replace(/^\+?91/, ""), address: s.address, pincode: s.pincode ?? "", districtCode: s.district_code, gstin: s.gstin ?? "" });
  }

  async function pay(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          lines: cart.items.map((i) => ({ productId: i.productId, labelSizeId: i.labelSizeId, segment: i.segment, qty: i.qty, designId: i.designId ?? null, design: i.design })),
          delivery: { name: f.name, phone: f.phone, address: f.address, pincode: f.pincode, districtCode: f.districtCode, date },
          gstin: f.gstin,
          legalName: f.legalName,
          plan: canAdvance ? f.plan : "full",
          lang,
          dealerShopId: shopId || null,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Checkout failed");
      clearCart();
      const outcome = await openRazorpay(j.payment, lang);
      router.push(`/orders/${j.orderId}?pay=${outcome}`);
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  if (!cart.items.length) return <div className="card">{t.order.empty}</div>;

  return (
    <form className="grid" style={{ gap: 20 }} onSubmit={pay}>
      {dealerShops && (
        <div className="card stack">
          <label className="field">
            <span>{t.dealer.shops}</span>
            <select className="select" value={shopId} onChange={(e) => pickShop(e.target.value)} required>
              <option value="">—</option>
              {dealerShops.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
        </div>
      )}
      <div className="card stack">
        <h2 style={{ fontSize: "1.2rem" }}>{t.order.deliveryTo}</h2>
        <label className="field"><span>{t.order.name}</span><input className="input" value={f.name} onChange={set("name")} required minLength={2} maxLength={80} autoComplete="name" /></label>
        <label className="field"><span>{t.order.phone}</span><input className="input" type="tel" inputMode="numeric" value={f.phone} onChange={set("phone")} required pattern="[6-9][0-9]{9}" maxLength={10} autoComplete="tel-national" /></label>
        <label className="field"><span>{t.order.address}</span><textarea className="textarea" value={f.address} onChange={set("address")} required minLength={10} maxLength={400} autoComplete="street-address" /></label>
        <div className="grid grid-2">
          <label className="field"><span>{t.order.pincode}</span><input className="input" inputMode="numeric" value={f.pincode} onChange={set("pincode")} required pattern="6[0-9]{5}" maxLength={6} autoComplete="postal-code" /></label>
          <label className="field">
            <span>{t.order.district}</span>
            <select className="select" value={f.districtCode} onChange={set("districtCode")}>
              {DISTRICTS.map((d) => <option key={d.code} value={d.code}>{lang === "ta" ? d.ta : d.en}</option>)}
            </select>
          </label>
        </div>
        <label className="field">
          <span>{t.order.deliveryDate}</span>
          <input className="input" type="date" min={minDate} value={date} onChange={(e) => setDate(e.target.value)} required />
          <span className="hint">{t.order.earliest}: {minDate}</span>
        </label>
        <details>
          <summary className="small link" style={{ cursor: "pointer" }}>{t.order.gstin}</summary>
          <div className="stack" style={{ marginTop: 10 }}>
            <label className="field"><span>GSTIN</span><input className="input" value={f.gstin} onChange={(e) => setF({ ...f, gstin: e.target.value.toUpperCase() })} maxLength={15} placeholder="33ABCDE1234F1Z5" /></label>
            {!gstOk && <span className="error-text">GSTIN is not valid</span>}
            <label className="field"><span>{t.order.legalName}</span><input className="input" value={f.legalName} onChange={set("legalName")} maxLength={120} /></label>
          </div>
        </details>
      </div>

      <div className="card stack">
        <div className="row between"><span>{t.order.subtotal}</span><span>{formatInr(priced.taxablePaise)}</span></div>
        {priced.intraState ? (
          <>
            <div className="row between small"><span>CGST</span><span>{formatInr(priced.cgstPaise)}</span></div>
            <div className="row between small"><span>SGST</span><span>{formatInr(priced.sgstPaise)}</span></div>
          </>
        ) : (
          <div className="row between small"><span>IGST</span><span>{formatInr(priced.igstPaise)}</span></div>
        )}
        <div className="row between ink" style={{ fontWeight: 700, fontSize: "1.2rem" }}><span>{t.order.total}</span><span>{formatInr(priced.totalPaise)}</span></div>
        {canAdvance && (
          <div className="seg" role="radiogroup">
            <button type="button" aria-pressed={f.plan === "full"} onClick={() => setF({ ...f, plan: "full" })}>{t.order.payFull}</button>
            <button type="button" aria-pressed={f.plan === "advance"} onClick={() => setF({ ...f, plan: "advance" })}>{t.order.payAdvance}</button>
          </div>
        )}
        {priced.errors.length > 0 && <div className="note note-warn small">{priced.errors.map((e) => <div key={e}>{e.split(": ").slice(1).join(": ")}</div>)}</div>}
        {!paymentsReady && <div className="note note-warn small">{t.order.catalogClosed}</div>}
        {err && <div className="note note-err small" role="alert">{err}</div>}
        <button className="btn btn-coral btn-block" disabled={busy || !paymentsReady || priced.errors.length > 0 || !gstOk}>
          {t.order.payNow} {formatInr(dueNow)}
        </button>
        <p className="tiny center" style={{ margin: 0 }}>🔒 {t.order.secure}</p>
      </div>
    </form>
  );
}
