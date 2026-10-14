import type { Metadata } from "next";
import { features } from "@/lib/env";
import { getDict } from "@/lib/i18n/server";
import { requireRole } from "@/lib/server/auth";
import { getCatalog } from "@/lib/server/catalog";
import { supabaseAdmin } from "@/lib/supabase/server";
import { CheckoutForm } from "./CheckoutForm";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };

export default async function Checkout() {
  const user = await requireRole(null, "/checkout");
  const { t } = await getDict();
  const catalog = await getCatalog();
  const shops = user.role === "dealer" ? ((await supabaseAdmin().from("dealer_shops").select("id, name, phone, address, pincode, district_code, gstin").eq("dealer_id", user.id)).data ?? []) : undefined;
  return (
    <div className="wrap section" style={{ maxWidth: 760 }}>
      <h1 style={{ fontSize: "2rem" }}>{t.order.checkout}</h1>
      <CheckoutForm catalog={catalog} user={{ phone: user.phone, name: user.fullName, gstin: user.gstin, districtCode: user.districtCode }} paymentsReady={features.payments && catalog.settings.catalogReady} dealerShops={shops} />
    </div>
  );
}
