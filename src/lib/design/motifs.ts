import type { Box } from "./types";

/**
 * Vector ornaments the designer and the AI can place. Each one is drawn from code so it is sharp at
 * any print size and needs no image files. Borders fill their box as a frame; the others are drawn
 * inside their box (keeping their proportions where shape matters).
 */
export const MOTIFS = {
  "border-double": { en: "Double line border", ta: "இரட்டைக் கோடு ஓரம்", border: true },
  "border-dots": { en: "Dotted border", ta: "புள்ளி ஓரம்", border: true },
  "border-floral": { en: "Floral border", ta: "பூ ஓரம்", border: true },
  "border-kolam": { en: "Kolam border", ta: "கோலம் ஓரம்", border: true },
  "border-temple": { en: "Temple border", ta: "கோயில் ஓரம்", border: true },
  thoranam: { en: "Mango leaf thoranam", ta: "மாவிலை தோரணம்", border: false },
  marigold: { en: "Marigold string", ta: "சாமந்தி மாலை", border: false },
  rings: { en: "Wedding rings", ta: "மோதிரங்கள்", border: false },
  hearts: { en: "Hearts", ta: "இதயங்கள்", border: false },
  balloons: { en: "Balloons", ta: "பலூன்கள்", border: false },
  confetti: { en: "Confetti", ta: "வண்ணத் துகள்கள்", border: false },
  stars: { en: "Sparkles", ta: "நட்சத்திரங்கள்", border: false },
  "pongal-pot": { en: "Pongal pot", ta: "பொங்கல் பானை", border: false },
  diya: { en: "Diya lamp", ta: "அகல் விளக்கு", border: false },
  sun: { en: "Rising sun", ta: "சூரியன்", border: false },
  kolam: { en: "Kolam", ta: "கோலம்", border: false },
  gopuram: { en: "Temple tower", ta: "கோபுரம்", border: false },
  house: { en: "House", ta: "வீடு", border: false },
  leaves: { en: "Leaf sprig", ta: "இலைகள்", border: false },
  waves: { en: "Water waves", ta: "நீர் அலைகள்", border: false },
  drop: { en: "Water drop", ta: "நீர்த் துளி", border: false },
  stripes: { en: "Diagonal stripes", ta: "சாய்வுக் கோடுகள்", border: false },
} as const;

export type MotifId = keyof typeof MOTIFS;
export const MOTIF_IDS = Object.keys(MOTIFS) as MotifId[];
export const isMotifId = (v: unknown): v is MotifId => typeof v === "string" && v in MOTIFS;

const f = (n: number) => (Math.round(n * 100) / 100).toString();

