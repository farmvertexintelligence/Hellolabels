"use client";
import { useEffect, useRef, useState } from "react";
import { LabelBottle, type BottleLabel } from "./LabelBottle";

interface Step {
  title: string;
  body: string;
}

/**
 * Sticky scroll story: while the visitor scrolls through the steps, the 3D bottle turns and its
 * label changes for each step. Falls back to a plain list with reduced motion.
 */
export function ScrollStory({ steps, labels, labelMm, eyebrow }: { steps: Step[]; labels: BottleLabel[]; labelMm: { w: number; h: number }; eyebrow: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [p, setP] = useState(0);
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    setReduce(matchMedia("(prefers-reduced-motion: reduce)").matches);
    let raf = 0;
    const on = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const el = ref.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        const total = r.height - innerHeight;
        setP(Math.min(1, Math.max(0, -r.top / Math.max(1, total))));
      });
    };
    on();
    addEventListener("scroll", on, { passive: true });
    addEventListener("resize", on);
    return () => {
      removeEventListener("scroll", on);
      removeEventListener("resize", on);
    };
  }, []);

  const n = steps.length;
  const active = Math.min(n - 1, Math.floor(p * n));
  const local = p * n - active; // 0..1 inside the current step
  // One full turn over the story, with a gentle settle on the front of each label.
  const angle = reduce ? 0 : (local - 0.5) * 70 + (active % 2 ? 6 : -6);

  return (
    <section className="story" ref={ref} style={{ height: reduce ? "auto" : `${n * 85 + 40}vh` }} aria-label="How it works">
      <div className="story-sticky">
        <div className="wrap">
          {eyebrow}
        </div>
        <div className="wrap story-grid">
          <div>
            <ol className="story-steps">
              {steps.map((s, i) => (
                <li key={s.title} className={i === active || reduce ? "on" : i < active ? "done" : ""}>
                  <span className="story-num">{i + 1}</span>
                  <div>
                    <h3>{s.title}</h3>
                    <p>{s.body}</p>
                  </div>
                </li>
              ))}
            </ol>
            <div className="story-bar" aria-hidden="true">
              <i style={{ transform: `scaleX(${reduce ? 1 : p})` }} />
            </div>
          </div>
          <div className="story-bottle">
            <div className="story-glow" style={{ background: ["#FF6A4D", "#FFC845", "#7B5CF0", "#1EC8A8", "#FF6A4D"][active % 5] }} />
            <LabelBottle labels={labels} active={active % labels.length} angle={angle} labelMm={labelMm} width={150} mobileWidth={96} />
          </div>
        </div>
      </div>
    </section>
  );
}
