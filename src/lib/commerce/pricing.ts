import { findPrice, findProduct, itemsFor, notSellableReason, priceSegment } from "@/lib/catalog/helpers";
import type { Catalog, Segment } from "@/lib/catalog/types";
import { splitTax, TN_STATE_CODE, type TaxSplit } from "./gst";

export interface CartLineInput {
  productId: string;
  segment: Segment;
  /** Quantity in the product's unit: cases (water) or pieces (labels). */
  qty: number;
}

export interface PricedLine extends TaxSplit {
  productId: string;
  segment: Segment;
  qty: number;
  items: number;
  unitPricePaise: number;
  hsn: string;
  gstRatePct: number;
  errors: string[];
}

export interface PricedCart {
  lines: PricedLine[];
  taxablePaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  totalPaise: number;
  errors: string[];
  intraState: boolean;
}

/** Validates a quantity against the product's minimum order and step. Returns an error or null. */
export function qtyError(catalog: Catalog, productId: string, qty: number): string | null {
  const p = findProduct(catalog, productId);
  if (!p) return "Unknown product";
  if (!Number.isInteger(qty) || qty <= 0) return "Enter a whole number";
  const unit = p.unit === "case" ? `case${p.minQty === 1 ? "" : "s"} (${p.caseSize} bottles each)` : "labels";
  if (qty < p.minQty) return `Minimum order is ${p.minQty} ${unit}`;
  if ((qty - p.minQty) % p.qtyStep !== 0) return `Order in steps of ${p.qtyStep}`;
  return null;
}

/**
 * Prices a cart from the catalog (never from the browser). Fixed price per bottle/label by product
 * and segment; GST by HSN rate, split CGST+SGST inside Tamil Nadu or IGST outside it.
 */
export function priceCart(catalog: Catalog, input: CartLineInput[], buyerStateCode = TN_STATE_CODE): PricedCart {
  const intraState = buyerStateCode === (catalog.settings.stateCode || TN_STATE_CODE);
  const errors: string[] = [];
  const lines: PricedLine[] = input.map((l) => {
    const product = findProduct(catalog, l.productId);
    const lineErrors: string[] = [];
    if (!product) {
      return { productId: l.productId, segment: l.segment, qty: l.qty, items: 0, unitPricePaise: 0, hsn: "", gstRatePct: 0, errors: ["Unknown product"], ...splitTax(0, 0, true, intraState) };
    }
    const seg = priceSegment(product, l.segment);
    const price = findPrice(catalog, product, seg);
    const q = qtyError(catalog, product.id, l.qty);
    if (q) lineErrors.push(q);
    const notSellable = notSellableReason(catalog, product, seg);
    if (notSellable) lineErrors.push(notSellable);
    const items = itemsFor(product, l.qty);
    const unit = price?.unitPricePaise ?? 0;
    const tax = splitTax(unit * items, product.gstRatePct, catalog.settings.pricesIncludeGst, intraState);
    return { productId: product.id, segment: seg, qty: l.qty, items, unitPricePaise: unit, hsn: product.hsn, gstRatePct: product.gstRatePct, errors: lineErrors, ...tax };
  });
  if (!lines.length) errors.push("Your cart is empty");
  for (const l of lines) errors.push(...l.errors.map((e) => `${l.productId}: ${e}`));
  const sum = (k: keyof TaxSplit) => lines.reduce((a, l) => a + l[k], 0);
  return { lines, taxablePaise: sum("taxablePaise"), cgstPaise: sum("cgstPaise"), sgstPaise: sum("sgstPaise"), igstPaise: sum("igstPaise"), totalPaise: sum("totalPaise"), errors, intraState };
}

export type PaymentPlan = "full" | "advance";

/** 50% advance is offered on large Event orders only. */
export function advanceAllowed(catalog: Catalog, segment: Segment, totalPaise: number): boolean {
  return segment === "event" && totalPaise >= catalog.settings.advanceMinOrderPaise && catalog.settings.advancePct > 0 && catalog.settings.advancePct < 100;
}

/** Amount to collect now; the advance is rounded up to the next whole rupee. */
export function amountDueNow(catalog: Catalog, plan: PaymentPlan, totalPaise: number): number {
  if (plan === "full") return totalPaise;
  return Math.min(totalPaise, Math.ceil((totalPaise * catalog.settings.advancePct) / 100 / 100) * 100);
}

export const formatInr = (paise: number) =>
  `₹${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: paise % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;
