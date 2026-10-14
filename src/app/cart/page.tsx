import type { Metadata } from "next";
import { getDict } from "@/lib/i18n/server";
import { getCatalog } from "@/lib/server/catalog";
import { CartView } from "./CartView";

export const metadata: Metadata = { title: "Cart", robots: { index: false } };

export default async function CartPage() {
  const { t } = await getDict();
  const catalog = await getCatalog();
  return (
    <div className="wrap section" style={{ maxWidth: 760 }}>
      <h1 style={{ fontSize: "2rem" }}>{t.order.cart}</h1>
      <CartView catalog={catalog} />
    </div>
  );
}
