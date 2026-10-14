"use client";

/** Payment details from our server (amount and order id come from the database, not the browser). */
export interface StartPayment {
  keyId: string;
  razorpayOrderId: string;
  amountPaise: number;
  orderNo: string;
  prefill: { name: string; contact: string };
}

declare global {
  interface Window {
    Razorpay?: new (o: Record<string, unknown>) => { open: () => void; on: (ev: string, fn: (r: unknown) => void) => void };
  }
}

function loadScript(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((ok, fail) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => ok();
    s.onerror = () => fail(new Error("Could not load the payment window. Check your internet and try again."));
    document.body.appendChild(s);
  });
}

/**
 * Opens Razorpay Checkout (UPI, cards, net banking, wallets). On success the server verifies the
 * signature and fetches the payment from Razorpay before the order moves on.
 * Resolves to "ok" | "failed" | "dismissed".
 */
export async function openRazorpay(p: StartPayment, lang: "en" | "ta"): Promise<"ok" | "failed" | "dismissed"> {
  await loadScript();
  return new Promise((resolve) => {
    let failed = false;
    const rzp = new window.Razorpay!({
      key: p.keyId,
      order_id: p.razorpayOrderId,
      amount: p.amountPaise,
      currency: "INR",
      name: "hellolabels",
      description: `Order ${p.orderNo}`,
      prefill: { name: p.prefill.name, contact: `+91${p.prefill.contact}` },
      theme: { color: "#141A26" },
      notes: { order_no: p.orderNo, lang },
      handler: async (r: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
        const res = await fetch("/api/payments/verify", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(r) }).catch(() => null);
        resolve(res?.ok ? "ok" : "failed");
      },
      modal: { ondismiss: () => resolve(failed ? "failed" : "dismissed"), confirm_close: true },
    });
    rzp.on("payment.failed", () => {
      failed = true;
    });
    rzp.open();
  });
}
