import type { LabelSize, Segment } from "@/lib/catalog/types";
import { normalizeHex, readableOn } from "./color";
import { TEMPLATES, buildFromStyle, type Style, type TemplateDef, type TemplateFields } from "./templates";
import type { Design } from "./types";

/** Colour words customers use (English and Tamil) → hex. */
const COLOR_WORDS: [RegExp, string][] = [
  [/maroon|மெரூன்/i, "#6B1420"],
  [/\bred\b|சிவப்பு|சிகப்பு/i, "#B3201B"],
  [/gold|golden|தங்க/i, "#D4A437"],
  [/silver|வெள்ளி நிற/i, "#B8BEC6"],
  [/\bblue\b|நீல/i, "#1E4DB7"],
  [/navy/i, "#14264F"],
  [/green|பச்சை/i, "#2E7D32"],
  [/teal/i, "#1EC8A8"],
  [/pink|இளஞ்சிவப்பு/i, "#E05A8A"],
  [/purple|violet|ஊதா/i, "#6A3FC9"],
  [/yellow|மஞ்சள்/i, "#FFC845"],
  [/orange|ஆரஞ்சு|saffron|காவி/i, "#E8590C"],
  [/\bblack\b|கருப்பு/i, "#141A26"],
  [/white|cream|ivory|வெள்ளை/i, "#FBF6EA"],
];

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
  ஜனவரி: 1, பிப்ரவரி: 2, மார்ச்: 3, ஏப்ரல்: 4, மே: 5, ஜூன்: 6, ஜூலை: 7, ஆகஸ்ட்: 8, செப்டம்பர்: 9, அக்டோபர்: 10, நவம்பர்: 11, டிசம்பர்: 12,
};
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export interface ParsedBrief {
  template: TemplateDef;
  fields: TemplateFields;
  colors: string[];
}

export function detectTemplate(brief: string, segment: Segment): TemplateDef {
  const b = brief.toLowerCase();
  let best: TemplateDef | null = null;
  let score = 0;
  for (const t of TEMPLATES) {
    const s = t.keywords.reduce((a, k) => a + (b.includes(k.toLowerCase()) ? k.length : 0), 0);
    if (s > score) {
      score = s;
      best = t;
    }
  }
  if (best) return best;
  return TEMPLATES.find((t) => t.id === (segment === "shop" ? "shop" : "wedding"))!;
}

export function parseDate(brief: string): string {
  let m = brief.match(/\b(\d{1,2})(?:st|nd|rd|th)?[\s.\-/]*([A-Za-z]{3,9}|[஀-௿]+)[\s.,\-/]*(\d{4})?/);
  if (m) {
    const mon = MONTHS[m[2].toLowerCase().slice(0, 3)] ?? MONTHS[m[2]];
    if (mon) return `${m[1].padStart(2, "0")} ${MONTH_NAMES[mon - 1]}${m[3] ? " " + m[3] : ""}`;
  }
  m = brief.match(/\b([A-Za-z]{3,9})\s+(\d{1,2})(?:st|nd|rd|th)?,?\s*(\d{4})?/);
  if (m && MONTHS[m[1].toLowerCase().slice(0, 3)]) {
    return `${m[2].padStart(2, "0")} ${MONTH_NAMES[MONTHS[m[1].toLowerCase().slice(0, 3)] - 1]}${m[3] ? " " + m[3] : ""}`;
  }
  m = brief.match(/\b(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})\b/);
  if (m) {
    const mon = Number(m[2]);
    if (mon >= 1 && mon <= 12) return `${m[1].padStart(2, "0")} ${MONTH_NAMES[mon - 1]} ${m[3].length === 2 ? "20" + m[3] : m[3]}`;
  }
  return "";
}

function parseNames(brief: string): string {
  const m =
    brief.match(/(?:of|for)?\s*([A-Z஀-௿][\p{L}\p{M}.]+)\s+(?:and|&|weds|with|மற்றும்|❤)\s+([A-Z஀-௿][\p{L}\p{M}.]+)/u) ??
    null;
  if (m) return `${m[1]} & ${m[2]}`;
  const one = brief.match(/(?:for|of|by)\s+([A-Z][\p{L}.]+(?:\s+[A-Z][\p{L}.]+){0,3})/u);
  return one ? one[1] : "";
}

/** Understands a plain-language brief well enough to fill a template (used when the AI is offline). */
export function parseBrief(brief: string, segment: Segment, lang: "en" | "ta"): ParsedBrief {
  const template = detectTemplate(brief, segment);
  const defaults = template.defaults[lang];
  const colors = COLOR_WORDS.filter(([re]) => re.test(brief)).map(([, c]) => c);
  const names = parseNames(brief);
  const date = parseDate(brief);
  const fields: TemplateFields = { ...defaults };
  if (names) fields.title = template.id === "birthday" && !names.includes("&") ? `${names}` : names;
  if (date) fields.date = date;
  if (template.id === "shop") {
    const shop = brief.match(/([A-Z][\p{L}.]*(?:\s+[A-Z][\p{L}.]*){0,3}\s+(?:Bakery|Hotel|Stores?|Cafe|Café|Restaurant|Mess|Sweets|Traders|Agencies))/u);
    if (shop) fields.title = shop[1];
    const phone = brief.match(/(?:\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}/);
    if (phone) fields.message = phone[0];
  }
  return { template, fields, colors };
}

/** Recolour a style with the customer's colour words (first = background/accent, second = accent). */
function recolor(style: Style, colors: string[], i: number): Style {
  if (!colors.length) return style;
  const c1 = normalizeHex(colors[i % colors.length]);
  const c2 = normalizeHex(colors[(i + 1) % colors.length]);
  if (i % 2 === 0) {
    const ink = readableOn(c1, "#141A26", "#FFF8E7");
    return { ...style, bg: c1, bg2: undefined, ink, accent: colors.length > 1 ? c2 : style.accent, accent2: style.accent2 };
  }
  return { ...style, accent: c1, accent2: colors.length > 1 ? c2 : style.accent2 };
}

/** Four different designs from a brief without calling the AI (also the fallback when the AI fails). */
export function designsFromBrief(brief: string, size: LabelSize, segment: Segment, lang: "en" | "ta", photo?: TemplateFields["photo"]): Design[] {
  const { template, fields, colors } = parseBrief(brief, segment, lang);
  return template.styles.map((style, i) => ({
    ...buildFromStyle(recolor(style, colors, i), { ...fields, photo: i === 0 || i === 2 ? photo : undefined }, size, segment, template.id),
    name: `${template.en} ${i + 1}`,
  }));
}
