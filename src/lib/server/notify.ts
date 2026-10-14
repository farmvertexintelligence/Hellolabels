import "server-only";
import { STATUS_TEXT, type OrderStatus } from "@/lib/commerce/logistics";
import { env } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase/server";

/*
 * Order status messages by SMS (MSG91 Flow API — DLT-registered template) and WhatsApp
 * (Meta WhatsApp Cloud API — approved template). Both templates take the variables:
 *   {{1}} customer name, {{2}} order number, {{3}} status text, {{4}} tracking link.
 * If a channel is not configured the message is logged as "skipped" so admins can see it.
 */

export interface StatusMessage {
  orderId: string;
  orderNo: string;
  phone: string; // 10-digit Indian mobile or +91…
  name: string;
  status: OrderStatus;
  lang: "en" | "ta";
}

const e164 = (phone: string) => {
  const d = phone.replace(/\D/g, "");
  return d.length === 10 ? `91${d}` : d;
};

async function log(orderId: string, channel: "sms" | "whatsapp", recipient: string, template: string, body: string, status: "sent" | "failed" | "skipped", providerRef?: string, error?: string) {
  await supabaseAdmin().from("notifications").insert({ order_id: orderId, channel, recipient, template, body, status, provider_ref: providerRef ?? null, error: error ?? null });
}

async function sendSms(m: StatusMessage, text: string, link: string) {
  const to = e164(m.phone);
  if (!env.msg91AuthKey || !env.msg91TemplateId) return log(m.orderId, "sms", to, "order_status", text, "skipped", undefined, "MSG91 not configured");
  try {
    const res = await fetch("https://control.msg91.com/api/v5/flow", {
      method: "POST",
      headers: { authkey: env.msg91AuthKey, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ template_id: env.msg91TemplateId, short_url: "0", recipients: [{ mobiles: to, var1: m.name || "Customer", var2: m.orderNo, var3: STATUS_TEXT[m.status].en, var4: link }] }),
    });
    const json = (await res.json().catch(() => ({}))) as { type?: string; message?: string };
    if (!res.ok || json.type === "error") throw new Error(json.message ?? `HTTP ${res.status}`);
    await log(m.orderId, "sms", to, "order_status", text, "sent", json.message);
  } catch (e) {
    await log(m.orderId, "sms", to, "order_status", text, "failed", undefined, String(e));
  }
}

async function sendWhatsApp(m: StatusMessage, text: string, link: string) {
  const to = e164(m.phone);
  if (!env.whatsappToken || !env.whatsappPhoneNumberId) return log(m.orderId, "whatsapp", to, env.whatsappTemplate, text, "skipped", undefined, "WhatsApp not configured");
  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${env.whatsappPhoneNumberId}/messages`, {
      method: "POST",
      headers: { authorization: `Bearer ${env.whatsappToken}`, "content-type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: {
          name: env.whatsappTemplate,
          language: { code: m.lang === "ta" ? "ta" : "en" },
          components: [
            {
              type: "body",
              parameters: [m.name || "Customer", m.orderNo, STATUS_TEXT[m.status][m.lang], link].map((t) => ({ type: "text", text: t })),
            },
          ],
        },
      }),
    });
    const json = (await res.json().catch(() => ({}))) as { messages?: { id: string }[]; error?: { message: string } };
    if (!res.ok) throw new Error(json.error?.message ?? `HTTP ${res.status}`);
    await log(m.orderId, "whatsapp", to, env.whatsappTemplate, text, "sent", json.messages?.[0]?.id);
  } catch (e) {
    await log(m.orderId, "whatsapp", to, env.whatsappTemplate, text, "failed", undefined, String(e));
  }
}

/** Sends the status update on both channels. Never throws — delivery problems are logged. */
export async function notifyStatus(m: StatusMessage): Promise<void> {
  const link = `${env.siteUrl}/orders/${m.orderId}`;
  const text = `hellolabels: ${m.name ? m.name + ", " : ""}order ${m.orderNo} — ${STATUS_TEXT[m.status][m.lang]}. Track: ${link}`;
  await Promise.allSettled([sendSms(m, text, link), sendWhatsApp(m, text, link)]);
}
