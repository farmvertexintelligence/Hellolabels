"use client";
import { useMemo, useRef, useState } from "react";
import type { LabelSize, Segment } from "@/lib/catalog/types";
import { renderLabelSvg } from "@/lib/design/render";
import type { Box, Design, RegPanelData } from "@/lib/design/types";
import { boundsOf, computeZones } from "@/lib/design/zones";
import { browserMeasure } from "./browser";

export interface LabelViewProps {
  design: Design;
  size: LabelSize;
  segment: Segment;
  reg: RegPanelData | null;
  minTextPt: number;
  lang: "en" | "ta";
  resolveImage: (src: string) => string | null;
  guides?: boolean;
  fontTick?: number;
  /** Editing (omit for a static preview). */
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  onMove?: (id: string, box: Partial<Box>, commit: boolean) => void;
  idPrefix?: string;
  className?: string;
  label?: string;
}

type Drag = { id: string; mode: "move" | "resize"; start: { x: number; y: number }; box: Box; pointer: number; moved?: boolean };

export function LabelView(p: LabelViewProps) {
  const host = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const zones = useMemo(() => computeZones(p.size, p.segment), [p.size, p.segment]);
  const svg = useMemo(
    () =>
      renderLabelSvg(p.design, {
        size: p.size,
        segment: p.segment,
        reg: p.reg,
        adHref: null,
        measure: browserMeasure,
        minTextPt: p.minTextPt,
        resolveImage: p.resolveImage,
        guides: p.guides,
        lang: p.lang,
        idPrefix: p.idPrefix ?? "v",
      }),
    // fontTick re-renders once web fonts finish loading (text metrics change).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [p.design, p.size, p.segment, p.reg, p.minTextPt, p.resolveImage, p.guides, p.lang, p.fontTick, p.idPrefix],
  );

  const toMm = (e: { clientX: number; clientY: number }) => {
    const el = host.current?.querySelector("svg");
    const m = el?.getScreenCTM();
    if (!el || !m) return { x: 0, y: 0 };
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    return { x: pt.x, y: pt.y };
  };

  const editable = Boolean(p.onSelect);
  const selected = p.design.elements.find((e) => e.id === p.selectedId) ?? null;
  const b = zones.bleed;

  const onPointerDown = (e: React.PointerEvent) => {
    if (!editable) return;
    const target = (e.target as Element).closest("[data-id]");
    const id = target?.getAttribute("data-id") ?? null;
    p.onSelect?.(id);
    if (!id) return;
    const el = p.design.elements.find((x) => x.id === id);
    if (!el) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDrag({ id, mode: "move", start: toMm(e), box: { x: el.x, y: el.y, w: el.w, h: el.h }, pointer: e.pointerId });
  };

  const onHandleDown = (e: React.PointerEvent) => {
    if (!selected) return;
    e.stopPropagation();
    (host.current as HTMLElement).setPointerCapture(e.pointerId);
    setDrag({ id: selected.id, mode: "resize", start: toMm(e), box: { x: selected.x, y: selected.y, w: selected.w, h: selected.h }, pointer: e.pointerId });
  };

  const apply = (e: React.PointerEvent, commit: boolean) => {
    if (!drag || e.pointerId !== drag.pointer) return;
    const now = toMm(e);
    const dx = now.x - drag.start.x;
    const dy = now.y - drag.start.y;
    if (Math.abs(dx) < 0.15 && Math.abs(dy) < 0.15 && !drag.moved) {
      if (commit) setDrag(null); // a tap: select only, no history entry
      return;
    }
    drag.moved = true;
    if (drag.mode === "move") p.onMove?.(drag.id, { x: drag.box.x + dx, y: drag.box.y + dy }, commit);
    else p.onMove?.(drag.id, { w: Math.max(2, drag.box.w + dx), h: Math.max(2, drag.box.h + dy) }, commit);
    if (commit) setDrag(null);
  };

  const sb = selected ? boundsOf(selected) : null;
  const handle = Math.max(2.2, zones.width / 60);

  return (
    <div className={`label-frame ${p.className ?? ""}`} style={{ position: "relative", touchAction: editable ? "none" : "auto" }} aria-label={p.label ?? "Label preview"} role="img">
      <div
        ref={host}
        style={{ position: "relative", cursor: editable ? (drag ? "grabbing" : "pointer") : "default" }}
        onPointerDown={onPointerDown}
        onPointerMove={(e) => apply(e, false)}
        onPointerUp={(e) => apply(e, true)}
        onPointerCancel={(e) => apply(e, true)}
      >
        <div dangerouslySetInnerHTML={{ __html: svg }} />
        {editable && sb && (
          <svg viewBox={`${b.x} ${b.y} ${b.w} ${b.h}`} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", boxShadow: "none" }} aria-hidden="true">
            <rect x={sb.x} y={sb.y} width={sb.w} height={sb.h} fill="none" stroke="#7B5CF0" strokeWidth={Math.max(0.25, zones.width / 600)} strokeDasharray="1 0.6" />
            <rect
              x={sb.x + sb.w - handle / 2}
              y={sb.y + sb.h - handle / 2}
              width={handle}
              height={handle}
              rx={handle / 4}
              fill="#7B5CF0"
              stroke="#fff"
              strokeWidth={0.3}
              style={{ pointerEvents: "auto", cursor: "nwse-resize" }}
              onPointerDown={onHandleDown}
            />
          </svg>
        )}
      </div>
    </div>
  );
}
