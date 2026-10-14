import type { BusinessSettings, Catalog, LabelSize, Price, Product, RegulatoryInfo } from "./types";

/*
 * Starting values used until the database is configured, and copied into the database by
 * supabase/seed.sql. Every size, price and minimum quantity here is a PLACEHOLDER: the admin must
 * enter the real numbers in Admin → Prices / Label sizes. Placeholder rows are flagged and checkout
 * refuses to take payment for them.
 */

export const VOLUMES = [250, 300, 500, 1000, 2000] as const;

/** Portrait water-bottle label: square design on top, ad strip (Shop) and regulatory panel below. */
const portrait = (id: string, nameEn: string, nameTa: string, widthMm: number, heightMm: number, diameterMm: number): LabelSize => ({
  id,
  nameEn,
  nameTa,
  widthMm,
  heightMm,
  wraps: false,
  diameterMm,
  overlapMm: 0,
  hasRegPanel: true,
  regPanelMm: 0, // computed: everything below the square (and the ad strip)
  isPlaceholder: true,
});

export const DEFAULT_LABEL_SIZES: LabelSize[] = [
  portrait("pet-250", "250 ml bottle label", "250 மி.லி பாட்டில் லேபிள்", 55, 120, 56),
  portrait("pet-300", "300 ml bottle label", "300 மி.லி பாட்டில் லேபிள்", 58, 125, 58),
  portrait("pet-500", "500 ml bottle label", "500 மி.லி பாட்டில் லேபிள்", 62, 122, 65),
  portrait("pet-1000", "1000 ml bottle label", "1000 மி.லி பாட்டில் லேபிள்", 72, 140, 80),
  portrait("pet-2000", "2000 ml bottle label", "2000 மி.லி பாட்டில் லேபிள்", 85, 160, 100),
  portrait("glass-250", "250 ml glass bottle label", "250 மி.லி கண்ணாடி பாட்டில் லேபிள்", 56, 122, 58),
  portrait("glass-300", "300 ml glass bottle label", "300 மி.லி கண்ணாடி பாட்டில் லேபிள்", 58, 125, 60),
  portrait("glass-500", "500 ml glass bottle label", "500 மி.லி கண்ணாடி பாட்டில் லேபிள்", 64, 125, 68),
  portrait("glass-1000", "1000 ml glass bottle label", "1000 மி.லி கண்ணாடி பாட்டில் லேபிள்", 74, 142, 82),
  portrait("glass-2000", "2000 ml glass bottle label", "2000 மி.லி கண்ணாடி பாட்டில் லேபிள்", 86, 162, 102),
  {
    id: "glass-front",
    nameEn: "Glass bottle label",
    nameTa: "கண்ணாடி பாட்டில் லேபிள்",
    widthMm: 60,
    heightMm: 90,
    wraps: false,
    diameterMm: 70,
    overlapMm: 0,
    hasRegPanel: false,
    regPanelMm: 0,
    isPlaceholder: true,
  },
  {
    id: "jar-front",
    nameEn: "Jar label",
    nameTa: "ஜாடி லேபிள்",
    widthMm: 65,
    heightMm: 85,
    wraps: false,
    diameterMm: 85,
    overlapMm: 0,
    hasRegPanel: false,
    regPanelMm: 0,
    isPlaceholder: true,
  },
  {
    id: "sticker-50x75",
    nameEn: "Sticker 50 × 75 mm",
    nameTa: "ஸ்டிக்கர் 50 × 75 மி.மீ",
    widthMm: 50,
    heightMm: 75,
    wraps: false,
    diameterMm: null,
    overlapMm: 0,
    hasRegPanel: false,
    regPanelMm: 0,
    isPlaceholder: true,
  },
  {
    id: "sticker-50x50",
    nameEn: "Square sticker 50 × 50 mm",
    nameTa: "சதுர ஸ்டிக்கர் 50 × 50 மி.மீ",
    widthMm: 50,
    heightMm: 50,
    wraps: false,
    diameterMm: null,
    overlapMm: 0,
    hasRegPanel: false,
    regPanelMm: 0,
    isPlaceholder: true,
  },
];

function waterProduct(volumeMl: number, bottleType: "plastic" | "glass", sort: number): Product {
  const glass = bottleType === "glass";
  const vol = volumeMl >= 1000 ? `${volumeMl / 1000} litre` : `${volumeMl} ml`;
  const volTa = volumeMl >= 1000 ? `${volumeMl / 1000} லிட்டர்` : `${volumeMl} மி.லி`;
  return {
    id: `water-${volumeMl}-${bottleType}`,
    slug: `${volumeMl}ml-${glass ? "glass" : "plastic"}-water-bottle`,
    kind: "water_bottle",
    nameEn: `${vol} ${glass ? "glass" : "plastic"} water bottle`,
    nameTa: `${volTa} ${glass ? "கண்ணாடி" : "பிளாஸ்டிக்"} தண்ணீர் பாட்டில்`,
    volumeMl,
    bottleType,
    labelSizeIds: [`${glass ? "glass" : "pet"}-${volumeMl}`],
    unit: "case",
    caseSize: 24,
    minQty: volumeMl >= 1000 ? 5 : 10, // PLACEHOLDER minimum cases
    qtyStep: 1,
    hsn: "2201",
    gstRatePct: 18,
    mrpPaise: null,
    active: true,
    sort,
  };
}

