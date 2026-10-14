import type { Segment } from "@/lib/catalog/types";
import type { FontId } from "./fonts";
import type { MotifId } from "./motifs";

/** All positions and sizes are millimetres from the top-left corner of the cut line (trim box). */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface BaseElement extends Box {
  id: string;
  /** Degrees, clockwise, around the element centre. */
  rotation?: number;
  opacity?: number;
  /**
   * "background" elements (full-bleed photos, colour bands, borders) may run into the bleed.
   * Everything else (text, logos, content) must stay inside the safe area.
   */
  role?: "content" | "background";
  /** Short label for the layers list and AI edits, e.g. "names", "date", "logo". */
  name?: string;
}

export interface TextElement extends BaseElement {
  type: "text";
  text: string;
  font: FontId;
  weight: number;
  sizePt: number;
  color: string;
  align: "left" | "center" | "right";
  /** Multiplier of the font size. */
  lineHeight: number;
  /** Letter spacing in em. */
  letterSpacing?: number;
  italic?: boolean;
  uppercase?: boolean;
  /** Shrink the text until it fits the box (never below the minimum readable size). */
  autoFit?: boolean;
}

export interface ImageElement extends BaseElement {
  type: "image";
  /** Storage path of the uploaded original ("uploads/…") or an absolute/blob URL in the browser. */
  src: string;
  /** Pixel size of the uploaded original, used for the print-quality (DPI) check. */
  pxWidth: number;
  pxHeight: number;
  fit: "cover" | "contain";
  radiusMm?: number;
  /** Circle crop (photos of the couple, logos). */
  circle?: boolean;
}

export interface ShapeElement extends BaseElement {
  type: "shape";
  shape: "rect" | "ellipse" | "line";
  fill: string | null;
  stroke: string | null;
  strokeMm?: number;
  radiusMm?: number;
}

export interface MotifElement extends BaseElement {
  type: "motif";
  motif: MotifId;
  color: string;
  color2?: string;
}

export type DesignElement = TextElement | ImageElement | ShapeElement | MotifElement;

export interface Background {
  color: string;
  color2?: string;
  gradient?: "none" | "linear" | "radial";
  /** Linear gradient angle in degrees (0 = left→right). */
  angle?: number;
}

export interface Design {
  v: 1;
  labelSizeId: string;
  segment: Segment;
  name?: string;
  templateId?: string;
  background: Background;
  elements: DesignElement[];
}

/** Values printed on the locked regulatory panel. Batch and dates are filled at print time. */
export interface RegPanelData {
  packagerName: string;
  packagerAddress: string;
  fssaiLicence: string;
  bisLicence: string;
  isStandard: string;
  customerCare: string;
  volumeMl: number | null;
  mrpPaise: number | null;
  batchNo: string;
  mfgDate: string; // dd/mm/yyyy
  bestBefore: string; // dd/mm/yyyy or "x months from mfg"
}
