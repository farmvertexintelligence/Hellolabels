/** WhatsApp click-to-chat link for the business number (NEXT_PUBLIC_WHATSAPP_NUMBER, e.g. 919876543210). */
export function whatsappLink(text: string): string | null {
  const n = (process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "").replace(/\D/g, "");
  if (!n) return null;
  return `https://wa.me/${n}?text=${encodeURIComponent(text)}`;
}

export const ADDRESS = "Kolathur, Mettur Tk, Salem District, Tamil Nadu 636303";