function rng(seedText: string) {
  let h = 1779033703;
  for (let i = 0; i < seedText.length; i++) h = Math.imul(h ^ seedText.charCodeAt(i), 3432918353);
  let a = h >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Draw a shape designed in a 100×100 square, scaled uniformly and centred in the box. */
function fitted(b: Box, inner: string): string {
  const s = Math.min(b.w, b.h) / 100;
  const tx = b.x + (b.w - 100 * s) / 2;
  const ty = b.y + (b.h - 100 * s) / 2;
  return `<g transform="translate(${f(tx)} ${f(ty)}) scale(${f(s)})">${inner}</g>`;
}

function flower(cx: number, cy: number, r: number, c1: string, c2: string): string {
  let s = "";
  for (let i = 0; i < 5; i++) {
    const a = (i * 72 * Math.PI) / 180;
    s += `<ellipse cx="${f(cx + Math.cos(a) * r * 0.55)}" cy="${f(cy + Math.sin(a) * r * 0.55)}" rx="${f(r * 0.48)}" ry="${f(r * 0.3)}" transform="rotate(${f(i * 72)} ${f(cx + Math.cos(a) * r * 0.55)} ${f(cy + Math.sin(a) * r * 0.55)})" fill="${c1}"/>`;
  }
  return s + `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r * 0.25)}" fill="${c2}"/>`;
}

function leafPath(x: number, y: number, len: number, angleDeg: number, color: string): string {
  const w = len * 0.38;
  return `<path transform="translate(${f(x)} ${f(y)}) rotate(${f(angleDeg)})" d="M0 0 C ${f(w)} ${f(len * 0.3)} ${f(w * 0.6)} ${f(len * 0.8)} 0 ${f(len)} C ${f(-w * 0.6)} ${f(len * 0.8)} ${f(-w)} ${f(len * 0.3)} 0 0 Z" fill="${color}"/>`;
}

export function renderMotif(id: MotifId, b: Box, c1: string, c2: string, seed: string): string {
  const { x, y, w, h } = b;
  const m = Math.min(w, h);
  switch (id) {
    case "border-double": {
      const sw = Math.max(0.3, m * 0.012);
      const i = sw * 3;
      return `<rect x="${f(x + sw / 2)}" y="${f(y + sw / 2)}" width="${f(w - sw)}" height="${f(h - sw)}" rx="${f(m * 0.04)}" fill="none" stroke="${c1}" stroke-width="${f(sw)}"/>
<rect x="${f(x + i)}" y="${f(y + i)}" width="${f(w - 2 * i)}" height="${f(h - 2 * i)}" rx="${f(m * 0.03)}" fill="none" stroke="${c2}" stroke-width="${f(sw * 0.5)}"/>`;
    }
    case "border-dots": {
      const r = Math.max(0.35, m * 0.012);
      const gap = r * 5;
      let s = "";
      const nx = Math.max(2, Math.floor((w - 2 * r) / gap));
      const ny = Math.max(2, Math.floor((h - 2 * r) / gap));
      for (let i = 0; i <= nx; i++) {
        const px = x + r + ((w - 2 * r) * i) / nx;
        s += `<circle cx="${f(px)}" cy="${f(y + r)}" r="${f(r)}" fill="${i % 2 ? c2 : c1}"/><circle cx="${f(px)}" cy="${f(y + h - r)}" r="${f(r)}" fill="${i % 2 ? c2 : c1}"/>`;
      }
      for (let j = 1; j < ny; j++) {
        const py = y + r + ((h - 2 * r) * j) / ny;
        s += `<circle cx="${f(x + r)}" cy="${f(py)}" r="${f(r)}" fill="${j % 2 ? c2 : c1}"/><circle cx="${f(x + w - r)}" cy="${f(py)}" r="${f(r)}" fill="${j % 2 ? c2 : c1}"/>`;
      }
      return s;
    }
    case "border-floral": {
      const sw = Math.max(0.25, m * 0.008);
      const r = m * 0.09;
      const inset = r * 0.9;
      let s = `<rect x="${f(x + inset)}" y="${f(y + inset)}" width="${f(w - 2 * inset)}" height="${f(h - 2 * inset)}" fill="none" stroke="${c1}" stroke-width="${f(sw)}"/>`;
      for (const [cx, cy, a] of [
        [x + inset, y + inset, 45],
        [x + w - inset, y + inset, 135],
        [x + w - inset, y + h - inset, 225],
        [x + inset, y + h - inset, 315],
      ] as const) {
        s += leafPath(cx, cy, r * 1.6, a - 90 + 35, c2) + leafPath(cx, cy, r * 1.6, a - 90 - 35, c2);
        s += flower(cx, cy, r, c1, c2);
      }
      return s;
    }
    case "border-kolam": {
      const d = Math.max(1.2, m * 0.05);
      const sw = Math.max(0.2, d * 0.12);
      let s = "";
      const put = (cx: number, cy: number, k: number) =>
        `<path d="M${f(cx)} ${f(cy - d / 2)} L${f(cx + d / 2)} ${f(cy)} L${f(cx)} ${f(cy + d / 2)} L${f(cx - d / 2)} ${f(cy)} Z" fill="none" stroke="${k % 2 ? c2 : c1}" stroke-width="${f(sw)}"/><circle cx="${f(cx)}" cy="${f(cy)}" r="${f(sw * 1.3)}" fill="${c1}"/>`;
      const nx = Math.max(2, Math.floor(w / (d * 1.4)));
      const ny = Math.max(2, Math.floor(h / (d * 1.4)));
      for (let i = 0; i < nx; i++) {
        const cx = x + d / 2 + ((w - d) * i) / (nx - 1);
        s += put(cx, y + d / 2, i) + put(cx, y + h - d / 2, i + 1);
      }
      for (let j = 1; j < ny - 1; j++) {
        const cy = y + d / 2 + ((h - d) * j) / (ny - 1);
        s += put(x + d / 2, cy, j) + put(x + w - d / 2, cy, j + 1);
      }
      return s;
    }
    case "border-temple": {
      const t = Math.max(1.5, m * 0.07);
      const n = Math.max(3, Math.round(w / (t * 1.2)));
      const step = w / n;
      let top = `M${f(x)} ${f(y)} `;
      let bottom = `M${f(x)} ${f(y + h)} `;
      for (let i = 0; i < n; i++) {
        const x0 = x + i * step;
        top += `L${f(x0)} ${f(y + t * 0.35)} L${f(x0 + step * 0.25)} ${f(y + t * 0.35)} L${f(x0 + step * 0.25)} ${f(y + t * 0.7)} L${f(x0 + step * 0.5)} ${f(y + t)} L${f(x0 + step * 0.75)} ${f(y + t * 0.7)} L${f(x0 + step * 0.75)} ${f(y + t * 0.35)} L${f(x0 + step)} ${f(y + t * 0.35)} `;
        bottom += `L${f(x0)} ${f(y + h - t * 0.35)} L${f(x0 + step * 0.25)} ${f(y + h - t * 0.35)} L${f(x0 + step * 0.25)} ${f(y + h - t * 0.7)} L${f(x0 + step * 0.5)} ${f(y + h - t)} L${f(x0 + step * 0.75)} ${f(y + h - t * 0.7)} L${f(x0 + step * 0.75)} ${f(y + h - t * 0.35)} L${f(x0 + step)} ${f(y + h - t * 0.35)} `;
      }
      top += `L${f(x + w)} ${f(y)} Z`;
      bottom += `L${f(x + w)} ${f(y + h)} Z`;
      return `<path d="${top}" fill="${c1}"/><path d="${bottom}" fill="${c1}"/><line x1="${f(x)}" y1="${f(y + t * 1.25)}" x2="${f(x + w)}" y2="${f(y + t * 1.25)}" stroke="${c2}" stroke-width="${f(t * 0.12)}"/><line x1="${f(x)}" y1="${f(y + h - t * 1.25)}" x2="${f(x + w)}" y2="${f(y + h - t * 1.25)}" stroke="${c2}" stroke-width="${f(t * 0.12)}"/>`;
    }
    case "thoranam":
    case "marigold": {
      const sag = h * 0.25;
      const sw = Math.max(0.2, h * 0.03);
      let s = `<path d="M${f(x)} ${f(y + sw)} Q ${f(x + w / 2)} ${f(y + sag)} ${f(x + w)} ${f(y + sw)}" fill="none" stroke="${c2}" stroke-width="${f(sw)}"/>`;
      const leafLen = h * 0.7;
      const n = Math.max(3, Math.round(w / (leafLen * 0.55)));
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        const px = x + w * t;
        const py = y + sw + 2 * (1 - t) * t * (sag - sw) * 1.0;
        if (id === "thoranam") s += leafPath(px, py, leafLen * (i % 2 ? 0.8 : 1), 0, c1);
        if (i % 2 === 0 || id === "marigold") s += `<circle cx="${f(px)}" cy="${f(py + (id === "marigold" ? leafLen * 0.25 : 0))}" r="${f(h * (id === "marigold" ? 0.18 : 0.1))}" fill="${id === "marigold" ? (i % 2 ? c1 : c2) : c2}"/>`;
      }
      return s;
    }
    case "rings":
      return fitted(
        b,
        `<circle cx="38" cy="55" r="24" fill="none" stroke="${c1}" stroke-width="5"/><circle cx="62" cy="55" r="24" fill="none" stroke="${c2}" stroke-width="5"/><path d="M38 31 l-6 -10 h12 z" fill="${c2}"/>`,
      );
    case "hearts": {
      const r = rng(seed);
      let s = "";
      const n = Math.max(3, Math.round((w * h) / (m * m) * 3));
      for (let i = 0; i < n; i++) {
        const sz = m * (0.18 + r() * 0.2);
        const cx = x + sz / 2 + r() * (w - sz);
        const cy = y + sz / 2 + r() * (h - sz);
        s += `<path transform="translate(${f(cx)} ${f(cy)}) scale(${f(sz / 100)})" d="M0 30 C -50 -10 -25 -45 0 -20 C 25 -45 50 -10 0 30 Z" fill="${i % 2 ? c2 : c1}"/>`;
      }
      return s;
    }
    case "balloons":
      return fitted(
        b,
        [
          [30, 30, c1],
          [55, 22, c2],
          [75, 36, c1],
        ]
          .map(
            ([cx, cy, c]) =>
              `<path d="M${cx} ${Number(cy) + 20} q -4 18 3 34 t -2 30" fill="none" stroke="${c2}" stroke-width="1"/><ellipse cx="${cx}" cy="${cy}" rx="14" ry="18" fill="${c}"/><ellipse cx="${Number(cx) - 5}" cy="${Number(cy) - 7}" rx="3" ry="5" fill="#ffffff" opacity="0.5"/>`,
          )
          .join(""),
      );
    case "confetti":
    case "stars": {
      const r = rng(seed);
      let s = "";
      const n = Math.max(6, Math.round((w * h) / (m * m) * 10));
      for (let i = 0; i < n; i++) {
        const cx = x + r() * w;
        const cy = y + r() * h;
        const sz = m * (0.04 + r() * 0.06);
        const c = i % 2 ? c2 : c1;
        if (id === "stars")
          s += `<path transform="translate(${f(cx)} ${f(cy)}) scale(${f(sz / 10)})" d="M0 -10 L2 -2 L10 0 L2 2 L0 10 L-2 2 L-10 0 L-2 -2 Z" fill="${c}"/>`;
        else if (i % 3 === 0) s += `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(sz / 2)}" fill="${c}"/>`;
        else
          s += `<rect x="${f(cx)}" y="${f(cy)}" width="${f(sz)}" height="${f(sz * 0.45)}" transform="rotate(${f(r() * 180)} ${f(cx)} ${f(cy)})" fill="${c}"/>`;
      }
      return s;
    }
    case "pongal-pot":
      return fitted(
        b,
        `<path d="M18 98 L22 6 l3 0 L22 98 Z" fill="${c2}"/><path d="M82 98 L78 6 l-3 0 L78 98 Z" fill="${c2}"/>
<path d="M14 6 q6 -6 12 4" fill="none" stroke="${c2}" stroke-width="2"/><path d="M86 6 q-6 -6 -12 4" fill="none" stroke="${c2}" stroke-width="2"/>
<ellipse cx="50" cy="40" rx="20" ry="9" fill="#ffffff" stroke="${c1}" stroke-width="1.5"/><circle cx="40" cy="34" r="5" fill="#ffffff" stroke="${c1}"/><circle cx="52" cy="30" r="6" fill="#ffffff" stroke="${c1}"/><circle cx="62" cy="35" r="4" fill="#ffffff" stroke="${c1}"/>
<path d="M30 44 h40 q14 18 4 40 q-6 12 -24 12 q-18 0 -24 -12 q-10 -22 4 -40 Z" fill="${c1}"/>
<path d="M27 56 q23 8 46 0" fill="none" stroke="${c2}" stroke-width="3"/><path d="M30 66 l6 -5 6 5 6 -5 6 5 6 -5 6 5 6 -5" fill="none" stroke="#ffffff" stroke-width="1.5"/>`,
      );
    case "diya":
      return fitted(
        b,
        `<path d="M50 8 C 62 26 60 40 50 46 C 40 40 38 26 50 8 Z" fill="${c2}"/><path d="M50 22 C 55 31 54 38 50 41 C 46 38 45 31 50 22 Z" fill="#ffffff" opacity="0.7"/>
<path d="M10 56 h80 q-6 30 -40 34 q-34 -4 -40 -34 Z" fill="${c1}"/><path d="M18 64 q32 16 64 0" fill="none" stroke="${c2}" stroke-width="2.5"/><ellipse cx="50" cy="56" rx="40" ry="5" fill="${c1}" stroke="${c2}" stroke-width="1.5"/>`,
      );
    case "sun": {
      let rays = "";
      for (let i = 0; i < 12; i++) {
        const a = (Math.PI * i) / 11;
        rays += `<line x1="${f(50 - Math.cos(a) * 28)}" y1="${f(80 - Math.sin(a) * 28)}" x2="${f(50 - Math.cos(a) * 46)}" y2="${f(80 - Math.sin(a) * 46)}" stroke="${c2}" stroke-width="3" stroke-linecap="round"/>`;
      }
      return fitted(b, `${rays}<path d="M26 80 a24 24 0 0 1 48 0 Z" fill="${c1}"/><line x1="4" y1="82" x2="96" y2="82" stroke="${c2}" stroke-width="2.5"/>`);
    }
    case "kolam": {
      let s = "";
      for (let i = 0; i < 5; i++)
        for (let j = 0; j < 5; j++) {
          if (Math.abs(i - 2) + Math.abs(j - 2) > 2) continue;
          const cx = 18 + i * 16;
          const cy = 18 + j * 16;
          s += `<circle cx="${cx}" cy="${cy}" r="2.2" fill="${c2}"/><path d="M${cx} ${cy - 8} L${cx + 8} ${cy} L${cx} ${cy + 8} L${cx - 8} ${cy} Z" fill="none" stroke="${c1}" stroke-width="1.6" stroke-linejoin="round"/>`;
        }
      return fitted(b, s + `<circle cx="50" cy="50" r="40" fill="none" stroke="${c1}" stroke-width="1.6" stroke-dasharray="3 3"/>`);
    }
    case "gopuram":
      return fitted(
        b,
        `<path d="M20 98 V84 H80 V98 Z M25 84 V70 H75 V84 Z M30 70 V56 H70 V70 Z M35 56 V42 H65 V56 Z M40 42 V30 H60 V42 Z" fill="${c1}"/>
<path d="M38 30 Q50 14 62 30 Z" fill="${c1}"/><path d="M50 4 l3 10 h-6 Z" fill="${c2}"/><circle cx="50" cy="16" r="2.5" fill="${c2}"/>
<path d="M44 98 V88 q6 -7 12 0 V98 Z" fill="${c2}"/>
<path d="M25 77 h50 M30 63 h40 M35 49 h30 M40 36 h20" stroke="${c2}" stroke-width="1.2"/>`,
      );
    case "house":
      return fitted(
        b,
        `<path d="M14 50 L50 18 L86 50" fill="none" stroke="${c1}" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"/>
<path d="M24 46 V92 H76 V46" fill="none" stroke="${c1}" stroke-width="4"/><path d="M43 92 V66 h14 V92" fill="${c2}"/>
<rect x="30" y="56" width="9" height="9" fill="${c2}"/><rect x="61" y="56" width="9" height="9" fill="${c2}"/>
<path d="M50 4 c4 5 4 9 0 12 c-4 -3 -4 -7 0 -12 Z" fill="${c2}"/>`,
      );
    case "leaves": {
      let s = `<path d="M5 95 Q 50 60 95 5" fill="none" stroke="${c1}" stroke-width="2"/>`;
      for (let i = 1; i < 6; i++) {
        const t = i / 6;
        const px = 5 + 90 * t;
        const py = 95 - 90 * t + Math.sin(t * Math.PI) * -12;
        s += leafPath(px, py, 20, 200, i % 2 ? c1 : c2) + leafPath(px, py, 20, 70, i % 2 ? c2 : c1);
      }
      return fitted(b, s);
    }
    case "waves": {
      let s = "";
      for (let k = 0; k < 3; k++) {
        const yy = y + (h * (k + 1)) / 4;
        const amp = h * 0.08;
        const n = Math.max(2, Math.round(w / (h * 0.8)));
        let d = `M${f(x)} ${f(yy)}`;
        for (let i = 0; i < n; i++) {
          const x0 = x + (w * i) / n;
          const x1 = x + (w * (i + 1)) / n;
          d += ` Q ${f((x0 + x1) / 2)} ${f(yy + (i % 2 ? amp : -amp) * 2)} ${f(x1)} ${f(yy)}`;
        }
        s += `<path d="${d}" fill="none" stroke="${k === 1 ? c2 : c1}" stroke-width="${f(Math.max(0.3, h * 0.04))}" stroke-linecap="round" opacity="${k === 1 ? 1 : 0.7}"/>`;
      }
      return s;
    }
    case "drop":
      return fitted(
        b,
        `<path d="M50 4 C 70 34 82 50 82 66 A 32 32 0 0 1 18 66 C 18 50 30 34 50 4 Z" fill="${c1}"/><path d="M34 66 a16 16 0 0 0 16 16" fill="none" stroke="${c2}" stroke-width="5" stroke-linecap="round"/>`,
      );
    case "stripes": {
      const gap = Math.max(1.5, m * 0.12);
      let s = `<clipPath id="cp-${seed}"><rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}"/></clipPath><g clip-path="url(#cp-${seed})">`;
      for (let i = -Math.ceil(h / gap); i < w / gap + 1; i++) {
        const x0 = x + i * gap;
        s += `<line x1="${f(x0)}" y1="${f(y + h)}" x2="${f(x0 + h)}" y2="${f(y)}" stroke="${i % 2 ? c2 : c1}" stroke-width="${f(gap * 0.3)}"/>`;
      }
      return s + "</g>";
    }
  }
}
