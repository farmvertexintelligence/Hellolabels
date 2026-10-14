import { describe, expect, it } from "vitest";
import { DEFAULT_CATALOG } from "@/lib/catalog/defaults";
import type { Catalog } from "@/lib/catalog/types";
import { aadhaarLast4, decryptFile, encryptFile, isValidAadhaar, sniffKycType } from "@/lib/commerce/aadhaar";
import { financialYear, invoiceNumber, isValidGstin, rupeesInWords, splitTax } from "@/lib/commerce/gst";
import { canMoveTo, earliestDelivery, loadPlan, packNumber, packsFor, parsePackNumber, yymmdd } from "@/lib/commerce/logistics";
import { advanceAllowed, amountDueNow, priceCart, qtyError } from "@/lib/commerce/pricing";
import { hmacSha256Hex, verifyCheckoutSignature, verifyWebhookSignature } from "@/lib/commerce/razorpay-signature";

/** The default catalogue with every placeholder confirmed (as an admin would). */
function confirmed(): Catalog {
  const c = structuredClone(DEFAULT_CATALOG);
  c.prices.forEach((p) => (p.isPlaceholder = false));
  c.labelSizes.forEach((s) => (s.isPlaceholder = false));
  c.products.forEach((p) => (p.mrpPaise = p.kind === "water_bottle" ? 2000 : null));
  return c;
}

describe("GST", () => {
  it("validates GSTIN check digits", () => {
    expect(isValidGstin("27AAPFU0939F1ZV")).toBe(true);
    expect(isValidGstin("27AAPFU0939F1ZW")).toBe(false);
    expect(isValidGstin("33ABCDE1234F1Z")).toBe(false);
  });
  it("splits GST-inclusive amounts into CGST+SGST inside Tamil Nadu and IGST outside", () => {
    const intra = splitTax(11800, 18, true, true);
    expect(intra).toEqual({ taxablePaise: 10000, cgstPaise: 900, sgstPaise: 900, igstPaise: 0, totalPaise: 11800 });
    const inter = splitTax(11800, 18, true, false);
    expect(inter.igstPaise).toBe(1800);
    expect(splitTax(10000, 18, false, true).totalPaise).toBe(11800);
    // Odd paise: totals always add up.
    const odd = splitTax(1001, 18, true, true);
    expect(odd.taxablePaise + odd.cgstPaise + odd.sgstPaise).toBe(1001);
  });
  it("numbers invoices by Indian financial year", () => {
    expect(financialYear(new Date("2026-10-14T00:00:00Z"))).toBe("2026-27");
    expect(financialYear(new Date("2027-03-31T00:00:00Z"))).toBe("2026-27");
    expect(invoiceNumber(new Date("2026-10-14T00:00:00Z"), 123)).toBe("HL/26-27/000123");
    expect(invoiceNumber(new Date("2026-10-14T00:00:00Z"), 123).length).toBeLessThanOrEqual(16);
  });
  it("writes amounts in words (Indian numbering)", () => {
    expect(rupeesInWords(12345678)).toBe("Rupees One Lakh Twenty Three Thousand Four Hundred Fifty Six and Seventy Eight Paise Only");
    expect(rupeesInWords(100)).toBe("Rupees One Only");
  });
});

describe("pricing", () => {
  it("refuses placeholder prices and sizes so sample numbers are never charged", () => {
    const r = priceCart(DEFAULT_CATALOG, [{ productId: "water-500-plastic", segment: "event", qty: 10 }]);
    expect(r.errors.join(" ")).toMatch(/not confirmed/);
  });
  it("prices per bottle × 24 per case with GST split", () => {
    const c = confirmed();
    const r = priceCart(c, [{ productId: "water-500-plastic", segment: "event", qty: 10 }]);
    expect(r.errors).toEqual([]);
    expect(r.lines[0].items).toBe(240);
    expect(r.totalPaise).toBe(240 * 1300);
    expect(r.cgstPaise + r.sgstPaise + r.taxablePaise).toBe(r.totalPaise);
    const shop = priceCart(c, [{ productId: "water-500-plastic", segment: "shop", qty: 10 }]);
    expect(shop.totalPaise).toBe(240 * 1000);
  });
  it("enforces the minimum order and step", () => {
    const c = confirmed();
    expect(qtyError(c, "water-500-plastic", 9)).toMatch(/Minimum order is 10/);
    expect(qtyError(c, "label-sticker", 250)).toMatch(/steps of 100/);
    expect(qtyError(c, "label-sticker", 300)).toBeNull();
  });
  it("offers the 50% advance only on large event orders", () => {
    const c = confirmed();
    expect(advanceAllowed(c, "event", 2_000_000)).toBe(true);
    expect(advanceAllowed(c, "event", 100_000)).toBe(false);
    expect(advanceAllowed(c, "shop", 2_000_000)).toBe(false);
    expect(amountDueNow(c, "advance", 1_000_050)).toBe(500_100); // rounded up to the rupee
    expect(amountDueNow(c, "full", 1_000_050)).toBe(1_000_050);
  });
});