export const DEFAULT_PRODUCTS: Product[] = [
  ...VOLUMES.map((v, i) => waterProduct(v, "plastic", i)),
  ...VOLUMES.map((v, i) => waterProduct(v, "glass", 10 + i)),
  {
    id: "label-glass-bottle",
    slug: "glass-bottle-labels",
    kind: "label_only",
    nameEn: "Glass bottle labels",
    nameTa: "கண்ணாடி பாட்டில் லேபிள்கள்",
    volumeMl: null,
    bottleType: "glass",
    labelSizeIds: ["glass-front"],
    unit: "piece",
    caseSize: 1,
    minQty: 100,
    qtyStep: 50,
    hsn: "4821",
    gstRatePct: 18,
    mrpPaise: null,
    active: true,
    sort: 20,
  },
  {
    id: "label-jar",
    slug: "jar-labels",
    kind: "label_only",
    nameEn: "Jar labels",
    nameTa: "ஜாடி லேபிள்கள்",
    volumeMl: null,
    bottleType: null,
    labelSizeIds: ["jar-front"],
    unit: "piece",
    caseSize: 1,
    minQty: 100,
    qtyStep: 50,
    hsn: "4821",
    gstRatePct: 18,
    mrpPaise: null,
    active: true,
    sort: 21,
  },
  {
    id: "label-sticker",
    slug: "custom-stickers",
    kind: "label_only",
    nameEn: "Stickers and packaging labels",
    nameTa: "ஸ்டிக்கர்கள் மற்றும் பேக்கேஜிங் லேபிள்கள்",
    volumeMl: null,
    bottleType: null,
    labelSizeIds: ["sticker-50x75", "sticker-50x50"],
    unit: "piece",
    caseSize: 1,
    minQty: 200,
    qtyStep: 100,
    hsn: "4821",
    gstRatePct: 18,
    mrpPaise: null,
    active: true,
    sort: 22,
  },
];

// PLACEHOLDER per-bottle / per-label prices in paise (GST inclusive).
const SAMPLE_BOTTLE_PRICE: Record<number, [number, number]> = {
  // volume: [event, shop]
  250: [900, 700],
  300: [1000, 800],
  500: [1300, 1000],
  1000: [2000, 1600],
  2000: [3200, 2600],
};

export const DEFAULT_PRICES: Price[] = DEFAULT_PRODUCTS.flatMap((p): Price[] => {
  if (p.kind === "label_only") {
    return [{ productId: p.id, segment: "label", unitPricePaise: 400, isPlaceholder: true }];
  }
  const [ev, sh] = SAMPLE_BOTTLE_PRICE[p.volumeMl!];
  const glassExtra = p.bottleType === "glass" ? 2.5 : 1;
  return [
    { productId: p.id, segment: "event", unitPricePaise: Math.round(ev * glassExtra), isPlaceholder: true },
    { productId: p.id, segment: "shop", unitPricePaise: Math.round(sh * glassExtra), isPlaceholder: true },
  ];
});

export const DEFAULT_REGULATORY: RegulatoryInfo = {
  packagerName: "[Packager name]",
  packagerAddress: "Kolathur, Mettur Tk, Salem District, Tamil Nadu 636303",
  fssaiLicence: "[FSSAI Lic. No.]",
  bisLicence: "[CM/L-]",
  isStandard: "IS 14543",
  shelfLifeDays: 180,
  customerCare: "[Customer care number]",
};

export const DEFAULT_SETTINGS: BusinessSettings = {
  legalName: "hellolabels",
  gstin: "",
  stateCode: "33",
  address: "Kolathur, Mettur Tk, Salem District, Tamil Nadu 636303",
  whatsappNumber: "",
  pricesIncludeGst: true,
  dealerCommissionPct: 0,
  dealerAdSharePct: 0,
  advancePct: 50,
  advanceMinOrderPaise: 1000000, // ₹10,000
  minTextPt: 6,
  casesPerPack: 1,
  spoilagePct: 3,
  catalogReady: false,
};

export const DEFAULT_CATALOG: Catalog = {
  products: DEFAULT_PRODUCTS,
  labelSizes: DEFAULT_LABEL_SIZES,
  prices: DEFAULT_PRICES,
  regulatory: DEFAULT_REGULATORY,
  settings: DEFAULT_SETTINGS,
};
