import type { Metadata } from "next";
import { Designer } from "@/components/design/Designer";
import { findProduct } from "@/lib/catalog/helpers";
import type { Segment } from "@/lib/catalog/types";
import type { Design } from "@/lib/design/types";
import { features } from "@/lib/env";
import { getUser } from "@/lib/server/auth";
import { getCatalog } from "@/lib/server/catalog";
import { supabaseAdmin } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "AI label designer — design your bottle label in English or Tamil",
  description: "Describe your occasion and get 4 label designs that fit your bottle exactly. Edit text, fonts, colours and photos, and see it on the bottle in 3D.",
};

export default async function DesignPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const catalog = await getCatalog();
  const user = await getUser().catch(() => null);
  let design: Design | null = null;
  let productId = sp.product && findProduct(catalog, sp.product) ? sp.product : undefined;
  let segment: Segment | undefined = sp.segment === "shop" ? "shop" : sp.segment === "event" ? "event" : undefined;
  let labelSizeId: string | undefined;
  // Re-open a saved design (?design=<id>) — only the owner's.
  if (sp.design && user && features.serviceRole) {
    const { data } = await supabaseAdmin().from("designs").select("*").eq("id", sp.design).eq("owner_id", user.id).maybeSingle();
    if (data) {
      design = data.doc as Design;
      productId = data.product_id ?? productId;
      segment = data.segment === "shop" ? "shop" : "event";
      labelSizeId = data.label_size_id;
    }
  }
  if (!segment && sp.template === "shop") segment = "shop";
  return (
    <Designer
      catalog={catalog}
      signedIn={Boolean(user)}
      initial={{ productId, segment, templateId: sp.template, labelSizeId, design, designId: design ? sp.design : null }}
    />
  );
}
