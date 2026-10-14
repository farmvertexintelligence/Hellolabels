/** Customer segment. "label" is used for label-only products (glass bottles, jars, stickers). */
export type Segment = "event" | "shop" | "label";
export type ProductKind = "water_bottle" | "label_only";
export type BottleType = "plastic" | "glass";
export type Unit = "case" | "piece";

/**
 * A fixed label size. Customers can never change it; the admin edits it in Admin → Label sizes.
 * All measurements are millimetres of the finished (trimmed) label.
 */
export interface LabelSize {
  id: string;
  nameEn: string;
  nameTa: string;
  widthMm: number;
  heightMm: number;
  /** Wrap-around bottle label (ends meet on the back of the bottle) vs a flat front label. */
  wraps: boolean;
  /** Bottle diameter used by the 3D preview. Null for flat labels. */
  diameterMm: number | null;
  /** Wrap labels: glued overlap at the right edge that ends up hidden under the left edge. */
  overlapMm: number;
  /** Whether the locked regulatory panel is printed on this label (all drinking-water labels). */
  hasRegPanel: boolean;
  /** Width (wrap labels) or height (flat labels) of the regulatory panel. */
  regPanelMm: number;
  /** True until the admin confirms the real size. Checkout is blocked while true. */
  isPlaceholder: boolean;
}

export interface Product {
  id: string;
  slug: string;
  kind: ProductKind;
  nameEn: string;
  nameTa: string;
  volumeMl: number | null;
  bottleType: BottleType | null;
  labelSizeIds: string[];
  unit: Unit;
  /** Bottles per case (24) for water; 1 for label-only products. */
  caseSize: number;
  /** Minimum order quantity in units (cases for water, pieces for labels). */
  minQty: number;
  /** Order quantity step in units (labels are sold in packs, e.g. 50). */
  qtyStep: number;
  hsn: string;
  gstRatePct: number;
  /** Maximum retail price per bottle in paise, printed on the regulatory panel. */
  mrpPaise: number | null;
  active: boolean;
  sort: number;
}

/** Price per bottle (water) or per label (label-only), GST inclusive, in paise. */
export interface Price {
  productId: string;
  segment: Segment;
  unitPricePaise: number;
  isPlaceholder: boolean;
}

/** Packager details the admin enters once; printed on every water label's regulatory panel. */
export interface RegulatoryInfo {
  packagerName: string;
  packagerAddress: string;
  fssaiLicence: string;
  bisLicence: string; // CM/L number shown with the ISI mark (IS 14543)
  isStandard: string; // e.g. "IS 14543"
  shelfLifeDays: number;
  customerCare: string;
}

export interface BusinessSettings {
  legalName: string;
  gstin: string;
  stateCode: string; // "33" = Tamil Nadu
  address: string;
  whatsappNumber: string; // E.164 without +, e.g. 919xxxxxxxxx
  pricesIncludeGst: boolean;
  dealerCommissionPct: number;
  dealerAdSharePct: number;
  advancePct: number; // 50 → pay 50% now, balance on delivery
  advanceMinOrderPaise: number; // orders at or above this total may use the advance option
  minTextPt: number;
  casesPerPack: number;
  spoilagePct: number; // extra labels printed per job
  catalogReady: boolean;
}

export interface Catalog {
  products: Product[];
  labelSizes: LabelSize[];
  prices: Price[];
  regulatory: RegulatoryInfo;
  settings: BusinessSettings;
}
