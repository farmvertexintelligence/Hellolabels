"use client";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

/**
 * Site-wide scroll effects (one listener, one observer):
 *  - top progress bar and a "scrolled" header state,
 *  - [data-reveal] elements fade/slide in when they enter the viewport (stagger with style="--d:2"),
 *  - [data-count] numbers count up once when visible.
 * Everything is visible without JavaScript and with reduced motion.
 */
export function ScrollFx() {
  const path = usePathname();
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("js");
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const bar = document.getElementById("scroll-progress");
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const max = root.scrollHeight - innerHeight;
        bar?.style.setProperty("--p", String(max > 0 ? scrollY / max : 0));
        root.toggleAttribute("data-scrolled", scrollY > 8);
      });
    };
    onScroll();
    addEventListener("scroll", onScroll, { passive: true });

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const el = e.target as HTMLElement;
          el.classList.add("in");
          if (el.dataset.count && !reduce) countUp(el);
          io.unobserve(el);
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );
    document.querySelectorAll("[data-reveal]:not(.in), [data-count]").forEach((el) => io.observe(el));
    return () => {
      removeEventListener("scroll", onScroll);
      io.disconnect();
    };
  }, [path]);
  return <div id="scroll-progress" aria-hidden="true" />;
}

function countUp(el: HTMLElement) {
  const target = Number(el.dataset.count);
  if (!Number.isFinite(target)) return;
  const start = performance.now();
  const dur = 1200;
  const tick = (now: number) => {
    const k = Math.min(1, (now - start) / dur);
    el.textContent = String(Math.round(target * (1 - Math.pow(1 - k, 3))));
    if (k < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
