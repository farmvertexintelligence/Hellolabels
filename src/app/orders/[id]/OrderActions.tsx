"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { addToCart } from "@/lib/cart";
import type { Segment } from "@/lib/catalog/types";
import type { Design } from "@/lib/design/types";
import { useI18n } from "@/lib/i18n/client";
import { openRazorpay } from "@/lib/razorpay-client";

export function PayButton({ orderId, label }: { orderId: string; label: string }) {
  const { lang } = useI18n();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="stack">
      <button
        type="button"
        className="btn btn-coral btn-block"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setErr(null);
          const res = await fetch("/api/payments/start", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ orderId }) });
          const j = await res.json();
          if (!res.ok) {
            setErr(j.error);
            setBusy(false);
            return;
          }
          const outcome = await openRazorpay(j, lang);
          router.replace(`/orders/${orderId}?pay=${outcome}`);
          router.refresh();
          setBusy(false);
        }}
      >
        {label}
      </button>
      {err && <p className="error-text">{err}</p>}
    </div>
  );
}

export function ReorderButton({ items, label }: { items: { productId: string; labelSizeId: string; segment: Segment; qty: number; design: Design; designId: string | null }[]; label: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      className="btn btn-ghost"
      onClick={() => {
        items.forEach((i) => addToCart(i));
        router.push("/cart");
      }}
    >
      ↻ {label}
    </button>
  );
}

/** While the bank confirms, refresh a few times so the page shows the webhook's result. */
export function AutoRefresh({ active }: { active: boolean }) {
  const router = useRouter();
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!active || n >= 6) return;
    const id = setTimeout(() => {
      setN(n + 1);
      router.refresh();
    }, 2500);
    return () => clearTimeout(id);
  }, [active, n, router]);
  return null;
}
