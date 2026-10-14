import type { LabelSize, Segment } from "@/lib/catalog/types";
import { contrastRatio, readableOn } from "./color";
import type { FontId } from "./fonts";
import type { MotifId } from "./motifs";
import type { Box, Design, DesignElement, ImageElement, TextElement } from "./types";
import { computeZones } from "./zones";

export type TemplateId =
  | "wedding"
  | "birthday"
  | "housewarming"
  | "corporate"
  | "temple"
  | "shop"
  | "pongal"
  | "deepavali"
  | "tamil-new-year";

export interface TemplateFields {
  title: string; // names / shop name / main greeting
  subtitle: string; // occasion line
  date: string;
  message: string; // venue, tagline, phone…
  photo?: Pick<ImageElement, "src" | "pxWidth" | "pxHeight">;
}

export type Layout = "stack" | "side" | "band" | "monogram";

export interface Style {
  bg: string;
  bg2?: string;
  ink: string;
  accent: string;
  accent2: string;
  titleFont: FontId;
  titleWeight: number;
  bodyFont: FontId;
  layout: Layout;
  border?: MotifId;
  motif?: MotifId;
  /** Second motif for wide labels (shown at both ends). */
  sideMotif?: MotifId;
  uppercaseSubtitle?: boolean;
}

export interface TemplateDef {
  id: TemplateId;
  en: string;
  ta: string;
  segment: Segment;
  keywords: string[];
  defaults: { en: TemplateFields; ta: TemplateFields };
  styles: [Style, Style, Style, Style];
}

