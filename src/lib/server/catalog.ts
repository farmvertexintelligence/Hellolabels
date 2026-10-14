import "server-only";
import { unstable_cache } from "next/cache";
import { DEFAULT_CATALOG, DEFAULT_REGULATORY, DEFAULT_SETTINGS } from "@/lib/catalog/defaults";
import type { BusinessSettings, Catalog, LabelSize, Price, Product, RegulatoryInfo, Segment } from "@/lib/catalog/types";
import { features } from "@/lib/env";
import { DEFAULT_ROLL_SPEC, type RollSpec } from "@/lib/print/imposition";
import { supabaseAdmin } from "@/lib/supabase/server";

export const CATALOG_TAG = "catalog";

/* eslint-disable @typescript-eslint/no-explicit-any */
export const rowToLabelSize = (r: any): LabelSize => ({
  id: r.id,
  nameEn: r.name_en,
  nameTa: r.name_ta,
  widthMm: Number(r.width_mm),
  heightMm: Number(r.height_mm),
  wraps: r.wraps,
  diameterMm: r.diameter_mm === null ? null : Number(r.diameter_mm),
  overlapMm: Number(r.overlap_mm),
  hasRegPanel: r.has_reg_panel,
  regPanelMm: Number(r.reg_panel_mm),
  isPlaceholder: r.is_placeholder,
});

export const rowToProduct = (r: any): Product => ({
  id: r.id,
  slug: r.slug,
  kind: r.kind,
  nameEn: r.name_en,
  nameTa: r.name_ta,
  volumeMl: r.volume_ml,
  bottleType: r.bottle_type,
  labelSizeIds: r.label_size_ids,
  unit: r.unit,
  caseSize: r.case_size,
  minQty: r.min_qty,
  qtyStep: r.qty_step,
  hsn: r.hsn,
  gstRatePct: Number(r.gst_rate_pct),
  mrpPaise: r.mrp_paise,
  active: r.active,
  sort: r.sort,
});

const rowToPrice = (r: any): Price => ({ productId: r.product_id, segment: r.segment as Segment, unitPricePaise: r.unit_price_paise, isPlaceholder: r.is_placeholder });
/* eslint-enable @typescript-eslint/no-explicit-any */

async function fetchCatalog(): Promise<Catalog & { roll: RollSpec }> {
  const db = supabaseAdmin();
  const [sizes, products, prices, settings] = await Promise.all([
    db.from("label_sizes").select("*"),
    db.from("products").select("*"),
    db.from("prices").select("*"),
    db.from("app_settings").select("key, value"),
  ]);
  const err = sizes.error ?? products.error ?? prices.error ?? settings.error;
  if (err) throw new Error(`Catalog load failed: ${err.message}`);
  const kv = new Map((settings.data ?? []).map((s) => [s.key as string, s.value]));
  return {
    labelSizes: (sizes.data ?? []).map(rowToLabelSize),
    products: (products.data ?? []).map(rowToProduct),
    prices: (prices.data ?? []).map(rowToPrice),
    regulatory: { ...DEFAULT_REGULATORY, ...(kv.get("regulatory") as Partial<RegulatoryInfo>) },
    settings: { ...DEFAULT_SETTINGS, ...(kv.get("business") as Partial<BusinessSettings>) },
    roll: { ...DEFAULT_ROLL_SPEC, ...(kv.get("roll") as Partial<RollSpec>) },
  };
}

const cached = unstable_cache(fetchCatalog, ["catalog-v1"], { tags: [CATALOG_TAG], revalidate: 300 });

/**
 * The live catalogue (prices, sizes, regulatory details). Without a database (local preview) the
 * built-in placeholder catalogue is used, and checkout stays closed.
 */
export async function getCatalog(opts: { fresh?: boolean } = {}): Promise<Catalog & { roll: RollSpec }> {
  if (!features.serviceRole) return { ...DEFAULT_CATALOG, roll: DEFAULT_ROLL_SPEC };
  return opts.fresh ? fetchCatalog() : cached();
}
