"use client";
import { useEffect, useState } from "react";

const BOTTLE_HEIGHT_MM: Record<number, number> = { 250: 150, 300: 165, 500: 205, 1000: 270, 2000: 315 };
const SLICES = 26;

export interface BottleLabel {
  src: string;
  alt: string;
}

interface Props {
  labels: BottleLabel[];
  /** Index of the label shown (controlled), else labels cycle every `cycleMs` when > 1. */
  active?: number;
  cycleMs?: number;
  /** Rotation in degrees (controlled, e.g. from scroll). Omit for the gentle automatic sway. */
  angle?: number;
  labelMm: { w: number; h: number };
  volumeMl?: number;
  diameterMm?: number;
  glass?: boolean;
  /** Rendered bottle width in px, and on screens narrower than 960 px. */
  width?: number;
  mobileWidth?: number;
  className?: string;
}

/**
 * A water bottle in CSS 3D with a real label (a PNG of the design) wrapped around its curve.
 * The label is cut into thin vertical slices placed on a cylinder, so it bends like printed
 * film. Several labels can be stacked and cross-faded. Cheap enough for budget phones.
 */
export function LabelBottle({ labels, active, cycleMs = 3800, angle, labelMm, volumeMl = 500, diameterMm = 65, glass, width: desktopWidth = 220, mobileWidth, className }: Props) {
  const [auto, setAuto] = useState(0);
  const [reduce, setReduce] = useState(false);
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    setReduce(matchMedia("(prefers-reduced-motion: reduce)").matches);
    const mq = matchMedia("(max-width: 959px)");
    setNarrow(mq.matches);
    const on = () => setNarrow(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  const width = narrow && mobileWidth ? mobileWidth : desktopWidth;
  useEffect(() => {
    if (active !== undefined || labels.length < 2 || reduce) return;
    const id = setInterval(() => setAuto((i) => (i + 1) % labels.length), cycleMs);
    return () => clearInterval(id);
  }, [active, labels.length, cycleMs, reduce]);
  const shown = active ?? auto;

  const bottleH = BOTTLE_HEIGHT_MM[volumeMl] ?? 205;
  const k = width / diameterMm; // px per mm
  const R = width / 2;
  const bodyH = bottleH * k;
  const circ = Math.PI * diameterMm;
  const lw = labelMm.w * k;
  const lh = labelMm.h * k;
  const sliceMm = labelMm.w / SLICES;
  const sliceW = sliceMm * k;
  const capH = 0.11 * width;
  const neck = 0.13 * bodyH;
  const totalH = bodyH + capH;
  const labelTop = capH + bodyH * 0.56 - lh / 2;
  const tint = glass ? "rgba(178, 216, 198, 0.45)" : "rgba(214, 236, 252, 0.6)";
  const edge = glass ? "rgba(70, 120, 100, .55)" : "rgba(110, 155, 200, .5)";
  const controlled = angle !== undefined;

  return (
    <div className={`lb ${className ?? ""}`} style={{ width: width + 24, height: totalH + 16 }} role="img" aria-label={labels[shown]?.alt}>
      <div className="lb-stage" style={{ perspective: 1000 }}>
        <svg className="lb-body" width={width + 24} height={totalH + 16} viewBox={`-12 0 ${width + 24} ${totalH + 16}`} aria-hidden="true">
          <defs>
            <linearGradient id="lb-shade" x1="0" x2="1">
              <stop offset="0" stopColor="#5D86A8" stopOpacity="0.22" />
              <stop offset="0.18" stopColor="#fff" stopOpacity="0.7" />
              <stop offset="0.42" stopColor="#fff" stopOpacity="0.1" />
              <stop offset="0.86" stopColor="#5D86A8" stopOpacity="0.08" />
              <stop offset="1" stopColor="#5D86A8" stopOpacity="0.26" />
            </linearGradient>
          </defs>
          <ellipse cx={width / 2} cy={totalH + 6} rx={width * 0.46} ry={8} fill="#141A26" opacity="0.12" />
          <rect x={width * 0.36} y={2} width={width * 0.28} height={capH} rx={5} fill="#fff" stroke="#DDD6CA" />
          <path d={`M${width * 0.36} ${capH + 6} h${width * 0.28}`} stroke="#E8E2D6" strokeWidth={3} />
          <path
            d={`M${width * 0.38} ${capH} C ${width * 0.38} ${capH + neck * 0.6}, 0 ${capH + neck * 0.7}, 0 ${capH + neck * 1.5} V ${totalH - 14} Q 0 ${totalH} ${width * 0.12} ${totalH} H ${width * 0.88} Q ${width} ${totalH} ${width} ${totalH - 14} V ${capH + neck * 1.5} C ${width} ${capH + neck * 0.7}, ${width * 0.62} ${capH + neck * 0.6}, ${width * 0.62} ${capH} Z`}
            fill={tint}
            stroke={edge}
            strokeWidth={glass ? 2.4 : 1.2}
          />
          <path d={`M${width * 0.38} ${capH} C ${width * 0.38} ${capH + neck * 0.6}, 0 ${capH + neck * 0.7}, 0 ${capH + neck * 1.5} V ${totalH - 14} Q 0 ${totalH} ${width * 0.12} ${totalH} H ${width * 0.88} Q ${width} ${totalH} ${width} ${totalH - 14} V ${capH + neck * 1.5} C ${width} ${capH + neck * 0.7}, ${width * 0.62} ${capH + neck * 0.6}, ${width * 0.62} ${capH} Z`} fill="url(#lb-shade)" />
        </svg>
        {labels.map((l, li) => (
          <div
            key={l.src}
            className={`lb-cyl ${controlled ? "" : "lb-sway"}`}
            style={{
              left: 12 + R,
              top: labelTop,
              height: lh,
              opacity: li === shown ? 1 : 0,
              transform: controlled ? `rotateY(${angle}deg)` : undefined,
            }}
          >
            {Array.from({ length: SLICES }, (_, i) => {
              const xMm = i * sliceMm;
              const a = ((xMm + sliceMm / 2 - labelMm.w / 2) / circ) * 360;
              return (
                <div
                  key={i}
                  className="lb-slice"
                  style={{
                    width: sliceW + 0.6,
                    height: lh,
                    left: -sliceW / 2,
                    backgroundImage: `url(${l.src})`,
                    backgroundSize: `${lw}px ${lh}px`,
                    backgroundPosition: `${-xMm * k}px 0`,
                    transform: `rotateY(${a}deg) translateZ(${R}px)`,
                  }}
                />
              );
            })}
          </div>
        ))}
        <div className="lb-gloss" style={{ left: 12, top: labelTop, width, height: lh }} />
      </div>
    </div>
  );
}
