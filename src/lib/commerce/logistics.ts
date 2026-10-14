/** Batch pack numbers, delivery dates and truck loading. Pure functions — unit tested. */

export const PACK_NUMBER_RE = /^HL-([A-Z]{3})-(\d{6})-(R\d{1,2})-B(\d{3,4})$/;

/** HL-[district]-[YYMMDD]-[route]-[batch], e.g. HL-SLM-261108-R2-B014. */
export function packNumber(districtCode: string, date: Date, routeCode: string, batch: number): string {
  const d = districtCode.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(d)) throw new Error(`Bad district code: ${districtCode}`);
  const r = routeCode.trim().toUpperCase();
  if (!/^R\d{1,2}$/.test(r)) throw new Error(`Bad route code: ${routeCode}`);
  if (!Number.isInteger(batch) || batch < 1 || batch > 9999) throw new Error(`Bad batch: ${batch}`);
  return `HL-${d}-${yymmdd(date)}-${r}-B${String(batch).padStart(3, "0")}`;
}

export function parsePackNumber(s: string): { district: string; date: string; route: string; batch: number } | null {
  const m = s.trim().toUpperCase().match(PACK_NUMBER_RE);
  return m ? { district: m[1], date: m[2], route: m[3], batch: Number(m[4]) } : null;
}

/** YYMMDD in India time. */
export function yymmdd(d: Date): string {
  const ist = new Date(d.getTime() + 330 * 60_000);
  return `${String(ist.getUTCFullYear() % 100).padStart(2, "0")}${String(ist.getUTCMonth() + 1).padStart(2, "0")}${String(ist.getUTCDate()).padStart(2, "0")}`;
}

export function ddmmyyyy(d: Date): string {
  const ist = new Date(d.getTime() + 330 * 60_000);
  return `${String(ist.getUTCDate()).padStart(2, "0")}/${String(ist.getUTCMonth() + 1).padStart(2, "0")}/${ist.getUTCFullYear()}`;
}

/** Today's date in India as YYYY-MM-DD. */
export function istToday(now = new Date()): string {
  return new Date(now.getTime() + 330 * 60_000).toISOString().slice(0, 10);
}

/**
 * Earliest delivery date: production days (design approval, print, pack) plus travel days for the
 * district's distance zone from Mettur. Sundays are skipped.
 */
export function earliestDelivery(now: Date, zone: 1 | 2 | 3, productionDays = 3): string {
  let days = productionDays + (zone - 1);
  const d = new Date(`${istToday(now)}T00:00:00Z`);
  while (days > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    if (d.getUTCDay() !== 0) days--;
  }
  return d.toISOString().slice(0, 10);
}

export interface Stop {
  orderId: string;
  /** 1 = first delivery on the route. */
  stopSeq: number;
  packs: string[];
}

export interface LoadStep {
  loadSeq: number;
  orderId: string;
  stopSeq: number;
  packs: string[];
}

/**
 * Loading order for a truck: the LAST stop is loaded first (deepest in the truck) so the first
 * stop's packs end up at the door.
 */
export function loadPlan(stops: Stop[]): LoadStep[] {
  const seqs = stops.map((s) => s.stopSeq);
  if (new Set(seqs).size !== seqs.length) throw new Error("Each stop needs its own sequence number");
  return [...stops]
    .sort((a, b) => b.stopSeq - a.stopSeq)
    .map((s, i) => ({ loadSeq: i + 1, orderId: s.orderId, stopSeq: s.stopSeq, packs: [...s.packs].sort() }));
}

/** Group orders by route code, preserving input order inside each route. */
export function groupByRoute<T extends { routeCode: string | null }>(orders: T[]): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const o of orders) {
    const k = o.routeCode ?? "UNASSIGNED";
    out.set(k, [...(out.get(k) ?? []), o]);
  }
  return out;
}

/** How many packs an order line becomes (one pack = `casesPerPack` cases; labels = one pack per line). */
export function packsFor(unit: "case" | "piece", qty: number, casesPerPack: number): number {
  return unit === "case" ? Math.ceil(qty / Math.max(1, casesPerPack)) : 1;
}

export const ORDER_STATUSES = ["placed", "design_approved", "printed", "packed", "loaded", "delivered"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number] | "cancelled" | "pending_payment";

export const STATUS_TEXT: Record<OrderStatus, { en: string; ta: string }> = {
  pending_payment: { en: "Waiting for payment", ta: "பணம் செலுத்தக் காத்திருக்கிறது" },
  placed: { en: "Order placed", ta: "ஆர்டர் செய்யப்பட்டது" },
  design_approved: { en: "Design approved", ta: "வடிவமைப்பு ஒப்புதல் பெற்றது" },
  printed: { en: "Printed", ta: "அச்சிடப்பட்டது" },
  packed: { en: "Packed", ta: "பேக் செய்யப்பட்டது" },
  loaded: { en: "Loaded on truck", ta: "லாரியில் ஏற்றப்பட்டது" },
  delivered: { en: "Delivered", ta: "டெலிவரி செய்யப்பட்டது" },
  cancelled: { en: "Cancelled", ta: "ரத்து செய்யப்பட்டது" },
};

/** Statuses may only move forward one step at a time (or to cancelled before loading). */
export function canMoveTo(from: OrderStatus, to: OrderStatus): boolean {
  if (to === "cancelled") return ["pending_payment", "placed", "design_approved", "printed", "packed"].includes(from);
  if (from === "pending_payment") return to === "placed";
  const i = ORDER_STATUSES.indexOf(from as (typeof ORDER_STATUSES)[number]);
  const j = ORDER_STATUSES.indexOf(to as (typeof ORDER_STATUSES)[number]);
  return i >= 0 && j === i + 1;
}