export const TEMPLATES: TemplateDef[] = [
  {
    id: "wedding",
    en: "Wedding",
    ta: "திருமணம்",
    segment: "event",
    keywords: ["wedding", "marriage", "weds", "reception", "engagement", "திருமண", "கல்யாண", "நிச்சயதார்த்த", "வரவேற்பு"],
    defaults: {
      en: { title: "Priya & Arun", subtitle: "Wedding", date: "08 Nov 2026", message: "With love from both families" },
      ta: { title: "பிரியா & அருண்", subtitle: "திருமண விழா", date: "08 நவம்பர் 2026", message: "இரு குடும்பத்தாரின் அன்புடன்" },
    },
    styles: [
      { bg: "#8E1B1B", bg2: "#5E0F12", ink: "#F8E7C2", accent: "#D4A437", accent2: "#F3C969", titleFont: "greatvibes", titleWeight: 400, bodyFont: "cinzel", layout: "stack", border: "border-double", sideMotif: "thoranam", uppercaseSubtitle: true },
      { bg: "#FBF4E6", ink: "#6B1420", accent: "#B8862F", accent2: "#2E6B3A", titleFont: "playfair", titleWeight: 700, bodyFont: "fraunces", layout: "band", border: "border-floral", motif: "thoranam" },
      { bg: "#F6F3EC", ink: "#141A26", accent: "#B5452A", accent2: "#D4A437", titleFont: "greatvibes", titleWeight: 400, bodyFont: "dmsans", layout: "side", motif: "rings", border: "border-dots" },
      { bg: "#3B1F5E", bg2: "#22123A", ink: "#F6EBD0", accent: "#E8B64C", accent2: "#F6EBD0", titleFont: "cinzel", titleWeight: 700, bodyFont: "playfair", layout: "monogram", border: "border-temple" },
    ],
  },
  {
    id: "birthday",
    en: "Birthday",
    ta: "பிறந்தநாள்",
    segment: "event",
    keywords: ["birthday", "bday", "turns", "anniversary", "baby", "naming", "பிறந்த", "பிறந்தநாள்", "ஆண்டு விழா"],
    defaults: {
      en: { title: "Aadhya turns 5", subtitle: "Happy Birthday", date: "14 Dec 2026", message: "Thank you for coming!" },
      ta: { title: "ஆத்யா – 5 வயது", subtitle: "இனிய பிறந்தநாள் வாழ்த்துக்கள்", date: "14 டிசம்பர் 2026", message: "வந்ததற்கு நன்றி!" },
    },
    styles: [
      { bg: "#FFC845", ink: "#141A26", accent: "#FF6A4D", accent2: "#7B5CF0", titleFont: "baloothambi", titleWeight: 800, bodyFont: "poppins", layout: "stack", motif: "balloons", sideMotif: "balloons" },
      { bg: "#7B5CF0", bg2: "#5A3FD0", ink: "#FFFFFF", accent: "#FFC845", accent2: "#1EC8A8", titleFont: "poppins", titleWeight: 800, bodyFont: "poppins", layout: "band", motif: "confetti" },
      { bg: "#FFFFFF", ink: "#141A26", accent: "#FF6A4D", accent2: "#1EC8A8", titleFont: "baloothambi", titleWeight: 800, bodyFont: "dmsans", layout: "side", motif: "stars", border: "border-dots" },
      { bg: "#1EC8A8", ink: "#0E2A2A", accent: "#FFFFFF", accent2: "#FFC845", titleFont: "poppins", titleWeight: 800, bodyFont: "poppins", layout: "monogram", sideMotif: "confetti" },
    ],
  },
  {
    id: "housewarming",
    en: "Housewarming",
    ta: "புதுமனை புகுவிழா",
    segment: "event",
    keywords: ["housewarming", "house warming", "griha", "gruha", "pravesam", "new home", "புதுமனை", "கிரகப்பிரவேச", "குடிபுகு"],
    defaults: {
      en: { title: "The Kumar Family", subtitle: "Griha Pravesam", date: "21 Jan 2027", message: "Welcome to our new home" },
      ta: { title: "குமார் குடும்பம்", subtitle: "புதுமனை புகுவிழா", date: "21 ஜனவரி 2027", message: "எங்கள் புதிய இல்லத்திற்கு வருக" },
    },
    styles: [
      { bg: "#FDF1C7", ink: "#5B2A0E", accent: "#2E7D32", accent2: "#E8A317", titleFont: "fraunces", titleWeight: 700, bodyFont: "dmsans", layout: "side", motif: "house", border: "border-kolam" },
      { bg: "#2E5E3A", ink: "#FDF6E3", accent: "#F2C14E", accent2: "#A8D08D", titleFont: "playfair", titleWeight: 700, bodyFont: "fraunces", layout: "stack", sideMotif: "thoranam", border: "border-double" },
      { bg: "#F6F3EC", ink: "#7A1F12", accent: "#E8A317", accent2: "#2E7D32", titleFont: "arima", titleWeight: 700, bodyFont: "muktamalar", layout: "band", motif: "thoranam" },
      { bg: "#8C2F1B", ink: "#FFF4DD", accent: "#F2C14E", accent2: "#FFF4DD", titleFont: "fraunces", titleWeight: 600, bodyFont: "dmsans", layout: "monogram", sideMotif: "kolam" },
    ],
  },
  {
    id: "corporate",
    en: "Corporate",
    ta: "நிறுவனம்",
    segment: "event",
    keywords: ["corporate", "company", "conference", "annual", "meet", "seminar", "launch", "office", "college", "school", "நிறுவன", "கல்லூரி", "கருத்தரங்"],
    defaults: {
      en: { title: "Kaveri Textiles", subtitle: "Annual Meet 2026", date: "05 Dec 2026", message: "Mettur · Salem" },
      ta: { title: "காவேரி டெக்ஸ்டைல்ஸ்", subtitle: "ஆண்டு விழா 2026", date: "05 டிசம்பர் 2026", message: "மேட்டூர் · சேலம்" },
    },
    styles: [
      { bg: "#141A26", ink: "#FFFFFF", accent: "#1EC8A8", accent2: "#7B5CF0", titleFont: "oswald", titleWeight: 700, bodyFont: "dmsans", layout: "side", motif: "stripes", uppercaseSubtitle: true },
      { bg: "#FFFFFF", ink: "#141A26", accent: "#1E4DB7", accent2: "#1EC8A8", titleFont: "dmsans", titleWeight: 700, bodyFont: "dmsans", layout: "band", motif: "waves" },
      { bg: "#0F3D57", bg2: "#0B2A3D", ink: "#FFFFFF", accent: "#FFC845", accent2: "#7FD6F2", titleFont: "poppins", titleWeight: 600, bodyFont: "dmsans", layout: "stack", sideMotif: "stripes" },
      { bg: "#F6F3EC", ink: "#141A26", accent: "#B5452A", accent2: "#545B68", titleFont: "fraunces", titleWeight: 700, bodyFont: "dmsans", layout: "monogram", border: "border-double" },
    ],
  },
  {
    id: "temple",
    en: "Temple festival",
    ta: "கோயில் திருவிழா",
    segment: "event",
    keywords: ["temple", "festival", "kumbabishekam", "thiruvizha", "pooja", "puja", "kovil", "கோயில்", "கோவில்", "திருவிழா", "கும்பாபிஷேக", "பூஜை"],
    defaults: {
      en: { title: "Sri Mariamman Temple", subtitle: "Thiruvizha", date: "02 Apr 2027", message: "Kolathur, Mettur" },
      ta: { title: "ஸ்ரீ மாரியம்மன் கோயில்", subtitle: "திருவிழா", date: "02 ஏப்ரல் 2027", message: "கொளத்தூர், மேட்டூர்" },
    },
    styles: [
      { bg: "#B22A12", bg2: "#7E1A0A", ink: "#FFF3D6", accent: "#F2B33D", accent2: "#FFF3D6", titleFont: "notoseriftamil", titleWeight: 700, bodyFont: "cinzel", layout: "side", motif: "gopuram", border: "border-temple" },
      { bg: "#F7E3B5", ink: "#7E1A0A", accent: "#C1440E", accent2: "#2E6B3A", titleFont: "arima", titleWeight: 700, bodyFont: "notosanstamil", layout: "stack", sideMotif: "diya", border: "border-kolam" },
      { bg: "#FFF8EC", ink: "#5E0F12", accent: "#E07B00", accent2: "#B22A12", titleFont: "notoseriftamil", titleWeight: 700, bodyFont: "notosanstamil", layout: "band", motif: "marigold" },
      { bg: "#E07B00", ink: "#2B0B03", accent: "#FFF3D6", accent2: "#7E1A0A", titleFont: "baloothambi", titleWeight: 800, bodyFont: "muktamalar", layout: "monogram", sideMotif: "gopuram" },
    ],
  },
  {
    id: "shop",
    en: "Shop brand",
    ta: "கடை பிராண்ட்",
    segment: "shop",
    keywords: ["shop", "store", "bakery", "hotel", "restaurant", "cafe", "café", "mess", "stores", "kadai", "கடை", "பேக்கரி", "ஹோட்டல்", "உணவகம்"],
    defaults: {
      en: { title: "Sri Murugan Bakery", subtitle: "Pure drinking water", date: "", message: "Mettur Dam Rd · 98xxx xxxxx" },
      ta: { title: "ஸ்ரீ முருகன் பேக்கரி", subtitle: "சுத்தமான குடிநீர்", date: "", message: "மேட்டூர் அணை சாலை · 98xxx xxxxx" },
    },
    styles: [
      { bg: "#0E6BA8", bg2: "#0A4E7D", ink: "#FFFFFF", accent: "#7FD6F2", accent2: "#FFC845", titleFont: "oswald", titleWeight: 700, bodyFont: "poppins", layout: "side", motif: "drop", sideMotif: "waves" },
      { bg: "#FFFFFF", ink: "#0B2A3D", accent: "#1EC8A8", accent2: "#0E6BA8", titleFont: "poppins", titleWeight: 800, bodyFont: "dmsans", layout: "band", motif: "waves" },
      { bg: "#141A26", ink: "#FFFFFF", accent: "#FF6A4D", accent2: "#FFC845", titleFont: "fraunces", titleWeight: 700, bodyFont: "dmsans", layout: "monogram", sideMotif: "drop" },
      { bg: "#E9F7F4", ink: "#0B3B36", accent: "#1EC8A8", accent2: "#0E6BA8", titleFont: "baloothambi", titleWeight: 800, bodyFont: "poppins", layout: "stack", sideMotif: "drop", border: "border-double" },
    ],
  },
  {
    id: "pongal",
    en: "Pongal",
    ta: "பொங்கல்",
    segment: "event",
    keywords: ["pongal", "sankranti", "thai", "பொங்கல்", "தை"],
    defaults: {
      en: { title: "Happy Pongal", subtitle: "இனிய பொங்கல் நல்வாழ்த்துக்கள்", date: "14 Jan 2027", message: "From the Selvam family" },
      ta: { title: "இனிய பொங்கல்", subtitle: "நல்வாழ்த்துக்கள்", date: "தை 1 · 14 ஜனவரி 2027", message: "செல்வம் குடும்பத்தினர்" },
    },
    styles: [
      { bg: "#FFD23F", ink: "#5B2A0E", accent: "#C1440E", accent2: "#2E7D32", titleFont: "baloothambi", titleWeight: 800, bodyFont: "muktamalar", layout: "side", motif: "pongal-pot", border: "border-kolam" },
      { bg: "#2E7D32", ink: "#FFF8E1", accent: "#FFD23F", accent2: "#FF8F00", titleFont: "arima", titleWeight: 700, bodyFont: "notosanstamil", layout: "stack", sideMotif: "sun" },
      { bg: "#FFF8E1", ink: "#7A1F12", accent: "#FF8F00", accent2: "#2E7D32", titleFont: "notoseriftamil", titleWeight: 700, bodyFont: "notosanstamil", layout: "band", motif: "thoranam" },
      { bg: "#C1440E", ink: "#FFF8E1", accent: "#FFD23F", accent2: "#FFF8E1", titleFont: "baloothambi", titleWeight: 800, bodyFont: "muktamalar", layout: "monogram", sideMotif: "kolam" },
    ],
  },
  {
    id: "deepavali",
    en: "Deepavali",
    ta: "தீபாவளி",
    segment: "event",
    keywords: ["deepavali", "diwali", "deepawali", "தீபாவளி"],
    defaults: {
      en: { title: "Happy Deepavali", subtitle: "தீபாவளி நல்வாழ்த்துக்கள்", date: "Nov 2026", message: "With best wishes" },
      ta: { title: "இனிய தீபாவளி", subtitle: "நல்வாழ்த்துக்கள்", date: "நவம்பர் 2026", message: "அன்புடன்" },
    },
    styles: [
      { bg: "#2A0F4A", bg2: "#140726", ink: "#FFE7A3", accent: "#FFB627", accent2: "#FF6A4D", titleFont: "cinzel", titleWeight: 700, bodyFont: "notoseriftamil", layout: "side", motif: "diya", sideMotif: "stars" },
      { bg: "#7A0F2E", ink: "#FFE7A3", accent: "#FFB627", accent2: "#FFE7A3", titleFont: "playfair", titleWeight: 700, bodyFont: "notosanstamil", layout: "stack", sideMotif: "diya", border: "border-double" },
      { bg: "#FFF4E0", ink: "#4A0E2E", accent: "#E8590C", accent2: "#7B5CF0", titleFont: "baloothambi", titleWeight: 800, bodyFont: "muktamalar", layout: "band", motif: "stars" },
      { bg: "#0E1A3A", ink: "#FFFFFF", accent: "#FFC845", accent2: "#FF6A4D", titleFont: "poppins", titleWeight: 800, bodyFont: "notosanstamil", layout: "monogram", sideMotif: "stars" },
    ],
  },
  {
    id: "tamil-new-year",
    en: "Tamil New Year",
    ta: "தமிழ்ப் புத்தாண்டு",
    segment: "event",
    keywords: ["tamil new year", "puthandu", "chithirai", "new year", "புத்தாண்டு", "சித்திரை"],
    defaults: {
      en: { title: "Puthandu Vazhthukkal", subtitle: "இனிய தமிழ்ப் புத்தாண்டு நல்வாழ்த்துக்கள்", date: "14 Apr 2027", message: "From all of us" },
      ta: { title: "இனிய தமிழ்ப் புத்தாண்டு", subtitle: "நல்வாழ்த்துக்கள்", date: "சித்திரை 1 · 14 ஏப்ரல் 2027", message: "அன்புடன்" },
    },
    styles: [
      { bg: "#FFE08A", ink: "#3E2A00", accent: "#2E7D32", accent2: "#E8590C", titleFont: "arima", titleWeight: 700, bodyFont: "notosanstamil", layout: "side", motif: "sun", border: "border-kolam" },
      { bg: "#1B5E20", ink: "#FFF8E1", accent: "#FFC845", accent2: "#A5D6A7", titleFont: "notoseriftamil", titleWeight: 700, bodyFont: "muktamalar", layout: "stack", sideMotif: "thoranam" },
      { bg: "#FFFDF5", ink: "#7A1F12", accent: "#E8590C", accent2: "#2E7D32", titleFont: "baloothambi", titleWeight: 800, bodyFont: "notosanstamil", layout: "band", motif: "thoranam" },
      { bg: "#E8590C", ink: "#FFFDF5", accent: "#FFE08A", accent2: "#FFFDF5", titleFont: "arima", titleWeight: 700, bodyFont: "muktamalar", layout: "monogram", sideMotif: "kolam" },
    ],
  },
];

