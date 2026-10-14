import type { LabelSize, Segment } from "@/lib/catalog/types";
import { cssFontFamily } from "./fonts";
import { renderMotif } from "./motifs";
import { layoutRegPanel, type TextRun } from "./regpanel";
import { layoutText, type Measure } from "./text-layout";
import type { Design, DesignElement, RegPanelData, TextElement } from "./types";
import { BLEED_MM, computeZones, type LabelZones } from "./zones";

export interface RenderContext {
  size: LabelSize;
  segment: Segment;
  /** Regulatory panel values; null hides the panel contents (still reserved). */
  reg: RegPanelData | null;
  /** Booked advertisement creative for the ad strip (Shop labels), or null for the placeholder. */
  adHref: string | null;
  measure: Measure;
  minTextPt: number;
  /** Turns an element's `src` into something an <image href> can load. */
  resolveImage: (src: string) => string | null;
  /** Print mode: convert text to vector outlines (server). Returns an SVG path "d". */
  outline?: (run: TextRun) => string;
  /** Show bleed / safe / zone guides (designer screen only). */
  guides?: boolean;
  lang?: "en" | "ta";
  /** Id prefix so several labels can live on one page without clashing clip-path ids. */
  idPrefix?: string;
}

const f = (n: number) => (Math.round(n * 1000) / 1000).toString();

