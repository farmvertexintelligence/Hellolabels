"use client";
import Link from "next/link";
import { useRef, useState } from "react";

/** 3D tilt that follows the pointer (desktop) — product cards. */
export function Tilt({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const move = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse" || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    ref.current.style.setProperty("--rx", `${(-y * 8).toFixed(2)}deg`);
    ref.current.style.setProperty("--ry", `${(x * 10).toFixed(2)}deg`);
    ref.current.style.setProperty("--gx", `${(x + 0.5) * 100}%`);
    ref.current.style.setProperty("--gy", `${(y + 0.5) * 100}%`);
  };
  const leave = () => {
    ref.current?.style.setProperty("--rx", "0deg");
    ref.current?.style.setProperty("--ry", "0deg");
  };
  return (
    <div ref={ref} className={`tilt ${className ?? ""}`} onPointerMove={move} onPointerLeave={leave}>
      {children}
    </div>
  );
}

/**
 * 3D flip card for a label design: front = the label, back = what it is and a "Use this design"
 * link. Flips on hover (desktop) and on tap (phones).
 */
export function FlipCard({ front, title, sub, href, cta, color }: { front: React.ReactNode; title: string; sub: string; href: string; cta: string; color: string }) {
  const [flipped, setFlipped] = useState(false);
  return (
    <div className={`flip ${flipped ? "flipped" : ""}`}>
      <button type="button" className="flip-inner" onClick={() => setFlipped(!flipped)} aria-pressed={flipped} aria-label={`${title}: ${sub}`}>
        <span className="flip-face flip-front">{front}</span>
        <span className="flip-face flip-back" style={{ background: color }}>
          <span className="flip-title">{title}</span>
          <span className="flip-sub">{sub}</span>
        </span>
      </button>
      <Link className="flip-cta" href={href}>
        {cta} →
      </Link>
    </div>
  );
}

/** Plastic / glass tabs over server-rendered product grids. */
export function Tabs({ tabs }: { tabs: { id: string; label: string; content: React.ReactNode }[] }) {
  const [active, setActive] = useState(tabs[0].id);
  return (
    <div>
      <div className="seg" role="tablist">
        {tabs.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={active === t.id} onClick={() => setActive(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      {tabs.map((t) => (
        <div key={t.id} role="tabpanel" hidden={active !== t.id} className="tab-panel">
          {t.content}
        </div>
      ))}
    </div>
  );
}