export const templateById = (id: string) => TEMPLATES.find((t) => t.id === id);

/** The style's ink if it reads well on this colour, otherwise near-black or white. */
const inkOn = (bg: string, ink: string) => (contrastRatio(ink, bg) >= 4.5 ? ink : readableOn(bg, "#141A26", "#FFFFFF"));

let counter = 0;
export const newId = (prefix = "el") => `${prefix}${Date.now().toString(36)}${(counter++).toString(36)}`;

function text(name: string, box: Box, t: string, font: FontId, weight: number, sizePt: number, color: string, align: TextElement["align"] = "center", extra: Partial<TextElement> = {}): TextElement {
  return { id: newId("t"), type: "text", name, ...box, text: t, font, weight, sizePt, color, align, lineHeight: 1.15, autoFit: true, ...extra };
}

function inset(b: Box, d: number): Box {
  return { x: b.x + d, y: b.y + d, w: Math.max(1, b.w - 2 * d), h: Math.max(1, b.h - 2 * d) };
}

/** Text stack (subtitle / title / date / message) in a box, with proportional heights. */
function textStack(box: Box, fields: TemplateFields, s: Style, align: TextElement["align"], titleColor: string, bodyColor: string): DesignElement[] {
  // Small labels (stickers): no message line, and more room for the subtitle so text stays ≥ 6 pt.
  const small = box.w * box.h < 1500;
  const parts: [keyof TemplateFields, number][] = small
    ? [
        ["subtitle", 0.3],
        ["title", 0.45],
        ["date", 0.25],
      ]
    : [
        ["subtitle", 0.18],
        ["title", 0.42],
        ["date", 0.17],
        ["message", 0.15],
      ];
  const used = parts.filter(([k]) => (fields[k] as string | undefined)?.trim());
  const total = used.reduce((a, [, p]) => a + p, 0) || 1;
  const gap = box.h * 0.03;
  let y = box.y;
  const out: DesignElement[] = [];
  for (const [k, p] of used) {
    const h = (box.h - gap * (used.length - 1)) * (p / total);
    const b = { x: box.x, y, w: box.w, h };
    const v = fields[k] as string;
    if (k === "title") out.push(text("title", b, v, s.titleFont, s.titleWeight, 60, titleColor, align));
    else if (k === "subtitle")
      out.push(text("subtitle", b, v, s.bodyFont, 600, 22, s.accent === s.bg ? bodyColor : bodyColor, align, { uppercase: s.uppercaseSubtitle, letterSpacing: s.uppercaseSubtitle ? 0.12 : 0 }));
    else if (k === "date") out.push(text("date", b, v, s.bodyFont, 700, 18, bodyColor, align));
    else out.push(text("message", b, v, s.bodyFont, 400, 14, bodyColor, align));
    y += h + gap;
  }
  return out;
}

