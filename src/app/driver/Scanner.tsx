"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n/client";

type ScanResult = { orderNo: string; customer: string; remaining: number; status: string; balancePaise: number };

declare global {
  interface Window {
    BarcodeDetector?: new (o: { formats: string[] }) => { detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]> };
  }
}

/** Camera QR scanner: native BarcodeDetector when available (Android Chrome), jsQR otherwise. */
export function Scanner() {
  const { t } = useI18n();
  const router = useRouter();
  const video = useRef<HTMLVideoElement>(null);
  const [on, setOn] = useState(false);
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const busy = useRef(false);

  async function submit(packNo: string) {
    if (busy.current) return;
    busy.current = true;
    const r = await fetch("/api/driver/scan", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ packNo }) });
    const j = (await r.json()) as ScanResult & { error?: string };
    busy.current = false;
    if (navigator.vibrate) navigator.vibrate(r.ok ? 80 : [60, 60, 60]);
    if (!r.ok) return setMsg({ ok: false, text: j.error === "This order is not on your truck" ? t.driver.notOnTrip : (j.error ?? "Error") });
    setMsg({ ok: true, text: `✓ ${packNo} · ${j.orderNo} · ${j.customer}${j.remaining ? ` · ${j.remaining} more pack(s)` : ` · ${t.driver.scanned}`}${j.balancePaise > 0 && !j.remaining ? ` · collect ₹${(j.balancePaise / 100).toFixed(0)}` : ""}` });
    router.refresh();
  }

  useEffect(() => {
    if (!on) return;
    let stream: MediaStream | null = null;
    let raf = 0;
    let last = "";
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const detector = window.BarcodeDetector ? new window.BarcodeDetector({ formats: ["qr_code"] }) : null;
    let jsQR: ((d: Uint8ClampedArray, w: number, h: number) => { data: string } | null) | null = null;
    if (!detector) import("jsqr").then((m) => (jsQR = m.default as unknown as typeof jsQR));

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (!video.current) return;
        video.current.srcObject = stream;
        await video.current.play();
        const tick = async () => {
          const v = video.current;
          if (v && v.readyState >= 2) {
            let found: string | null = null;
            if (detector) {
              const r = await detector.detect(v).catch(() => []);
              found = r[0]?.rawValue ?? null;
            } else if (jsQR && ctx) {
              canvas.width = v.videoWidth;
              canvas.height = v.videoHeight;
              ctx.drawImage(v, 0, 0);
              const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
              found = jsQR(img.data, img.width, img.height)?.data ?? null;
            }
            if (found && found !== last) {
              last = found;
              submit(found);
            }
          }
          raf = requestAnimationFrame(tick);
        };
        tick();
      } catch {
        setMsg({ ok: false, text: "Camera not available — type the pack number instead." });
        setOn(false);
      }
    })();
    return () => {
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((tr) => tr.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on]);

  return (
    <div className="card stack">
      <button type="button" className="btn btn-coral btn-block" onClick={() => setOn(!on)}>📷 {on ? "Stop" : t.driver.scan}</button>
      {on && <video ref={video} playsInline muted style={{ width: "100%", borderRadius: 12, background: "#000" }} />}
      <form className="row" style={{ flexWrap: "nowrap" }} onSubmit={(e) => { e.preventDefault(); if (code) submit(code.toUpperCase()); }}>
        <input className="input" value={code} onChange={(e) => setCode(e.target.value)} placeholder={t.driver.enterCode} autoCapitalize="characters" />
        <button className="btn">OK</button>
      </form>
      {msg && <div className={`note ${msg.ok ? "note-ok" : "note-err"}`} role="status">{msg.text}</div>}
    </div>
  );
}

export function CollectForm({ orderId, balancePaise }: { orderId: string; balancePaise: number }) {
  const { t } = useI18n();
  const router = useRouter();
  const [method, setMethod] = useState<"cash" | "upi_offline">("cash");
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="row">
      <select className="select" style={{ width: "auto" }} value={method} onChange={(e) => setMethod(e.target.value as "cash")}>
        <option value="cash">Cash</option>
        <option value="upi_offline">UPI</option>
      </select>
      <button
        type="button"
        className="btn btn-sm"
        onClick={async () => {
          if (!confirm(`${t.driver.collect}: ₹${(balancePaise / 100).toFixed(2)}?`)) return;
          const r = await fetch("/api/driver/collect", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ orderId, amountPaise: balancePaise, method }) });
          const j = await r.json();
          setMsg(r.ok ? "✓" : j.error);
          router.refresh();
        }}
      >
        {t.driver.collect} ₹{(balancePaise / 100).toFixed(0)}
      </button>
      {msg && <span className="small">{msg}</span>}
    </div>
  );
}
