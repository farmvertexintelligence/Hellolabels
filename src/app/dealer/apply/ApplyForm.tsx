"use client";
import { useState } from "react";
import { DISTRICTS } from "@/lib/districts";
import { useI18n } from "@/lib/i18n/client";

export function ApplyForm({ taken }: { taken: string[] }) {
  const { t, lang } = useI18n();
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (done) return <div className="note note-ok">{t.dealer.submitted}</div>;
  return (
    <form
      className="card stack"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setErr(null);
        const r = await fetch("/api/dealer/apply", { method: "POST", body: new FormData(e.currentTarget) });
        const j = await r.json().catch(() => ({}));
        setBusy(false);
        if (r.ok) setDone(true);
        else setErr(j.error ?? "Failed");
      }}
    >
      <label className="field"><span>{t.dealer.name}</span><input className="input" name="name" required minLength={2} maxLength={80} autoComplete="name" /></label>
      <div className="grid grid-2">
        <label className="field"><span>{t.dealer.age}</span><input className="input" name="age" type="number" min={18} max={100} required inputMode="numeric" /></label>
        <label className="field"><span>{t.dealer.phone}</span><input className="input" name="phone" type="tel" pattern="[6-9][0-9]{9}" maxLength={10} required inputMode="numeric" /></label>
      </div>
      <label className="field"><span>{t.dealer.address}</span><textarea className="textarea" name="address" required minLength={10} maxLength={400} /></label>
      <div className="grid grid-2">
        <label className="field"><span>{t.dealer.profession}</span><input className="input" name="profession" required maxLength={80} /></label>
        <label className="field">
          <span>{t.dealer.district}</span>
          <select className="select" name="districtCode" required defaultValue="">
            <option value="" disabled>—</option>
            {DISTRICTS.map((d) => (
              <option key={d.code} value={d.code} disabled={taken.includes(d.code)}>
                {lang === "ta" ? d.ta : d.en}{taken.includes(d.code) ? " ✕" : ""}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="field"><span>{t.dealer.aadhaarNo}</span><input className="input" name="aadhaar" inputMode="numeric" pattern="[0-9 ]{12,14}" maxLength={14} required autoComplete="off" /></label>
      <label className="field"><span>{t.dealer.aadhaarFile}</span><input className="input" name="kyc" type="file" accept="image/jpeg,image/png,application/pdf" required /></label>
      <label className="check"><input type="checkbox" name="consent" value="yes" required /> <span>{t.dealer.consent} <a className="link" href="/privacy" target="_blank">Privacy</a></span></label>
      {err && <div className="note note-err small">{err}</div>}
      <button className="btn btn-coral btn-block" disabled={busy}>{t.dealer.submit}</button>
    </form>
  );
}