function photoEl(box: Box, photo: NonNullable<TemplateFields["photo"]>, ring: string): DesignElement[] {
  return [
    { id: newId("s"), type: "shape", name: "photo ring", shape: "ellipse", x: box.x - 0.6, y: box.y - 0.6, w: box.w + 1.2, h: box.h + 1.2, fill: ring, stroke: null },
    { id: newId("i"), type: "image", name: "photo", ...box, src: photo.src, pxWidth: photo.pxWidth, pxHeight: photo.pxHeight, fit: "cover", circle: true },
  ];
}

const initials = (title: string) => {
  const words = title.split(/\s*(?:&|and|weds|\s)\s*/i).filter((w) => /\p{L}/u.test(w));
  return words
    .slice(0, 2)
    .map((w) => [...w][0])
    .join(words.length > 1 ? "·" : "")
    .toUpperCase();
};

/** Builds a design for any label size from a template style and the customer's words. */
export function buildFromStyle(style: Style, fields: TemplateFields, size: LabelSize, segment: Segment, templateId?: string): Design {
  const z = computeZones(size, segment);
  const D = z.design;
  const wide = D.w / D.h > 1.8;
  const els: DesignElement[] = [];
  const m = Math.min(D.w, D.h);
  const titleColor = style.ink;
  const bodyColor = style.ink;

  if (style.border) els.push({ id: newId("m"), type: "motif", name: "border", motif: style.border, ...D, color: style.accent, color2: style.accent2 });
  const inner = inset(D, style.border ? m * 0.12 : m * 0.04);
  const layout: Layout = fields.photo && style.layout !== "side" ? "side" : style.layout;

  if (layout === "stack") {
    let tb = inner;
    if (wide && style.sideMotif) {
      const s = Math.min(inner.h * 0.9, inner.w * 0.2);
      const y = inner.y + (inner.h - s) / 2;
      els.push({ id: newId("m"), type: "motif", name: "left motif", motif: style.sideMotif, x: inner.x, y, w: s, h: s, color: style.accent, color2: style.accent2 });
      els.push({ id: newId("m"), type: "motif", name: "right motif", motif: style.sideMotif, x: inner.x + inner.w - s, y, w: s, h: s, color: style.accent, color2: style.accent2 });
      tb = { x: inner.x + s * 1.1, y: inner.y, w: inner.w - s * 2.2, h: inner.h };
    } else if (style.sideMotif || style.motif) {
      const mh = inner.h * 0.2;
      els.push({ id: newId("m"), type: "motif", name: "top motif", motif: (style.sideMotif ?? style.motif)!, x: inner.x + inner.w * 0.2, y: inner.y, w: inner.w * 0.6, h: mh, color: style.accent, color2: style.accent2 });
      tb = { x: inner.x, y: inner.y + mh * 1.1, w: inner.w, h: inner.h - mh * 1.1 };
    }
    els.push(...textStack(tb, fields, style, "center", titleColor, bodyColor));
  } else if (layout === "side") {
    if (wide) {
      const s = Math.min(inner.h, inner.w * 0.36);
      const y = inner.y + (inner.h - s) / 2;
      const art = { x: inner.x, y, w: s, h: s };
      if (fields.photo) els.push(...photoEl(art, fields.photo, style.accent));
      else if (style.motif) els.push({ id: newId("m"), type: "motif", name: "art", motif: style.motif, ...art, color: style.accent, color2: style.accent2 });
      els.push(...textStack({ x: inner.x + s + m * 0.08, y: inner.y, w: inner.w - s - m * 0.08, h: inner.h }, fields, style, "left", titleColor, bodyColor));
    } else {
      const s = Math.min(inner.w * 0.5, inner.h * 0.4);
      const art = { x: inner.x + (inner.w - s) / 2, y: inner.y, w: s, h: s };
      if (fields.photo) els.push(...photoEl(art, fields.photo, style.accent));
      else if (style.motif) els.push({ id: newId("m"), type: "motif", name: "art", motif: style.motif, ...art, color: style.accent, color2: style.accent2 });
      els.push(...textStack({ x: inner.x, y: inner.y + s * 1.08, w: inner.w, h: inner.h - s * 1.08 }, fields, style, "center", titleColor, bodyColor));
    }
  } else if (layout === "band") {
    if (style.motif) {
      const mb = wide ? { x: D.x, y: D.y, w: D.w, h: D.h * 0.24 } : { x: D.x, y: D.y, w: D.w, h: D.h * 0.16 };
      els.push({ id: newId("m"), type: "motif", name: "top motif", motif: style.motif, ...mb, color: style.accent, color2: style.accent2 });
    }
    const bandY = D.y + D.h * (wide ? 0.3 : 0.32);
    const bandH = D.h * (wide ? 0.4 : 0.3);
    els.push({ id: newId("s"), type: "shape", name: "band", shape: "rect", x: D.x, y: bandY, w: D.w, h: bandH, fill: style.accent, stroke: null, radiusMm: Math.min(2, bandH * 0.12) });
    const bandInk = inkOn(style.accent, style.ink);
    els.push(text("title", inset({ x: D.x, y: bandY, w: D.w, h: bandH }, bandH * 0.08), fields.title, style.titleFont, style.titleWeight, 60, bandInk, "center"));
    const below = { x: inner.x, y: bandY + bandH + D.h * 0.04, w: inner.w, h: D.y + D.h - (bandY + bandH + D.h * 0.04) - inner.h * 0.02 };
    const sub = [fields.subtitle, fields.date].filter(Boolean).join("  ·  ");
    if (sub) els.push(text("subtitle", { ...below, h: below.h * (fields.message ? 0.55 : 1) }, sub, style.bodyFont, 600, 18, bodyColor));
    if (fields.message) els.push(text("message", { ...below, y: below.y + below.h * 0.58, h: below.h * 0.42 }, fields.message, style.bodyFont, 400, 12, bodyColor));
  } else {
    // monogram
    const s = wide ? Math.min(inner.h, inner.w * 0.32) : Math.min(inner.w * 0.5, inner.h * 0.42);
    const circ = wide ? { x: inner.x, y: inner.y + (inner.h - s) / 2, w: s, h: s } : { x: inner.x + (inner.w - s) / 2, y: inner.y, w: s, h: s };
    els.push({ id: newId("s"), type: "shape", name: "monogram circle", shape: "ellipse", ...circ, fill: style.accent, stroke: style.accent2, strokeMm: Math.max(0.3, s * 0.03) });
    els.push(text("monogram", inset(circ, s * 0.2), initials(fields.title) || "&", style.titleFont, style.titleWeight, 60, inkOn(style.accent, style.ink)));
    const rest = wide
      ? { x: inner.x + s + m * 0.08, y: inner.y, w: inner.w - s - m * 0.08 - (style.sideMotif ? s * 0.6 : 0), h: inner.h }
      : { x: inner.x, y: inner.y + s * 1.08, w: inner.w, h: inner.h - s * 1.08 };
    if (wide && style.sideMotif)
      els.push({ id: newId("m"), type: "motif", name: "side motif", motif: style.sideMotif, x: inner.x + inner.w - s * 0.55, y: inner.y + (inner.h - s * 0.55) / 2, w: s * 0.55, h: s * 0.55, color: style.accent, color2: style.accent2 });
    els.push(...textStack(rest, fields, style, wide ? "left" : "center", titleColor, bodyColor));
  }

  return {
    v: 1,
    labelSizeId: size.id,
    segment,
    templateId,
    background: style.bg2 ? { color: style.bg, color2: style.bg2, gradient: "linear", angle: 90 } : { color: style.bg },
    elements: els,
  };
}

export function buildTemplate(def: TemplateDef, styleIndex: number, fields: TemplateFields, size: LabelSize, segment: Segment): Design {
  return { ...buildFromStyle(def.styles[styleIndex % 4], fields, size, segment, def.id), name: def.en };
}
