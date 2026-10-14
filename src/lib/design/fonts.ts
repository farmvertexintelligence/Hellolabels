/**
 * Fonts customers can use on labels. All are SIL Open Font Licence fonts downloaded by
 * scripts/fetch-fonts.mjs: TTFs in assets/fonts (print renderer), WOFF2 in public/fonts (browser).
 */
export const FONTS = {
  fraunces: { family: "Fraunces", weights: [400, 600, 700], tamil: false, serif: true, label: "Fraunces" },
  dmsans: { family: "DM Sans", weights: [400, 500, 700], tamil: false, serif: false, label: "DM Sans" },
  playfair: { family: "Playfair Display", weights: [400, 700], tamil: false, serif: true, label: "Playfair" },
  cinzel: { family: "Cinzel", weights: [400, 700], tamil: false, serif: true, label: "Cinzel (classic)" },
  greatvibes: { family: "Great Vibes", weights: [400], tamil: false, serif: true, label: "Great Vibes (script)" },
  poppins: { family: "Poppins", weights: [400, 600, 800], tamil: false, serif: false, label: "Poppins" },
  oswald: { family: "Oswald", weights: [500, 700], tamil: false, serif: false, label: "Oswald (tall)" },
  notosanstamil: { family: "Noto Sans Tamil", weights: [400, 600, 700], tamil: true, serif: false, label: "Noto Sans Tamil" },
  notoseriftamil: { family: "Noto Serif Tamil", weights: [400, 700], tamil: true, serif: true, label: "Noto Serif Tamil" },
  arima: { family: "Arima", weights: [400, 700], tamil: true, serif: false, label: "Arima (தமிழ்)" },
  baloothambi: { family: "Baloo Thambi 2", weights: [500, 800], tamil: true, serif: false, label: "Baloo Thambi (தமிழ்)" },
  muktamalar: { family: "Mukta Malar", weights: [400, 700], tamil: true, serif: false, label: "Mukta Malar (தமிழ்)" },
} as const;

export type FontId = keyof typeof FONTS;
export const FONT_IDS = Object.keys(FONTS) as FontId[];

export const isFontId = (v: unknown): v is FontId => typeof v === "string" && v in FONTS;

/** The closest available weight of a font. */
export function nearestWeight(font: FontId, weight: number): number {
  const ws = FONTS[font].weights as readonly number[];
  return ws.reduce((best, w) => (Math.abs(w - weight) < Math.abs(best - weight) ? w : best), ws[0]);
}

/** Font used for Tamil characters when the chosen font has no Tamil glyphs. */
export function tamilFallback(font: FontId): FontId {
  return FONTS[font].tamil ? font : FONTS[font].serif ? "notoseriftamil" : "notosanstamil";
}

/** CSS font-family list for the browser preview (with the same Tamil fallback the printer uses). */
export function cssFontFamily(font: FontId): string {
  const f = FONTS[font];
  const fb = FONTS[tamilFallback(font)].family;
  return f.family === fb ? `'${f.family}'` : `'${f.family}', '${fb}'`;
}

/** File name of the TTF for a font/weight in assets/fonts. */
export function fontFile(font: FontId, weight: number): string {
  const f = FONTS[font];
  return `${f.family.toLowerCase().replace(/\s+/g, "-")}-${nearestWeight(font, weight)}.ttf`;
}

export const PT_TO_MM = 25.4 / 72;
export const ptToMm = (pt: number) => pt * PT_TO_MM;
export const mmToPt = (mm: number) => mm / PT_TO_MM;

const TAMIL = /[஀-௿]/;
export const hasTamil = (s: string) => TAMIL.test(s);

/** Split text into runs of Tamil / non-Tamil characters (spaces join the preceding run). */
export function scriptRuns(text: string): { text: string; tamil: boolean }[] {
  const runs: { text: string; tamil: boolean }[] = [];
  for (const ch of text) {
    const t = TAMIL.test(ch);
    const last = runs[runs.length - 1];
    if (last && (last.tamil === t || /\s/.test(ch))) last.text += ch;
    else runs.push({ text: ch, tamil: t });
  }
  return runs;
}
