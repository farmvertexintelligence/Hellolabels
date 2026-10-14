"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { LabelView } from "@/components/design/LabelView";
import { useImageUrls, useLabelFonts } from "@/components/design/browser";
import { findLabelSize, findProduct, GLASS_PACKING_NOTE } from "@/lib/catalog/helpers";
import type { Catalog } from "@/lib/catalog/types";
import { onCartChange, readCart, removeItem, updateItem, writeCart, type CartState } from "@/lib/cart";
import { earliestDelivery } from "@/lib/commerce/logistics";
import { formatInr, priceCart, qtyError } from "@/lib/commerce/pricing";
import { regDataFor } from "@/lib/design/regdata";
import { useI18n } from "@/lib/i18n/client";

export function CartView({ catalog }: { catalog: Catalog }) {
  const { t, lang } = useI18n();
  const [cart, setCart] = useState<CartState>({ items: [] });
  useEffect(() => {
    setCart(readCart());
    return onCartChange(() => setCart(readCart()));
  }, []);
  const priced = useMemo(() => priceCart(catalog, cart.items.map((i) => ({ productId: i.productId, segment: i.segment, qty: i.qty }))), [catalog, cart]);
  const fontTick = useLabelFonts(cart.items[0]?.design ?? null);
  const resolve = useImageUrls(null, cart.items.flatMap((i) => i.design.elements.flatMap((e) => (e.type === "image" ? [e.src] : []))));
  const minDate = earliestDelivery(new Date(), 1);

  if (!cart.items.length)
    return (
      <div className="card center stack">
        <p>{t.order.empty}</p>
        <div><Link className="btn btn-coral" href="/design">✨ {t.home.ctaDesign}</Link></div>
      </div>
    );

  return (
    <div className="grid" style={{ gap: 20 }}>
      {cart.items.map((item, idx) => {
        const p = findProduct(catalog, item.productId);
        const size = findLabelSize(catalog, item.labelSizeId);
        if (!p || !size) return null;
        const line = priced.lines[idx];
        const err = qtyError(catalog, p.id, item.qty);
        return (
          <article key={item.key} className="card stack">
            <LabelView design={item.design} size={size} segment={item.segment} reg={size.hasRegPanel ? regDataFor(catalog, p.id) : null} minTextPt={catalog.settings.minTextPt} lang={lang} resolveImage={resolve} fontTick={fontTick} idPrefix={`c${idx}`} />
            <div className="row between">
              <div>
                <div className="ink" style={{ fontWeight: 600 }}>{lang === "ta" ? p.nameTa : p.nameEn}</div>
                <div className="tiny">{item.segment === "shop" ? t.designer.segShop : item.segment === "event" ? t.designer.segEvent : ""} · {size.widthMm} × {size.heightMm} mm</div>
              </div>
              <b className="ink">{formatInr(line?.totalPaise ?? 0)}</b>
            </div>
            <div className="row">
              <label className="field" style={{ maxWidth: 160 }}>
                <span>{t.order.quantity} ({p.unit === "case" ? t.order.casesOf : t.order.labels})</span>
                <input className="input" type="number" inputMode="numeric" min={p.minQty} step={p.qtyStep} value={item.qty} onChange={(e) => updateItem(item.key, { qty: Math.max(0, Math.floor(Number(e.target.value) || 0)) })} />
              </label>
              <Link className="btn btn-ghost btn-sm" href={`/design?product=${p.id}&segment=${item.segment === "shop" ? "shop" : "event"}&restore=1`} onClick={() => { sessionStorage.setItem("hl_pending_design", JSON.stringify({ design: item.design })); removeItem(item.key); }}>{t.designer.edit}</Link>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => removeItem(item.key)}>{t.order.remove}</button>
            </div>
            {err && <span className="error-text">{err}</span>}
            {p.bottleType === "glass" && <div className="note small">🫧 {GLASS_PACKING_NOTE[lang]}</div>}
          </article>
        );
      })}
      <div className="card stack">
        <label className="field">
          <span>{t.order.deliveryDate}</span>
          <input className="input" type="date" min={minDate} value={cart.deliveryDate ?? minDate} onChange={(e) => writeCart({ ...cart, deliveryDate: e.target.value })} />
        </label>
        <div className="row between"><span>{t.order.subtotal}</span><span>{formatInr(priced.taxablePaise)}</span></div>
        <div className="row between"><span>{t.order.gst}</span><span>{formatInr(priced.cgstPaise + priced.sgstPaise + priced.igstPaise)}</span></div>
        <div className="row between ink" style={{ fontWeight: 700, fontSize: "1.2rem" }}><span>{t.order.total}</span><span>{formatInr(priced.totalPaise)}</span></div>
        {priced.errors.length > 0 && <div className="note note-warn small">{priced.errors.map((e) => <div key={e}>{e.split(": ").slice(1).join(": ")}</div>)}</div>}
        <Link className="btn btn-coral btn-block" href="/checkout" aria-disabled={priced.errors.length > 0} onClick={(e) => priced.errors.length > 0 && e.preventDefault()}>
          {t.order.checkout} →
        </Link>
      </div>
    </div>
  );
}
