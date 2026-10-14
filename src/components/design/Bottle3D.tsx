"use client";
import { useMemo, useRef, useState } from "react";
import type { LabelSize, Product, Segment } from "@/lib/catalog/types";
import { renderLabelSvg } from "@/lib/design/render";
import type { Design, RegPanelData } from "@/lib/design/types";
import { BLEED_MM, computeZones } from "@/lib/design/zones";
import { browserMeasure } from "./browser";

const BOTTLE_HEIGHT_MM: Record<number, number> = { 250: 150, 300: 165, 500: 205, 1000: 270, 2000: 315 };
const SLICES = 48;

interface Props {
  design: Design;
  size: LabelSize;
  segment: Segment;
  product: Product;
  reg: RegPanelData | null;
  minTextPt: number;
  lang: "en" | "ta";
  resolveImage: (src: string) => string | null;
  fontTick?: number;
  hint: string;
}

/**
 * Realistic preview: the label is drawn once as an SVG <symbol> and shown on a CSS-3D cylinder made
 * of thin vertical slices, over a bottle silhouette. Drag sideways to turn the bottle.
 * Light enough for budget phones (one label render, slices are <use> references).
 */
export function Bottle3D(p: Props) {
  const [angle, setAngle] = useState(0);
  const drag = useRef<{ x: number; a: number } | null>(null);
  const uid = "b3d";
  const zones = computeZones(p.size, p.segment);
  const diameter = p.size.diameterMm ?? Math.max(p.size.widthMm, 60);
  const circumference = Math.PI * diameter;
  const glass = p.product.bottleType === "glass";
  const isBottle = p.product.kind === "water_bottle";
  const bottleH = isBottle ? (BOTTLE_HEIGHT_MM[p.product.volumeMl ?? 500] ?? 205) : Math.max(p.size.heightMm * 1.5, 90);

  const symbol = useMemo(() => {
    const svg = renderLabelSvg(p.design, {
      size: p.size,
      segment: p.segment,
      reg: p.reg,
      adHref: null,
      measure: browserMeasure,
      minTextPt: p.minTextPt,
      resolveImage: p.resolveImage,
      lang: p.lang,
      idPrefix: uid,
    });
    const inner = svg.replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "");
    const b = zones.bleed;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0" style="position:absolute"><symbol id="${uid}-label" viewBox="${b.x} ${b.y} ${b.w} ${b.h}">${inner}</symbol></svg>`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.design, p.size, p.segment, p.reg, p.minTextPt, p.resolveImage, p.lang, p.fontTick]);

  // Display scale: at most 200 px wide and 380 px tall so the whole bottle fits a phone screen.
  const pxPerMm = Math.min(200 / diameter, 380 / bottleH);
  const R = (diameter / 2) * pxPerMm;
  const labelH = p.size.heightMm * pxPerMm;
  const wrapW = p.size.wraps ? p.size.widthMm - p.size.overlapMm : p.size.widthMm;
  const frontX = p.size.wraps ? zones.design.x + zones.design.w / 2 : p.size.widthMm / 2;
  const sliceMm = circumference / SLICES;
  const slices: { x: number; a: number }[] = [];
  for (let i = 0; i * sliceMm < wrapW; i++) {
    const x = i * sliceMm;
    slices.push({ x, a: ((x + sliceMm / 2 - frontX) / circumference) * 360 });
  }
  const sliceW = sliceMm * pxPerMm;
  const bodyW = diameter * pxPerMm;
  const bodyH = bottleH * pxPerMm;
  const labelTop = bodyH * (isBottle ? 0.5 : 0.52) - labelH / 2 + 40;
  const tint = glass ? "rgba(170, 205, 190, 0.35)" : "rgba(190, 220, 245, 0.28)";

  return (
    <div
      className="bottle3d"
      style={{ display: "grid", placeItems: "center", padding: "12px 0", userSelect: "none", touchAction: "pan-y" }}
      onPointerDown={(e) => {
        drag.current = { x: e.clientX, a: angle };
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => drag.current && setAngle(drag.current.a + (e.clientX - drag.current.x) * 0.6)}
      onPointerUp={() => (drag.current = null)}
      onPointerCancel={() => (drag.current = null)}
      role="img"
      aria-label="3D preview of the label on the bottle"
    >
      <div dangerouslySetInnerHTML={{ __html: symbol }} />
      <div style={{ position: "relative", width: bodyW + 40, height: bodyH + 60, perspective: 1100, cursor: "grab" }}>
        {/* Bottle body */}
        <svg width={bodyW + 40} height={bodyH + 60} style={{ position: "absolute", inset: 0 }} aria-hidden="true">
          <defs>
            <linearGradient id="hl-body" x1="0" x2="1">
              <stop offset="0" stopColor="#000" stopOpacity="0.16" />
              <stop offset="0.22" stopColor="#fff" stopOpacity="0.45" />
              <stop offset="0.5" stopColor="#fff" stopOpacity="0.08" />
              <stop offset="0.85" stopColor="#000" stopOpacity="0.1" />
              <stop offset="1" stopColor="#000" stopOpacity="0.22" />
            </linearGradient>
          </defs>
          {isBottle ? (
            <g transform="translate(20 0)">
              <rect x={bodyW * 0.36} y={2} width={bodyW * 0.28} height={22} rx={4} fill="#FFFFFF" stroke="#DDD6CA" />
              <rect x={bodyW * 0.38} y={22} width={bodyW * 0.24} height={10} fill={tint} />
              <path
                d={`M${bodyW * 0.38} 32 C ${bodyW * 0.38} 60, 0 70, 0 ${40 + bodyH * 0.18} L 0 ${bodyH + 34} Q 0 ${bodyH + 52} ${bodyW * 0.15} ${bodyH + 52} L ${bodyW * 0.85} ${bodyH + 52} Q ${bodyW} ${bodyH + 52} ${bodyW} ${bodyH + 34} L ${bodyW} ${40 + bodyH * 0.18} C ${bodyW} 70, ${bodyW * 0.62} 60, ${bodyW * 0.62} 32 Z`}
                fill={tint}
                stroke={glass ? "rgba(90,130,110,.55)" : "rgba(120,160,200,.5)"}
                strokeWidth={glass ? 2.5 : 1.2}
              />
              <path d={`M${bodyW * 0.1} ${60 + bodyH * 0.15} L ${bodyW * 0.1} ${bodyH + 30}`} stroke="#fff" strokeOpacity="0.7" strokeWidth={bodyW * 0.04} strokeLinecap="round" />
            </g>
          ) : (
            <g transform="translate(20 20)">
              <rect x={-4} y={0} width={bodyW + 8} height={18} rx={5} fill="#FFFFFF" stroke="#DDD6CA" />
              <rect x={0} y={16} width={bodyW} height={bodyH} rx={12} fill={tint} stroke="rgba(120,160,200,.5)" />
            </g>
          )}
        </svg>
        {/* Label cylinder */}
        <div style={{ position: "absolute", left: 20 + bodyW / 2, top: labelTop, width: 0, height: labelH, transformStyle: "preserve-3d", transform: `rotateY(${angle}deg)` }}>
          {slices.map((s, i) => (
            <svg
              key={i}
              width={sliceW + 0.6}
              height={labelH}
              viewBox={`${s.x} 0 ${sliceMm + 0.6 / pxPerMm} ${p.size.heightMm}`}
              preserveAspectRatio="none"
              style={{ position: "absolute", left: -sliceW / 2, top: 0, maxWidth: "none", transform: `rotateY(${s.a}deg) translateZ(${R}px)`, backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" }}
            >
              <use href={`#${uid}-label`} x={-BLEED_MM} y={-BLEED_MM} width={zones.bleed.w} height={zones.bleed.h} />
            </svg>
          ))}
        </div>
        {/* Curvature shading over the label */}
        <div style={{ position: "absolute", left: 20, top: labelTop, width: bodyW, height: labelH, background: "linear-gradient(90deg, rgba(0,0,0,.28), rgba(255,255,255,.18) 22%, rgba(255,255,255,0) 40%, rgba(0,0,0,0) 70%, rgba(0,0,0,.3))", pointerEvents: "none" }} />
      </div>
      <p className="tiny muted" style={{ margin: 0 }}>
        {p.hint}
      </p>
    </div>
  );
}
