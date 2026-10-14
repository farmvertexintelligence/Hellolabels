/**
 * Lays labels out across the roll for the Memjet QM210D (roll-to-roll, max print width 215.9 mm)
 * so as little label stock as possible is wasted. Pure functions — unit tested.
 */

export const MEMJET_MAX_PRINT_WIDTH_MM = 215.9;

export interface RollSpec {
  /** Label stock widths the shop keeps (mm). The printable width is capped at 215.9 mm. */
  rollWidthsMm: number[];
  /** Unprinted margin on each side of the web. */
  sideMarginMm: number;
  /** Space between neighbouring labels' bleed boxes (die-cut matrix). */
  gapMm: number;
  bleedMm: number;
  /** Allow turning labels 90° when that fits more across the roll. */
  allowRotate: boolean;
  /** Maximum length of one repeat frame (one PDF page) along the roll. */
  maxFrameLengthMm: number;
}

export const DEFAULT_ROLL_SPEC: RollSpec = {
  rollWidthsMm: [215.9, 200, 160, 130, 108],
  sideMarginMm: 3,
  gapMm: 3,
  bleedMm: 2,
  allowRotate: true,
  maxFrameLengthMm: 600,
};

export interface Imposition {
  rollWidthMm: number;
  printWidthMm: number;
  rotated: boolean;
  /** Labels side by side across the roll. */
  across: number;
  /** Bleed-box size of one label as placed (after rotation). */
  cellAcrossMm: number;
  cellAlongMm: number;
  /** Distance from one row to the next along the roll. */
  pitchMm: number;
  /** Rows in one repeat frame (one PDF page) and labels per frame. */
  rowsPerFrame: number;
  labelsPerFrame: number;
  frameLengthMm: number;
  /** Frames to print to reach the quantity (including spoilage). */
  frames: number;
  labelsPrinted: number;
  rollLengthMm: number;
  /** Share of the stock area that is not finished label (gaps, bleed, margins, unused width). */
  wastePct: number;
  /** Left offset of the first column inside the roll (labels are centred across the web). */
  offsetXMm: number;
}

export function planImposition(trimWmm: number, trimHmm: number, quantity: number, spec: RollSpec = DEFAULT_ROLL_SPEC): Imposition {
  if (trimWmm <= 0 || trimHmm <= 0) throw new Error("Label size must be positive");
  const qty = Math.max(1, Math.ceil(quantity));
  let best: Imposition | null = null;

  for (const roll of spec.rollWidthsMm) {
    const printW = Math.min(roll, MEMJET_MAX_PRINT_WIDTH_MM);
    const usable = Math.min(roll - 2 * spec.sideMarginMm, printW);
    for (const rotated of spec.allowRotate ? [false, true] : [false]) {
      const cellAcross = (rotated ? trimHmm : trimWmm) + 2 * spec.bleedMm;
      const cellAlong = (rotated ? trimWmm : trimHmm) + 2 * spec.bleedMm;
      const across = Math.floor((usable + spec.gapMm) / (cellAcross + spec.gapMm));
      if (across < 1) continue;
      const pitch = cellAlong + spec.gapMm;
      const rowsNeeded = Math.ceil(qty / across);
      const rowsPerFrame = Math.max(1, Math.min(rowsNeeded, Math.floor((spec.maxFrameLengthMm + spec.gapMm) / pitch)));
      const frames = Math.ceil(rowsNeeded / rowsPerFrame);
      const frameLength = rowsPerFrame * pitch;
      const rollLength = frames * frameLength;
      const finished = qty * trimWmm * trimHmm;
      const wastePct = Math.max(0, (1 - finished / (roll * rollLength)) * 100);
      const usedWidth = across * cellAcross + (across - 1) * spec.gapMm;
      const candidate: Imposition = {
        rollWidthMm: roll,
        printWidthMm: printW,
        rotated,
        across,
        cellAcrossMm: cellAcross,
        cellAlongMm: cellAlong,
        pitchMm: pitch,
        rowsPerFrame,
        labelsPerFrame: rowsPerFrame * across,
        frameLengthMm: frameLength,
        frames,
        labelsPrinted: frames * rowsPerFrame * across,
        rollLengthMm: rollLength,
        wastePct: Math.round(wastePct * 10) / 10,
        offsetXMm: (roll - usedWidth) / 2,
      };
      // Least stock area used wins; ties go to the narrower roll, then to no rotation.
      const area = (i: Imposition) => i.rollWidthMm * i.rollLengthMm;
      if (!best || area(candidate) < area(best) - 1e-6 || (Math.abs(area(candidate) - area(best)) < 1e-6 && candidate.rollWidthMm < best.rollWidthMm)) {
        best = candidate;
      }
    }
  }
  if (!best) throw new Error(`A ${trimWmm} × ${trimHmm} mm label does not fit any roll width`);
  return best;
}

/** Quantity of labels to print for an order line (bottles + spoilage allowance). */
export const labelsToPrint = (items: number, spoilagePct: number) => Math.ceil(items * (1 + spoilagePct / 100));
