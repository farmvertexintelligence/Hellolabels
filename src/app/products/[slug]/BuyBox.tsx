"use client";
import Link from "next/link";
import { useState } from "react";
import type { Product } from "@/lib/catalog/types";
import { formatInr } from "@/lib/commerce/pricing";
import { useI18n } from "@/lib/i18n/client";

/** Product page buy box: segment, quantity in cases, live total, then on to the designer. */
export function BuyBox({ product, prices, closed }: { product: Product; prices: { event?: number; shop?: number; label?: number }; closed: boolean }) {
  const { t } = useI18n();
  const water = product.kind === "water_bottle";
  const [seg, setSeg] = useState<"event" | "shop">("event");
  const [qty, setQty] = useState(product.minQty);
  const unit = water ? (seg === "event" ? prices.event : prices.shop) : prices.label;
  const items = water ? qty * product.caseSize : qty;
  return (
    <div className="card stack buybox">
      {water && (
        <div className="seg">
          <button type="button" aria-pressed={seg === "event"} onClick={() => setSeg("event")}>{t.designer.segEvent}</button>
          <button type="button" aria-pressed={seg === "shop"} onClick={() => setSeg("shop")}>{t.designer.segShop}</button>
        </div>
      )}
      {unit !== undefined && (
        <div>
          <span className="buy-price">{formatInr(unit)}</span> <span className="small">/ {water ? t.product.perBottle : t.product.perLabel} · {t.product.gstIncl}</span>
          {water && <div className="small">{formatInr(unit * product.caseSize)} {t.home.perCase} (24)</div>}
        </div>
      )}
      <div className="field">
        <span>{t.order.quantity} ({water ? t.order.casesOf : t.order.labels})</span>
        <div className="row" style={{ flexWrap: "nowrap" }}>
          <button type="button" className="btn btn-ghost" onClick={() => setQty((q) => Math.max(product.minQty, q - product.qtyStep))} aria-label="−">−</button>
          <input className="input" style={{ textAlign: "center" }} inputMode="numeric" value={qty} onChange={(e) => setQty(Math.max(product.minQty, Math.floor(Number(e.target.value) || product.minQty)))} aria-label={t.order.quantity} />
          <button type="button" className="btn btn-ghost" onClick={() => setQty((q) => q + product.qtyStep)} aria-label="+">+</button>
        </div>
        <span className="hint">{t.product.minOrder}: {product.minQty} {water ? t.product.cases : t.order.labels}{water && ` · ${items} ${t.order.bottles}`}</span>
      </div>
      {unit !== undefined && (
        <div className="row between ink" style={{ fontWeight: 700, fontSize: "1.2rem" }}>
          <span>{t.order.total}</span>
          <span>{formatInr(unit * items)}</span>
        </div>
      )}
      {seg === "shop" && water && <div className="note note-warn small">📣 {t.designer.adNote}</div>}
      {closed && <div className="note note-warn small">{t.product.notSellable}</div>}
      <Link className="btn btn-coral btn-block btn-lg" href={`/design?product=${product.id}&segment=${water ? seg : "event"}${seg === "shop" ? "&template=shop" : ""}`}>
        ✨ {t.product.designThis}
      </Link>
    </div>
  );
}
