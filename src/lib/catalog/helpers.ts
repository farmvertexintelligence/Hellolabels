import type { Catalog, LabelSize, Price, Product, Segment } from "./types";

export function findProduct(catalog: Catalog, id: string): Product | undefined {
  return catalog.products.find((p) => p.id === id);
}

export function findProductBySlug(catalog: Catalog, slug: string): Product | undefined {
  return catalog.products.find((p) => p.slug === slug);
}

export function findLabelSize(catalog: Catalog, id: string): LabelSize | undefined {
  return catalog.labelSizes.find((s) => s.id === id);
}

/** Label-only products always use the "label" price row; water uses the customer's segment. */
export function priceSegment(product: Product, segment: Segment): Segment {
  return product.kind === "label_only" ? "label" : segment === "label" ? "event" : segment;
}

export function findPrice(catalog: Catalog, product: Product, segment: Segment): Price | undefined {
  const seg = priceSegment(product, segment);
  return catalog.prices.find((p) => p.productId === product.id && p.segment === seg);
}

/** Water products: the bottle sizes for one bottle type, ordered by volume. */
export function waterProducts(catalog: Catalog, bottleType?: "plastic" | "glass"): Product[] {
  return catalog.products
    .filter((p) => p.active && p.kind === "water_bottle" && (!bottleType || p.bottleType === bottleType))
    .sort((a, b) => a.sort - b.sort);
}

export function labelProducts(catalog: Catalog): Product[] {
  return catalog.products.filter((p) => p.active && p.kind === "label_only").sort((a, b) => a.sort - b.sort);
}

/** Number of physical items (bottles or labels) for a quantity in the product's unit. */
export function itemsFor(product: Product, qty: number): number {
  return product.unit === "case" ? qty * product.caseSize : qty;
}

/**
 * Why a product cannot be sold yet (placeholder size or price), or null when it is ready.
 * Checkout refuses orders while any reason applies, so a sample number can never be charged.
 */
export function notSellableReason(catalog: Catalog, product: Product, segment: Segment): string | null {
  if (!product.active) return "This product is not available right now.";
  const price = findPrice(catalog, product, segment);
  if (!price || price.isPlaceholder) return "Price not confirmed yet by hellolabels.";
  for (const id of product.labelSizeIds) {
    const size = findLabelSize(catalog, id);
    if (!size || size.isPlaceholder) return "Label size not confirmed yet by hellolabels.";
  }
  if (product.kind === "water_bottle" && !product.mrpPaise) return "MRP not set yet by hellolabels.";
  return null;
}

export const GLASS_PACKING_NOTE = {
  en: "Packed safely in bubble wrap with extra protection.",
  ta: "கூடுதல் பாதுகாப்புடன் பபிள் ராப்பில் பாதுகாப்பாக பேக் செய்யப்படும்.",
};
