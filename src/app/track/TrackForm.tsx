"use client";
import { useState } from "react";
import { useI18n } from "@/lib/i18n/client";

type Result = { orderNo: string; status: string; deliveryDate: string; events: { status: string; created_at: string }[] };

export function TrackForm() {
  const { t } = useI18n();
  const [orderNo, setOrderNo] = useState("");
  const [phone4, setPhone4] = useState("");
  const [res, setRes] = useState<Result | null>(null);
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="stack">
      <form
        className="card stack"
        onSubmit={async (e) => {
          e.preventDefault();
          setErr(null);
          setRes(null);
          const r = await fetch("/api/track", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ orderNo, phone4 }) });
          const j = await r.json();
          if (r.ok) setRes(j);
          else setErr(j.error);
        }}
      >
        <label className="field"><span>{t.order.orderNo}</span><input className="input" value={orderNo} onChange={(e) => setOrderNo(e.target.value.toUpperCase())} placeholder="HL261014-00012" required /></label>
        <label className="field"><span>{t.order.phone} (last 4 digits)</span><input className="input" inputMode="numeric" maxLength={4} value={phone4} onChange={(e) => setPhone4(e.target.value.replace(/\D/g, ""))} required /></label>
        <button className="btn btn-coral">{t.order.track}</button>
        {err && <p className="error-text">{err}</p>}
      </form>
      {res && (
        <div className="card stack">
          <div className="row between"><b className="ink">{res.orderNo}</b><span className="pill">{t.status[res.status as keyof typeof t.status] ?? res.status}</span></div>
          <div className="small">{t.order.deliveryDate}: {res.deliveryDate}</div>
          <ol className="timeline">
            {res.events.map((e, i) => (
              <li key={i} className="done"><span className="dot">✓</span><div><div className="ink">{t.status[e.status as keyof typeof t.status] ?? e.status}</div><div className="tiny">{new Date(e.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</div></div></li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
