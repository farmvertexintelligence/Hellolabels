"use client";
import { useEffect, useState } from "react";
import { cssFontFamily, nearestWeight, type FontId } from "@/lib/design/fonts";
import type { Measure } from "@/lib/design/text-layout";
import type { Design } from "@/lib/design/types";

let ctx: CanvasRenderingContext2D | null = null;
const cache = new Map<string, number>();

/** Text width using the browser's own font engine (same fonts as the print renderer). */
export const browserMeasure: Measure = (text, font, weight, sizeMm, ls = 0) => {
  const key = `${font}|${weight}|${text}`;
  let w100 = cache.get(key);
  if (w100 === undefined) {
    ctx ??= document.createElement("canvas").getContext("2d");
    if (!ctx) return text.length * sizeMm * 0.55;
    ctx.font = `${nearestWeight(font, weight)} 100px ${cssFontFamily(font)}`;
    w100 = ctx.measureText(text).width;
    cache.set(key, w100);
  }
  return (w100 / 100) * sizeMm + Math.max(0, [...text].length - 1) * ls * sizeMm;
};

let labelCss = false;
/** Loads the designer's label fonts (once) and the faces a design uses; bumps a counter when ready. */
export function useLabelFonts(design: Design | null): number {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!labelCss) {
      labelCss = true;
      const l = document.createElement("link");
      l.rel = "stylesheet";
      l.href = "/fonts/label.css";
      document.head.appendChild(l);
    }
  }, []);
  const wanted = design
    ? [...new Set(design.elements.flatMap((e) => (e.type === "text" ? [`${e.font}|${e.weight}|${e.text}`] : [])))]
    : [];
  const sig = wanted.join("¦");
  useEffect(() => {
    if (!wanted.length) return;
    let cancelled = false;
    Promise.all(
      wanted.map((w) => {
        const [font, weight, text] = w.split("|");
        // Load the face and its Tamil fallback for the characters actually used.
        return document.fonts.load(`${nearestWeight(font as FontId, Number(weight))} 40px ${cssFontFamily(font as FontId)}`, text || "A").catch(() => null);
      }),
    ).then(() =>
      document.fonts.ready.then(() => {
        if (!cancelled) {
          cache.clear();
          setTick((t) => t + 1);
        }
      }),
    );
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);
  return tick;
}

const signed = new Map<string, string>();

/** Turns stored image paths into short-lived preview URLs (fetched from the server in one batch). */
export function useImageUrls(design: Design | null, extra: string[] = []): (src: string) => string | null {
  const [, setTick] = useState(0);
  const srcs = [...new Set([...(design?.elements ?? []).flatMap((e) => (e.type === "image" ? [e.src] : [])), ...extra])].filter((s) => s.startsWith("uploads/") && !signed.has(s));
  const sig = srcs.join(",");
  useEffect(() => {
    if (!srcs.length) return;
    fetch("/api/uploads/sign", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ paths: srcs }) })
      .then((r) => (r.ok ? r.json() : { urls: {} }))
      .then((j: { urls: Record<string, string> }) => {
        for (const [k, v] of Object.entries(j.urls ?? {})) signed.set(k, v);
        setTick((t) => t + 1);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);
  return (src: string) => (src.startsWith("uploads/") ? (signed.get(src) ?? null) : src);
}

export function rememberImageUrl(src: string, url: string) {
  signed.set(src, url);
}