describe("logistics", () => {
  it("formats batch pack numbers as HL-[district]-[YYMMDD]-[route]-[batch]", () => {
    expect(packNumber("SLM", new Date("2026-11-08T04:00:00Z"), "R2", 14)).toBe("HL-SLM-261108-R2-B014");
    expect(parsePackNumber("hl-slm-261108-r2-b014")).toEqual({ district: "SLM", date: "261108", route: "R2", batch: 14 });
    expect(() => packNumber("SALEM", new Date(), "R2", 1)).toThrow();
    expect(parsePackNumber("HL-SLM-261108-X2-B014")).toBeNull();
  });
  it("uses India time for the date", () => {
    expect(yymmdd(new Date("2026-11-07T20:00:00Z"))).toBe("261108"); // 01:30 IST next day
  });
  it("loads the last stop first", () => {
    const plan = loadPlan([
      { orderId: "a", stopSeq: 1, packs: ["p1"] },
      { orderId: "b", stopSeq: 2, packs: ["p2"] },
      { orderId: "c", stopSeq: 3, packs: ["p3"] },
    ]);
    expect(plan.map((p) => p.orderId)).toEqual(["c", "b", "a"]);
    expect(plan.map((p) => p.loadSeq)).toEqual([1, 2, 3]);
    expect(() => loadPlan([{ orderId: "a", stopSeq: 1, packs: [] }, { orderId: "b", stopSeq: 1, packs: [] }])).toThrow();
  });
  it("skips Sundays when computing the earliest delivery", () => {
    // Friday 16 Oct 2026 (IST): +3 working days → Tue 20 Oct (Sunday skipped).
    expect(earliestDelivery(new Date("2026-10-16T06:00:00Z"), 1)).toBe("2026-10-20");
    expect(earliestDelivery(new Date("2026-10-16T06:00:00Z"), 3)).toBe("2026-10-22");
  });
  it("only moves order status forward one step", () => {
    expect(canMoveTo("placed", "design_approved")).toBe(true);
    expect(canMoveTo("placed", "printed")).toBe(false);
    expect(canMoveTo("loaded", "cancelled")).toBe(false);
    expect(canMoveTo("pending_payment", "placed")).toBe(true);
  });
  it("splits cases into packs", () => {
    expect(packsFor("case", 10, 1)).toBe(10);
    expect(packsFor("case", 10, 4)).toBe(3);
    expect(packsFor("piece", 500, 4)).toBe(1);
  });
});

describe("Razorpay signatures", () => {
  it("verifies checkout and webhook signatures with a constant-time compare", () => {
    const sig = hmacSha256Hex("secret", "order_1|pay_1");
    expect(verifyCheckoutSignature("order_1", "pay_1", sig, "secret")).toBe(true);
    expect(verifyCheckoutSignature("order_1", "pay_2", sig, "secret")).toBe(false);
    expect(verifyCheckoutSignature("order_1", "pay_1", sig, "")).toBe(false);
    const body = '{"event":"payment.captured"}';
    expect(verifyWebhookSignature(body, hmacSha256Hex("wh", body), "wh")).toBe(true);
    expect(verifyWebhookSignature(body + " ", hmacSha256Hex("wh", body), "wh")).toBe(false);
    expect(verifyWebhookSignature(body, null, "wh")).toBe(false);
  });
});

describe("Aadhaar KYC", () => {
  it("validates the Verhoeff check digit and keeps only the last 4", () => {
    expect(isValidAadhaar("4991 1866 5246")).toBe(true);
    expect(isValidAadhaar("499118665247")).toBe(false);
    expect(isValidAadhaar("123456789012")).toBe(false); // cannot start with 1
    expect(aadhaarLast4("4991 1866 5246")).toBe("5246");
  });
  it("encrypts files with AES-GCM bound to the dealer", () => {
    const key = Buffer.alloc(32, 7).toString("base64");
    const plain = Buffer.from("%PDF-1.7 aadhaar");
    const blob = encryptFile(plain, key, "dealer-1");
    expect(blob.includes(plain)).toBe(false);
    expect(decryptFile(blob, key, "dealer-1").equals(plain)).toBe(true);
    expect(() => decryptFile(blob, key, "dealer-2")).toThrow();
    const tampered = Buffer.from(blob);
    tampered[tampered.length - 1] ^= 1;
    expect(() => decryptFile(tampered, key, "dealer-1")).toThrow();
    expect(sniffKycType(plain)).toBe("application/pdf");
    expect(sniffKycType(Buffer.from("<html>"))).toBeNull();
  });
});
