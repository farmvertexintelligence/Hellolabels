import type { LabelSize, Segment } from "@/lib/catalog/types";
import type { Box } from "./types";

export const BLEED_MM = 2;
export const SAFE_MM = 3;
/** Share of the label area reserved for the local advertisement on Shop labels. */
export const AD_SHARE = 0.2;

export interface LabelZones {
  width: number;
  height: number;
  trim: Box;
  /** Trim box grown by the bleed. */
  bleed: Box;
  /** Trim box shrunk by the safe margin. */
  safe: Box;
  /** Locked, auto-filled regulatory panel. */
  regPanel: Box | null;
  /** Locked advertisement strip (Shop labels only). */
  adStrip: Box | null;
  /** Wrap labels: glued overlap hidden under the other end. Nothing but background may go here. */
  overlap: Box | null;
  /** Where the customer's design goes: the safe area minus every locked zone (with a safe gap). */
  design: Box;
  /** Locked zones that design elements must never cover. */
  locked: { kind: "regulatory" | "ad" | "overlap"; box: Box }[];
}

export function computeZones(size: LabelSize, segment: Segment): LabelZones {
  const W = size.widthMm;
  const H = size.heightMm;
  const trim = { x: 0, y: 0, w: W, h: H };
  const bleed = { x: -BLEED_MM, y: -BLEED_MM, w: W + 2 * BLEED_MM, h: H + 2 * BLEED_MM };
  const safe = { x: SAFE_MM, y: SAFE_MM, w: W - 2 * SAFE_MM, h: H - 2 * SAFE_MM };
  const shop = segment === "shop";

  let regPanel: Box | null = null;
  let adStrip: Box | null = null;
  let overlap: Box | null = null;
  let design: Box;

  if (size.wraps) {
    // Left → right: [ad strip] [customer design — the bottle front] [regulatory panel] [glue overlap]
    // The two ends meet on the back of the bottle, so the ad and regulatory panel sit side by side there.
    const ov = size.overlapMm;
    overlap = ov > 0 ? { x: W - ov, y: 0, w: ov, h: H } : null;
    const right = W - ov;
    if (size.hasRegPanel) regPanel = { x: right - size.regPanelMm, y: 0, w: size.regPanelMm, h: H };
    if (shop) adStrip = { x: 0, y: 0, w: round(W * AD_SHARE), h: H };
    const x0 = (adStrip ? adStrip.w : 0) + SAFE_MM;
    const x1 = (regPanel ? regPanel.x : right) - SAFE_MM;
    design = { x: x0, y: SAFE_MM, w: x1 - x0, h: H - 2 * SAFE_MM };
  } else {
    // Portrait label (the standard hellolabels format), top → bottom:
    //   [ square design area ]  — full width inside the 3 mm safe margins
    //   [ ad strip, 20% of the label height (= 20% of its area) ]  — Shop labels only
    //   [ regulatory panel ]  — takes the rest; on Event labels it also gets the space of the ad strip
    // Label-only products (no regulatory panel, no ad) may use the whole safe area.
    const side = W - 2 * SAFE_MM;
    const below = W; // square bottom (side + SAFE) + a SAFE gap before the next zone
    if (!size.hasRegPanel && !shop) {
      design = { ...safe };
    } else {
      design = { x: SAFE_MM, y: SAFE_MM, w: side, h: Math.min(side, H - 2 * SAFE_MM) };
      let y = below;
      if (shop) {
        adStrip = { x: 0, y, w: W, h: round(H * AD_SHARE) };
        y += adStrip.h;
      }
      if (size.hasRegPanel && y < H) regPanel = { x: 0, y, w: W, h: round(H - y) };
    }
  }

  const locked: LabelZones["locked"] = [];
  if (regPanel) locked.push({ kind: "regulatory", box: regPanel });
  if (adStrip) locked.push({ kind: "ad", box: adStrip });
  if (overlap) locked.push({ kind: "overlap", box: overlap });

  return { width: W, height: H, trim, bleed, safe, regPanel, adStrip, overlap, design: roundBox(design), locked };
}

const round = (v: number) => Math.round(v * 10) / 10;
const roundBox = (b: Box): Box => ({ x: round(b.x), y: round(b.y), w: round(b.w), h: round(b.h) });

/** Axis-aligned bounding box of a (possibly rotated) element. */
export function boundsOf(b: Box & { rotation?: number }): Box {
  const r = ((b.rotation ?? 0) * Math.PI) / 180;
  if (!r) return { x: b.x, y: b.y, w: b.w, h: b.h };
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  const c = Math.abs(Math.cos(r));
  const s = Math.abs(Math.sin(r));
  const w = b.w * c + b.h * s;
  const h = b.w * s + b.h * c;
  return { x: cx - w / 2, y: cy - h / 2, w, h };
}

export const intersects = (a: Box, b: Box) =>
  a.x < b.x + b.w - 1e-6 && b.x < a.x + a.w - 1e-6 && a.y < b.y + b.h - 1e-6 && b.y < a.y + a.h - 1e-6;

export const contains = (outer: Box, inner: Box, tol = 0.05) =>
  inner.x >= outer.x - tol &&
  inner.y >= outer.y - tol &&
  inner.x + inner.w <= outer.x + outer.w + tol &&
  inner.y + inner.h <= outer.y + outer.h + tol;