export function escapeXml(s: string): string {
  return s.replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function textRun(run: TextRun, ctx: RenderContext): string {
  if (ctx.outline) {
    const d = ctx.outline(run);
    return d ? `<path d="${d}" fill="${run.color}"/>` : "";
  }
  const ls = run.letterSpacing ? ` letter-spacing="${f(run.letterSpacing * run.sizeMm)}"` : "";
  const it = run.italic ? ` font-style="italic"` : "";
  return `<text x="${f(run.x)}" y="${f(run.y)}" font-family="${escapeXml(cssFontFamily(run.font))}" font-weight="${run.weight}" font-size="${f(run.sizeMm)}" fill="${run.color}" text-anchor="${run.anchor}"${ls}${it} xml:space="preserve">${escapeXml(run.text)}</text>`;
}

/** Positioned lines of a text element (shared by the renderer and the checks). */
export function textRuns(el: TextElement, measure: Measure, minPt: number): { runs: TextRun[]; sizePt: number; overflow: boolean } {
  const lay = layoutText(el, measure, minPt);
  const anchor = el.align === "left" ? "start" : el.align === "right" ? "end" : "middle";
  const x = el.align === "left" ? el.x : el.align === "right" ? el.x + el.w : el.x + el.w / 2;
  const runs = lay.lines.map((line, i) => ({
    text: line,
    font: el.font,
    weight: el.weight,
    sizeMm: lay.sizeMm,
    x,
    // Baseline roughly centred in the line box.
    y: lay.top + i * lay.lineHeightMm + lay.lineHeightMm / 2 + lay.sizeMm * 0.35,
    anchor: anchor as TextRun["anchor"],
    color: el.color,
    letterSpacing: el.letterSpacing,
    italic: el.italic,
  }));
  return { runs, sizePt: lay.sizePt, overflow: lay.overflow };
}

function element(el: DesignElement, ctx: RenderContext, uid: string): string {
  let body = "";
  switch (el.type) {
    case "text":
      body = textRuns(el, ctx.measure, ctx.minTextPt).runs.map((r) => textRun(r, ctx)).join("");
      break;
    case "image": {
      const href = ctx.resolveImage(el.src);
      if (!href) {
        body = `<rect x="${f(el.x)}" y="${f(el.y)}" width="${f(el.w)}" height="${f(el.h)}" fill="#DDD6CA"/>`;
        break;
      }
      const clipId = `${uid}-clip`;
      const clip = el.circle
        ? `<ellipse cx="${f(el.x + el.w / 2)}" cy="${f(el.y + el.h / 2)}" rx="${f(el.w / 2)}" ry="${f(el.h / 2)}"/>`
        : `<rect x="${f(el.x)}" y="${f(el.y)}" width="${f(el.w)}" height="${f(el.h)}" rx="${f(el.radiusMm ?? 0)}"/>`;
      const par = el.fit === "cover" ? "xMidYMid slice" : "xMidYMid meet";
      body = `<clipPath id="${clipId}">${clip}</clipPath><image href="${escapeXml(href)}" x="${f(el.x)}" y="${f(el.y)}" width="${f(el.w)}" height="${f(el.h)}" preserveAspectRatio="${par}" clip-path="url(#${clipId})"/>`;
      break;
    }
    case "shape": {
      const fill = el.fill ?? "none";
      const stroke = el.stroke ? ` stroke="${el.stroke}" stroke-width="${f(el.strokeMm ?? 0.3)}"` : "";
      if (el.shape === "ellipse")
        body = `<ellipse cx="${f(el.x + el.w / 2)}" cy="${f(el.y + el.h / 2)}" rx="${f(el.w / 2)}" ry="${f(el.h / 2)}" fill="${fill}"${stroke}/>`;
      else if (el.shape === "line")
        body = `<line x1="${f(el.x)}" y1="${f(el.y + el.h / 2)}" x2="${f(el.x + el.w)}" y2="${f(el.y + el.h / 2)}" stroke="${el.stroke ?? el.fill ?? "#141A26"}" stroke-width="${f(el.strokeMm ?? Math.max(0.2, el.h))}" stroke-linecap="round"/>`;
      else
        body = `<rect x="${f(el.x)}" y="${f(el.y)}" width="${f(el.w)}" height="${f(el.h)}" rx="${f(el.radiusMm ?? 0)}" fill="${fill}"${stroke}/>`;
      break;
    }
    case "motif":
      body = renderMotif(el.motif, el, el.color, el.color2 ?? el.color, uid);
      break;
  }
  const attrs: string[] = [];
  if (el.rotation) attrs.push(`transform="rotate(${f(el.rotation)} ${f(el.x + el.w / 2)} ${f(el.y + el.h / 2)})"`);
  if (el.opacity !== undefined && el.opacity < 1) attrs.push(`opacity="${f(el.opacity)}"`);
  return `<g data-id="${escapeXml(el.id)}"${attrs.length ? " " + attrs.join(" ") : ""}>${body}</g>`;
}

function background(design: Design, z: LabelZones, p: string): string {
  const bg = design.background;
  const b = z.bleed;
  if (bg.gradient && bg.gradient !== "none" && bg.color2) {
    const id = `${p}bg`;
    const a = ((bg.angle ?? 0) * Math.PI) / 180;
    const grad =
      bg.gradient === "radial"
        ? `<radialGradient id="${id}" cx="50%" cy="50%" r="75%"><stop offset="0" stop-color="${bg.color}"/><stop offset="1" stop-color="${bg.color2}"/></radialGradient>`
        : `<linearGradient id="${id}" x1="${f(50 - Math.cos(a) * 50)}%" y1="${f(50 - Math.sin(a) * 50)}%" x2="${f(50 + Math.cos(a) * 50)}%" y2="${f(50 + Math.sin(a) * 50)}%"><stop offset="0" stop-color="${bg.color}"/><stop offset="1" stop-color="${bg.color2}"/></linearGradient>`;
    return `<defs>${grad}</defs><rect x="${f(b.x)}" y="${f(b.y)}" width="${f(b.w)}" height="${f(b.h)}" fill="url(#${id})"/>`;
  }
  return `<rect x="${f(b.x)}" y="${f(b.y)}" width="${f(b.w)}" height="${f(b.h)}" fill="${bg.color}"/>`;
}

function regPanel(z: LabelZones, ctx: RenderContext): string {
  if (!z.regPanel) return "";
  const r = z.regPanel;
  // White panel guarantees contrast; it runs into the bleed at the top and bottom (and left on flat labels).
  const box = ctx.size.wraps
    ? { x: r.x, y: -BLEED_MM, w: r.w, h: r.h + 2 * BLEED_MM }
    : { x: r.x - BLEED_MM, y: r.y, w: r.w + 2 * BLEED_MM, h: r.h + BLEED_MM };
  let s = `<rect x="${f(box.x)}" y="${f(box.y)}" width="${f(box.w)}" height="${f(box.h)}" fill="#FFFFFF"/>`;
  if (ctx.reg) {
    const lay = layoutRegPanel(r, ctx.reg, ctx.measure, ctx.minTextPt, ctx.size.wraps);
    s += lay.marks + lay.runs.map((run) => textRun(run, ctx)).join("");
  }
  return `<g data-zone="regulatory">${s}</g>`;
}

function adStrip(z: LabelZones, ctx: RenderContext, p: string): string {
  if (!z.adStrip) return "";
  const a = z.adStrip;
  // Wrap labels: strip at the left edge; portrait labels: full-width band below the square.
  const box = ctx.size.wraps ? { x: -BLEED_MM, y: -BLEED_MM, w: a.w + BLEED_MM, h: a.h + 2 * BLEED_MM } : { x: -BLEED_MM, y: a.y, w: a.w + 2 * BLEED_MM, h: a.h };
  if (ctx.adHref) {
    return `<g data-zone="ad"><clipPath id="${p}ad"><rect x="${f(box.x)}" y="${f(box.y)}" width="${f(box.w)}" height="${f(box.h)}"/></clipPath><image href="${escapeXml(ctx.adHref)}" x="${f(box.x)}" y="${f(box.y)}" width="${f(box.w)}" height="${f(box.h)}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${p}ad)"/></g>`;
  }
  const ta = ctx.lang === "ta";
  const cx = a.x + a.w / 2;
  const cy = a.y + a.h / 2;
  const sz = Math.min(a.w / 9, a.h / 5, 3.2);
  const label = ta ? ["உள்ளூர் விளம்பர", "இடம்"] : ["Local ad", "space"];
  const sub = ta ? "hellolabels ஒதுக்கியது" : "reserved by hellolabels";
  const lines = [
    ...label.map((t, i) => ({ text: t, size: sz, weight: 700, y: cy - sz * 0.6 + i * sz * 1.2 })),
    { text: sub, size: sz * 0.62, weight: 400, y: cy + sz * 1.9 },
  ];
  let s = `<rect x="${f(box.x)}" y="${f(box.y)}" width="${f(box.w)}" height="${f(box.h)}" fill="#EFE9DE"/>`;
  s += renderMotif("stripes", { x: box.x, y: box.y, w: box.w, h: box.h }, "#E6DED0", "#EFE9DE", `${p}adst`);
  s += lines
    .map((l) =>
      textRun({ text: l.text, font: ta ? "notosanstamil" : "dmsans", weight: l.weight, sizeMm: l.size, x: cx, y: l.y, anchor: "middle", color: "#545B68" }, ctx),
    )
    .join("");
  return `<g data-zone="ad">${s}</g>`;
}

function guides(z: LabelZones, ctx: RenderContext): string {
  const b = z.bleed;
  const t = z.trim;
  const s = z.safe;
  const ta = ctx.lang === "ta";
  const sw = Math.max(0.15, z.width / 900);
  let g = `<g data-guides="1" pointer-events="none">`;
  // Bleed band (cut away when printed) — tinted.
  g += `<path fill-rule="evenodd" fill="#FF6A4D" fill-opacity="0.16" d="M${f(b.x)} ${f(b.y)}h${f(b.w)}v${f(b.h)}h${f(-b.w)}Z M${f(t.x)} ${f(t.y)}v${f(t.h)}h${f(t.w)}v${f(-t.h)}Z"/>`;
  g += `<rect x="0" y="0" width="${f(t.w)}" height="${f(t.h)}" fill="none" stroke="#141A26" stroke-width="${f(sw)}"/>`;
  g += `<rect x="${f(s.x)}" y="${f(s.y)}" width="${f(s.w)}" height="${f(s.h)}" fill="none" stroke="#1EC8A8" stroke-width="${f(sw)}" stroke-dasharray="${f(sw * 6)} ${f(sw * 4)}"/>`;
  for (const l of z.locked) {
    const c = l.kind === "regulatory" ? "#7B5CF0" : l.kind === "ad" ? "#FFC845" : "#545B68";
    g += `<rect x="${f(l.box.x)}" y="${f(l.box.y)}" width="${f(l.box.w)}" height="${f(l.box.h)}" fill="${l.kind === "overlap" ? "#545B68" : "none"}" fill-opacity="0.18" stroke="${c}" stroke-width="${f(sw * 1.5)}"/>`;
    const name =
      l.kind === "regulatory" ? (ta ? "🔒 சட்டப்படி தகவல்" : "🔒 Regulatory") : l.kind === "ad" ? (ta ? "🔒 விளம்பரம்" : "🔒 Ad space") : ta ? "ஒட்டும் பகுதி" : "Glue overlap";
    const fs = Math.min(2.2, l.box.w / 7);
    g += `<text x="${f(l.box.x + l.box.w / 2)}" y="${f(l.box.y + l.box.h - 0.8)}" font-size="${f(fs)}" font-family="DM Sans, Noto Sans Tamil" text-anchor="middle" fill="${c}" font-weight="700">${escapeXml(name)}</text>`;
  }
  if (ctx.size.wraps) {
    const cx = z.design.x + z.design.w / 2;
    g += `<path d="M${f(cx - 1.2)} ${f(-BLEED_MM)} l1.2 1.4 l1.2 -1.4 Z" fill="#141A26"/>`;
  }
  return g + "</g>";
}

/** Renders a label as SVG in millimetre units (viewBox = trim box grown by the bleed). */
export function renderLabelSvg(design: Design, ctx: RenderContext): string {
  const z = computeZones(ctx.size, ctx.segment);
  const p = ctx.idPrefix ?? "l";
  const b = z.bleed;
  const els = design.elements.map((el, i) => element(el, ctx, `${p}e${i}`)).join("");
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="${f(b.x)} ${f(b.y)} ${f(b.w)} ${f(b.h)}" width="${f(b.w)}mm" height="${f(b.h)}mm">` +
    background(design, z, p) +
    els +
    adStrip(z, ctx, p) +
    regPanel(z, ctx) +
    (ctx.guides ? guides(z, ctx) : "") +
    `</svg>`
  );
}
