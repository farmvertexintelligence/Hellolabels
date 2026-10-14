"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useI18n } from "@/lib/i18n/client";
import { supabaseBrowser } from "@/lib/supabase/browser";

export function LoginForm({ next }: { next: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const sb = supabaseBrowser();
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const e164 = `+91${phone.replace(/\D/g, "").slice(-10)}`;

  if (!sb) return <div className="note note-warn">{t.login.notConfigured}</div>;

  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    setErr(null);
    if (!/^\+91[6-9]\d{9}$/.test(e164)) return setErr("Enter a 10-digit mobile number");
    setBusy(true);
    const { error } = await sb!.auth.signInWithOtp({ phone: e164 });
    setBusy(false);
    if (error) setErr(error.message);
    else setSent(true);
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    const { error } = await sb!.auth.verifyOtp({ phone: e164, token: otp.trim(), type: "sms" });
    setBusy(false);
    if (error) return setErr(error.message);
    router.replace(next.startsWith("/") && !next.startsWith("//") ? next : "/account");
    router.refresh();
  }

  return !sent ? (
    <form className="stack" onSubmit={send}>
      <label className="field">
        <span>{t.login.phone}</span>
        <div className="row" style={{ flexWrap: "nowrap" }}>
          <span className="pill" style={{ minHeight: 48 }}>+91</span>
          <input className="input" type="tel" inputMode="numeric" autoComplete="tel-national" maxLength={10} value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))} placeholder="98765 43210" required />
        </div>
      </label>
      {err && <p className="error-text">{err}</p>}
      <button className="btn btn-coral btn-block" disabled={busy}>{t.login.sendOtp}</button>
    </form>
  ) : (
    <form className="stack" onSubmit={verify}>
      <p className="small">{t.login.sent} <b className="ink">{e164}</b></p>
      <label className="field">
        <span>{t.login.otp}</span>
        <input className="input" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))} required style={{ letterSpacing: "0.4em", fontSize: 22, textAlign: "center" }} />
      </label>
      {err && <p className="error-text">{err}</p>}
      <button className="btn btn-coral btn-block" disabled={busy || otp.length !== 6}>{t.login.verify}</button>
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => send()} disabled={busy}>{t.login.resend}</button>
    </form>
  );
}
