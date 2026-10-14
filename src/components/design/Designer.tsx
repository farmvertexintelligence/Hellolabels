"use client";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { findLabelSize, findPrice, findProduct, GLASS_PACKING_NOTE, notSellableReason } from "@/lib/catalog/helpers";
import type { Catalog, Segment } from "@/lib/catalog/types";
import { addToCart } from "@/lib/cart";
import { earliestDelivery } from "@/lib/commerce/logistics";
import { formatInr, priceCart, qtyError } from "@/lib/commerce/pricing";
import { runChecks, clampInto, type CheckId } from "@/lib/design/checks";
import { FONTS, FONT_IDS, nearestWeight, type FontId } from "@/lib/design/fonts";
import { MOTIFS, MOTIF_IDS, type MotifId } from "@/lib/design/motifs";
import { regDataFor } from "@/lib/design/regdata";
import { TEMPLATES, buildTemplate, newId } from "@/lib/design/templates";
import type { Box, Design, DesignElement, TextElement } from "@/lib/design/types";
import { computeZones } from "@/lib/design/zones";
import { useI18n } from "@/lib/i18n/client";
import { Bottle3D } from "./Bottle3D";
import { browserMeasure, rememberImageUrl, useImageUrls, useLabelFonts } from "./browser";
import { LabelView } from "./LabelView";

type Step = "product" | "describe" | "edit" | "order";
interface Asset {
  src: string;
  url: string;
  pxWidth: number;
  pxHeight: number;
  local?: boolean;
}

interface History {
  past: Design[];
  present: Design | null;
  future: Design[];
}
type Act =
  | { type: "set"; design: Design; record?: boolean }
  | { type: "commitFrom"; from: Design; design: Design }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "reset"; design: Design | null };

function history(h: History, a: Act): History {
  switch (a.type) {
    case "reset":
      return { past: [], present: a.design, future: [] };
    case "set":
      if (!h.present || a.record === false) return { ...h, present: a.design };
      return { past: [...h.past.slice(-40), h.present], present: a.design, future: [] };
    case "commitFrom":
      return { past: [...h.past.slice(-40), a.from], present: a.design, future: [] };
    case "undo":
      if (!h.past.length || !h.present) return h;
      return { past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future] };
    case "redo":
      if (!h.future.length || !h.present) return h;
      return { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1) };
  }
}

const SWATCHES = ["#141A26", "#FFFFFF", "#FF6A4D", "#FFC845", "#7B5CF0", "#1EC8A8", "#B5452A", "#D4A437", "#8E1B1B", "#2E7D32", "#0E6BA8", "#F6F3EC"];

export interface DesignerProps {
  catalog: Catalog;
  initial: { productId?: string; segment?: Segment; templateId?: string; labelSizeId?: string; design?: Design | null; designId?: string | null };
  signedIn: boolean;
}

export function Designer({ catalog, initial, signedIn }: DesignerProps) {
  const { t, lang } = useI18n();
  const router = useRouter();
  const minPt = catalog.settings.minTextPt;

  const [segment, setSegment] = useState<Segment>(initial.segment ?? "event");
  const [productId, setProductId] = useState<string>(initial.productId ?? "water-500-plastic");
  const product = findProduct(catalog, productId)!;
  const [labelSizeId, setLabelSizeId] = useState<string>(initial.labelSizeId ?? product.labelSizeIds[0]);
  const size = findLabelSize(catalog, product.labelSizeIds.includes(labelSizeId) ? labelSizeId : product.labelSizeIds[0])!;
  const effSegment: Segment = product.kind === "label_only" ? "label" : segment;
  const reg = useMemo(() => (size.hasRegPanel ? regDataFor(catalog, product.id) : null), [catalog, product.id, size.hasRegPanel]);

  const [step, setStep] = useState<Step>(initial.design ? "edit" : initial.templateId ? "edit" : "product");
  const [brief, setBrief] = useState("");
  const [assets, setAssets] = useState<Asset[]>([]);
  const [options, setOptions] = useState<Design[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [h, dispatch] = useReducer(history, { past: [], present: initial.design ?? null, future: [] });
  const design = h.present;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<"flat" | "3d">("flat");
  const [guides, setGuides] = useState(true);
  const [aiAsk, setAiAsk] = useState("");
  const [designId, setDesignId] = useState<string | null>(initial.designId ?? null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [qty, setQty] = useState(product.minQty);
  const [date, setDate] = useState(() => earliestDelivery(new Date(), 1));
  const fileInput = useRef<HTMLInputElement>(null);

  const fontTick = useLabelFonts(design);
  const resolve = useImageUrls(design, options.flatMap((o) => o.elements.flatMap((e) => (e.type === "image" ? [e.src] : []))));
  const resolveImage = useCallback((src: string) => assets.find((a) => a.src === src)?.url ?? resolve(src), [assets, resolve]);

  // Start from a template link (/design?template=wedding).
  useEffect(() => {
    if (initial.templateId && !initial.design) {
      const def = TEMPLATES.find((x) => x.id === initial.templateId);
      if (def) {
        if (def.segment === "shop") setSegment("shop");
        dispatch({ type: "reset", design: buildTemplate(def, 0, def.defaults[lang], size, def.segment === "shop" && product.kind === "water_bottle" ? "shop" : effSegment) });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // If the product/size/segment changes while editing, rebuild the design for the new fixed size.
  const lastKey = useRef(`${size.id}|${effSegment}`);
  useEffect(() => {
    const key = `${size.id}|${effSegment}`;
    if (key === lastKey.current) return;
    lastKey.current = key;
    setOptions([]);
    if (design) {
      const def = TEMPLATES.find((x) => x.id === design.templateId) ?? TEMPLATES[0];
      dispatch({ type: "reset", design: buildTemplate(def, 0, def.defaults[lang], size, effSegment) });
    }
    setQty(product.minQty);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size.id, effSegment]);

  const checks = useMemo(
    () => (design ? runChecks(design, { size, segment: effSegment, reg, measure: browserMeasure, minTextPt: minPt }) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [design, size, effSegment, reg, minPt, fontTick],
  );

  const zones = useMemo(() => computeZones(size, effSegment), [size, effSegment]);
  const selected = design?.elements.find((e) => e.id === selectedId) ?? null;

  const update = (fn: (d: Design) => Design, record = true) => design && dispatch({ type: "set", design: fn(structuredClone(design)), record });
  const patchEl = (id: string, patch: Partial<DesignElement>, record = true) =>
    update((d) => ({ ...d, elements: d.elements.map((e) => (e.id === id ? ({ ...e, ...patch } as DesignElement) : e)) }), record);

  // Live drag updates the design without history; the drop records one undo step from the pre-drag state.
  const dragOrigin = useRef<Design | null>(null);
  const onMove = (id: string, box: Partial<Box>, commit: boolean) => {
    if (!design) return;
    const el = design.elements.find((e) => e.id === id);
    if (!el) return;
    dragOrigin.current ??= design;
    let next = { x: el.x, y: el.y, w: el.w, h: el.h, ...box };
    if (commit) next = clampInto(next, el.role === "background" ? zones.bleed : zones.design);
    const moved = { ...design, elements: design.elements.map((e) => (e.id === id ? ({ ...e, ...next } as DesignElement) : e)) };
    if (commit) {
      dispatch({ type: "commitFrom", from: dragOrigin.current, design: moved });
      dragOrigin.current = null;
    } else dispatch({ type: "set", design: moved, record: false });
  };

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy("upload");
    setNotice(null);
    for (const file of Array.from(files).slice(0, 3)) {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/uploads", { method: "POST", body: fd }).catch(() => null);
      if (res?.ok) {
        const j = (await res.json()) as Asset;
        rememberImageUrl(j.src, j.url);
        setAssets((a) => [...a, j]);
        if (design) addImage(j);
      } else {
        // No storage available (local preview): keep the image in this browser only.
        const url = URL.createObjectURL(file);
        const dims = await new Promise<{ w: number; h: number }>((ok) => {
          const img = new Image();
          img.onload = () => ok({ w: img.naturalWidth, h: img.naturalHeight });
          img.onerror = () => ok({ w: 0, h: 0 });
          img.src = url;
        });
        const err = res ? ((await res.json().catch(() => ({}))) as { error?: string }).error : null;
        const a = { src: url, url, pxWidth: dims.w, pxHeight: dims.h, local: true };
        setAssets((x) => [...x, a]);
        if (design) addImage(a);
        setNotice(err ?? "Image kept on this device only. Sign in to save it with your order.");
      }
    }
    setBusy(null);
  }

  function addImage(a: Asset) {
    const D = zones.design;
    const s = Math.min(D.h * 0.8, D.w * 0.3);
    const aspect = a.pxWidth && a.pxHeight ? a.pxWidth / a.pxHeight : 1;
    const w = aspect >= 1 ? s : s * aspect;
    const hh = aspect >= 1 ? s / aspect : s;
    const el: DesignElement = { id: newId("i"), type: "image", name: "logo", x: D.x + 1, y: D.y + (D.h - hh) / 2, w, h: hh, src: a.src, pxWidth: a.pxWidth, pxHeight: a.pxHeight, fit: "contain" };
    update((d) => ({ ...d, elements: [...d.elements, el] }));
    setSelectedId(el.id);
  }

  async function generate() {
    setBusy("ai");
    setNotice(null);
    try {
      const res = await fetch("/api/ai/design", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ brief, labelSizeId: size.id, productId: product.id, segment: effSegment, lang, images: assets.filter((a) => !a.local).map((a) => a.src) }),
      });
      const j = (await res.json()) as { designs?: Design[]; source?: string; error?: string };
      if (!res.ok || !j.designs) throw new Error(j.error ?? "Could not create designs");
      // Local-only images (no storage) are added to every option.
      const withLocal = j.designs.map((d, i) => {
        const local = assets.filter((a) => a.local);
        if (!local.length || i % 2) return d;
        const D = zones.design;
        const s = Math.min(D.h * 0.7, D.w * 0.25);
        return { ...d, elements: [...d.elements, ...local.map((a) => ({ id: newId("i"), type: "image", name: "logo", x: D.x + 1, y: D.y + 1, w: s, h: s, src: a.src, pxWidth: a.pxWidth, pxHeight: a.pxHeight, fit: "contain" }) as DesignElement)] };
      });
      setOptions(withLocal);
      if (j.source === "templates") setNotice(t.designer.aiOffline);
      setStep("edit");
      dispatch({ type: "reset", design: null });
    } catch (e) {
      setNotice(String((e as Error).message));
    } finally {
      setBusy(null);
    }
  }

  async function revise() {
    if (!design || !aiAsk.trim()) return;
    setBusy("revise");
    setNotice(null);
    try {
      const res = await fetch("/api/ai/revise", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ design, instruction: aiAsk, labelSizeId: size.id, productId: product.id, segment: effSegment }),
      });
      const j = (await res.json()) as { design?: Design; note?: string; error?: string };
      if (!res.ok || !j.design) throw new Error(j.error ?? "Could not apply the change");
      dispatch({ type: "set", design: j.design });
      setNotice(j.note ?? null);
      setAiAsk("");
    } catch (e) {
      setNotice(String((e as Error).message));
    } finally {
      setBusy(null);
    }
  }

  async function save() {
    if (!design) return;
    if (!signedIn) {
      sessionStorage.setItem("hl_pending_design", JSON.stringify({ design, productId: product.id, segment: effSegment }));
      router.push(`/login?next=${encodeURIComponent(`/design?product=${product.id}&segment=${segment}&restore=1`)}`);
      return;
    }
    setBusy("save");
    const res = await fetch(designId ? `/api/designs/${designId}` : "/api/designs", {
      method: designId ? "PUT" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: design.name ?? product.nameEn, productId: product.id, labelSizeId: size.id, segment: effSegment, doc: design }),
    });
    const j = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
    if (res.ok && j.id) {
      setDesignId(j.id);
      setSavedAt(Date.now());
    } else setNotice(j.error ?? "Could not save");
    setBusy(null);
  }

  // Restore a design kept while the visitor signed in.
  useEffect(() => {
    if (!new URLSearchParams(location.search).get("restore")) return;
    const raw = sessionStorage.getItem("hl_pending_design");
    if (!raw) return;
    sessionStorage.removeItem("hl_pending_design");
    try {
      const v = JSON.parse(raw) as { design: Design };
      dispatch({ type: "reset", design: v.design });
      setStep("edit");
    } catch {}
  }, []);

  const pricing = useMemo(() => priceCart(catalog, [{ productId: product.id, segment: effSegment, qty }]), [catalog, product.id, effSegment, qty]);
  const sellable = notSellableReason(catalog, product, effSegment);
  const qErr = qtyError(catalog, product.id, qty);
  const hasLocalImages = design?.elements.some((e) => e.type === "image" && !e.src.startsWith("uploads/"));

  function toCart() {
    if (!design || !checks?.ok) return;
    addToCart({ productId: product.id, labelSizeId: size.id, segment: effSegment, qty, design, designId }, date);
    router.push("/cart");
  }

  /* ───────────── UI ───────────── */
  const water = catalog.products.filter((p) => p.active && p.kind === "water_bottle");
  const labels = catalog.products.filter((p) => p.active && p.kind === "label_only");
  const bottleType = product.bottleType ?? "plastic";
  const price = findPrice(catalog, product, effSegment);

  const stepper = (
    <ol className="row small" style={{ listStyle: "none", padding: 0, margin: "0 0 16px", gap: 8 }}>
      {(["product", "describe", "edit", "order"] as Step[]).map((s, i) => (
        <li key={s}>
          <button
            type="button"
            className="pill"
            style={{ background: step === s ? "var(--ink)" : undefined, color: step === s ? "#fff" : undefined, cursor: "pointer" }}
            onClick={() => (s === "product" || s === "describe" || design || options.length ? setStep(s) : null)}
          >
            {i + 1} · {[t.designer.step1.slice(4), t.designer.step2.slice(4), t.designer.step3.slice(4), t.order.quantity][i]}
          </button>
        </li>
      ))}
    </ol>
  );

  return (
    <div className="wrap" style={{ paddingTop: 20, paddingBottom: 120 }}>
      <h1 style={{ fontSize: "clamp(1.7rem,5vw,2.6rem)" }}>{t.designer.title}</h1>
      {stepper}
      {notice && (
        <div className="note note-warn" role="status" style={{ marginBottom: 12 }}>
          {notice}
        </div>
      )}

      {step === "product" && (
        <section className="stack" aria-labelledby="s1">
          <h2 id="s1" className="sr-only">{t.designer.step1}</h2>
          <div className="field">
            <span>{t.designer.segment}</span>
            <div className="seg">
              <button type="button" aria-pressed={product.kind === "water_bottle" && segment === "event"} onClick={() => { setSegment("event"); if (product.kind !== "water_bottle") setProductId("water-500-plastic"); }}>
                {t.designer.segEvent}
              </button>
              <button type="button" aria-pressed={product.kind === "water_bottle" && segment === "shop"} onClick={() => { setSegment("shop"); if (product.kind !== "water_bottle") setProductId("water-500-plastic"); }}>
                {t.designer.segShop}
              </button>
              <button type="button" aria-pressed={product.kind === "label_only"} onClick={() => labels[0] && setProductId(labels[0].id)}>
                {t.home.segments[3].title}
              </button>
            </div>
          </div>
          {product.kind === "water_bottle" ? (
            <>
              <div className="field">
                <span>{t.designer.bottleType}</span>
                <div className="seg">
                  {(["plastic", "glass"] as const).map((bt) => (
                    <button key={bt} type="button" aria-pressed={bottleType === bt} onClick={() => setProductId(`water-${product.volumeMl}-${bt}`)}>
                      {bt === "plastic" ? t.product.plastic : t.product.glass}
                    </button>
                  ))}
                </div>
              </div>
              <div className="field">
                <span>{t.designer.size}</span>
                <div className="seg">
                  {water
                    .filter((p) => p.bottleType === bottleType)
                    .map((p) => (
                      <button key={p.id} type="button" aria-pressed={p.id === product.id} onClick={() => setProductId(p.id)}>
                        {p.volumeMl! >= 1000 ? `${p.volumeMl! / 1000} L` : `${p.volumeMl} ml`}
                      </button>
                    ))}
                </div>
              </div>
            </>
          ) : (
            <div className="field">
              <span>{t.nav.products}</span>
              <div className="seg">
                {labels.map((p) => (
                  <button key={p.id} type="button" aria-pressed={p.id === product.id} onClick={() => setProductId(p.id)}>
                    {lang === "ta" ? p.nameTa : p.nameEn}
                  </button>
                ))}
              </div>
              {product.labelSizeIds.length > 1 && (
                <div className="seg" style={{ marginTop: 8 }}>
                  {product.labelSizeIds.map((id) => {
                    const s = findLabelSize(catalog, id)!;
                    return (
                      <button key={id} type="button" aria-pressed={id === size.id} onClick={() => setLabelSizeId(id)}>
                        {s.widthMm} × {s.heightMm} mm
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
          <div className="note">
            🔒 {t.designer.labelFixed}: <b className="ink">{size.widthMm} × {size.heightMm} mm</b>
            {size.isPlaceholder && <span className="tiny"> (sample size — final size confirmed by hellolabels)</span>}
            {price && (
              <div className="small" style={{ marginTop: 4 }}>
                {formatInr(price.unitPricePaise)} {product.unit === "case" ? t.product.perBottle : t.product.perLabel} · {t.product.gstIncl}
              </div>
            )}
          </div>
          {product.bottleType === "glass" && <div className="note">🫧 {GLASS_PACKING_NOTE[lang]}</div>}
          {effSegment === "shop" && <div className="note note-warn">📣 {t.designer.adNote}</div>}
          <button type="button" className="btn btn-coral btn-block" onClick={() => setStep("describe")}>
            {t.designer.step2.slice(4)} →
          </button>
        </section>
      )}

      {step === "describe" && (
        <section className="stack">
          <label className="field">
            <span>{t.designer.briefLabel}</span>
            <textarea className="textarea" value={brief} onChange={(e) => setBrief(e.target.value)} placeholder={t.designer.briefPlaceholder} maxLength={600} rows={4} />
            <span className="hint">{t.designer.briefHint}</span>
          </label>
          <div className="row">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => fileInput.current?.click()} disabled={busy === "upload"}>
              📷 {t.designer.uploadLogo}
            </button>
            <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => upload(e.target.files)} />
            {assets.map((a) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={a.src} src={a.url} alt="" width={44} height={44} style={{ objectFit: "cover", borderRadius: 8, border: "1px solid var(--line)" }} />
            ))}
          </div>
          <button type="button" className="btn btn-coral btn-block" disabled={!brief.trim() || busy === "ai"} onClick={generate}>
            {busy === "ai" ? `✨ ${t.designer.generating}` : `✨ ${t.designer.generate}`}
          </button>
          <div>
            <div className="label" style={{ marginBottom: 8 }}>{t.designer.templates}</div>
            <div className="seg">
              {TEMPLATES.filter((tp) => (effSegment === "shop" ? tp.segment === "shop" : true)).map((tp) => (
                <button
                  key={tp.id}
                  type="button"
                  onClick={() => {
                    setOptions(tp.styles.map((_, i) => buildTemplate(tp, i, tp.defaults[lang], size, effSegment)));
                    dispatch({ type: "reset", design: null });
                    setStep("edit");
                  }}
                >
                  {lang === "ta" ? tp.ta : tp.en}
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {step === "edit" && (
        <section className="stack">
          {options.length > 0 && (
            <div>
              <div className="row between">
                <h2 style={{ fontSize: "1.2rem", margin: 0 }}>{t.designer.choose}</h2>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setStep("describe")}>
                  ↻ {t.designer.regenerate}
                </button>
              </div>
              <div className={design ? "option-strip" : "grid grid-2"} style={{ marginTop: 10 }}>
                {options.map((o, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      dispatch({ type: "reset", design: structuredClone(o) });
                      setSelectedId(null);
                    }}
                    style={{ padding: 0, border: design && o.name === design.name && h.past.length === 0 ? "2px solid var(--coral)" : "2px solid transparent", borderRadius: 16, background: "none", cursor: "pointer" }}
                    aria-label={`Design ${i + 1}`}
                  >
                    <LabelView design={o} size={size} segment={effSegment} reg={reg} minTextPt={minPt} lang={lang} resolveImage={resolveImage} fontTick={fontTick} idPrefix={`o${i}`} />
                  </button>
                ))}
              </div>
            </div>
          )}

          {design && checks && (
            <>
              <div className="row between" style={{ marginTop: 8 }}>
                <div className="seg">
                  <button type="button" aria-pressed={view === "flat"} onClick={() => setView("flat")}>{t.designer.flat}</button>
                  <button type="button" aria-pressed={view === "3d"} onClick={() => setView("3d")}>{t.designer.preview3d}</button>
                </div>
                <div className="row" style={{ gap: 4 }}>
                  <button type="button" className="icon-btn" onClick={() => dispatch({ type: "undo" })} disabled={!h.past.length} aria-label={t.designer.undo}>↶</button>
                  <button type="button" className="icon-btn" onClick={() => dispatch({ type: "redo" })} disabled={!h.future.length} aria-label={t.designer.redo}>↷</button>
                  <label className="check small">
                    <input type="checkbox" checked={guides} onChange={(e) => setGuides(e.target.checked)} /> {t.designer.guides}
                  </label>
                </div>
              </div>

              {view === "flat" ? (
                <>
                  <LabelView design={design} size={size} segment={effSegment} reg={reg} minTextPt={minPt} lang={lang} resolveImage={resolveImage} guides={guides} fontTick={fontTick} selectedId={selectedId} onSelect={setSelectedId} onMove={onMove} idPrefix="ed" />
                  {guides && (
                    <div className="row tiny muted" style={{ gap: 14 }}>
                      <span><i style={{ display: "inline-block", width: 10, height: 10, background: "rgba(255,106,77,.35)", marginRight: 4 }} />{t.designer.legendBleed}</span>
                      <span><i style={{ display: "inline-block", width: 12, borderTop: "2px dashed #1EC8A8", marginRight: 4, verticalAlign: "middle" }} />{t.designer.legendSafe}</span>
                      <span>🔒 {t.designer.legendLocked}</span>
                    </div>
                  )}
                </>
              ) : (
                <Bottle3D design={design} size={size} segment={effSegment} product={product} reg={reg} minTextPt={minPt} lang={lang} resolveImage={resolveImage} fontTick={fontTick} hint={t.designer.rotateHint} />
              )}

              {/* Toolbar */}
              <div className="row" style={{ gap: 8 }}>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    const D = zones.design;
                    const el: TextElement = { id: newId("t"), type: "text", name: "text", x: D.x + D.w * 0.2, y: D.y + D.h * 0.4, w: D.w * 0.6, h: D.h * 0.2, text: lang === "ta" ? "உங்கள் வார்த்தைகள்" : "Your words", font: lang === "ta" ? "notosanstamil" : "dmsans", weight: 600, sizePt: 14, color: "#141A26", align: "center", lineHeight: 1.15, autoFit: true };
                    update((d) => ({ ...d, elements: [...d.elements, el] }));
                    setSelectedId(el.id);
                  }}
                >
                  ＋ {t.designer.addText}
                </button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => fileInput.current?.click()}>
                  📷 {t.designer.uploadLogo}
                </button>
                <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => upload(e.target.files)} />
                <select
                  className="select"
                  style={{ width: "auto", minHeight: 38 }}
                  value=""
                  onChange={(e) => {
                    const m = e.target.value as MotifId;
                    if (!m) return;
                    const D = zones.design;
                    const border = MOTIFS[m].border;
                    const el: DesignElement = border
                      ? { id: newId("m"), type: "motif", name: "border", motif: m, ...D, color: "#B5452A", color2: "#D4A437" }
                      : { id: newId("m"), type: "motif", name: MOTIFS[m].en, motif: m, x: D.x, y: D.y, w: D.h * 0.8, h: D.h * 0.8, color: "#B5452A", color2: "#D4A437" };
                    update((d) => ({ ...d, elements: border ? [el, ...d.elements] : [...d.elements, el] }));
                    setSelectedId(el.id);
                  }}
                  aria-label="Add ornament"
                >
                  <option value="">✿ {lang === "ta" ? "அலங்காரம்" : "Ornament"}</option>
                  {MOTIF_IDS.map((m) => (
                    <option key={m} value={m}>
                      {MOTIFS[m][lang]}
                    </option>
                  ))}
                </select>
              </div>

              {/* Inspector */}
              {selected ? (
                <Inspector el={selected} onChange={(patch) => patchEl(selected.id, patch)} onDelete={() => { update((d) => ({ ...d, elements: d.elements.filter((e) => e.id !== selected.id) })); setSelectedId(null); }} onLayer={(dir) => update((d) => { const i = d.elements.findIndex((e) => e.id === selected.id); const j = Math.max(0, Math.min(d.elements.length - 1, i + dir)); const els = [...d.elements]; const [x] = els.splice(i, 1); els.splice(j, 0, x); return { ...d, elements: els }; })} />
              ) : (
                <div className="card stack">
                  <div className="label">{t.designer.background}</div>
                  <div className="row">
                    <ColorInput value={design.background.color} onChange={(c) => update((d) => ({ ...d, background: { ...d.background, color: c } }))} />
                    <select className="select" style={{ width: "auto" }} value={design.background.gradient ?? "none"} onChange={(e) => update((d) => ({ ...d, background: { ...d.background, gradient: e.target.value as "none", color2: d.background.color2 ?? "#FFFFFF" } }))}>
                      <option value="none">Solid</option>
                      <option value="linear">Gradient</option>
                      <option value="radial">Radial</option>
                    </select>
                    {design.background.gradient && design.background.gradient !== "none" && <ColorInput value={design.background.color2 ?? "#FFFFFF"} onChange={(c) => update((d) => ({ ...d, background: { ...d.background, color2: c } }))} />}
                  </div>
                  <p className="tiny muted" style={{ margin: 0 }}>{lang === "ta" ? "திருத்த லேபிளில் உள்ள ஒன்றைத் தொடவும்." : "Tap anything on the label to edit it."}</p>
                </div>
              )}

              {/* AI change */}
              <form className="card stack" onSubmit={(e) => { e.preventDefault(); revise(); }}>
                <label className="field">
                  <span>✨ {t.designer.askAi}</span>
                  <input className="input" value={aiAsk} onChange={(e) => setAiAsk(e.target.value)} placeholder={t.designer.askAiPlaceholder} maxLength={300} />
                </label>
                <button type="submit" className="btn btn-sm" disabled={!aiAsk.trim() || busy === "revise"}>
                  {busy === "revise" ? t.designer.generating : t.designer.apply}
                </button>
              </form>

              {/* Checks */}
              <div className="card stack" aria-live="polite">
                <div className="row between">
                  <div className="label">{t.designer.checks}</div>
                  <span className={`pill ${checks.ok ? "pill-ok" : "pill-err"}`}>{checks.ok ? "✓" : "!"} {checks.passed.length}/5</span>
                </div>
                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 6 }}>
                  {(Object.keys(t.designer.checkNames) as CheckId[]).map((c) => {
                    const issues = checks.issues.filter((i) => i.check === c);
                    const err = issues.some((i) => i.level === "error");
                    return (
                      <li key={c} className="small">
                        <span style={{ color: err ? "var(--err)" : issues.length ? "var(--warn)" : "var(--ok)", fontWeight: 700 }}>{err ? "✕" : issues.length ? "!" : "✓"}</span> {t.designer.checkNames[c]}
                        {issues.map((i, k) => (
                          <button key={k} type="button" className="tiny" onClick={() => i.elementId && setSelectedId(i.elementId)} style={{ display: "block", marginLeft: 18, background: "none", border: 0, padding: "2px 0", textAlign: "left", color: i.level === "error" ? "var(--err)" : "var(--warn)", cursor: i.elementId ? "pointer" : "default" }}>
                            {lang === "ta" ? i.ta : i.en}
                          </button>
                        ))}
                      </li>
                    );
                  })}
                </ul>
                {checks.ok && <div className="note note-ok small">{t.designer.checksOk}</div>}
              </div>

              <div className="row no-print" style={{ position: "sticky", bottom: 0, background: "var(--paper)", padding: "12px 0", borderTop: "1px solid var(--line)", zIndex: 5 }}>
                <button type="button" className="btn btn-ghost" onClick={save} disabled={busy === "save"}>
                  {savedAt ? `✓ ${t.designer.saved}` : t.designer.save}
                </button>
                <button type="button" className="btn btn-coral" style={{ flex: 1 }} disabled={!checks.ok} onClick={() => setStep("order")} title={checks.ok ? "" : t.designer.fixChecks}>
                  {checks.ok ? `${t.designer.next} →` : t.designer.fixChecks}
                </button>
              </div>
            </>
          )}
        </section>
      )}

      {step === "order" && design && (
        <section className="stack">
          <LabelView design={design} size={size} segment={effSegment} reg={reg} minTextPt={minPt} lang={lang} resolveImage={resolveImage} fontTick={fontTick} idPrefix="sum" />
          <div className="card stack">
            <div className="ink" style={{ fontWeight: 600 }}>{lang === "ta" ? product.nameTa : product.nameEn}</div>
            <label className="field">
              <span>
                {t.order.quantity} ({product.unit === "case" ? t.order.casesOf : t.order.labels})
              </span>
              <div className="row" style={{ flexWrap: "nowrap" }}>
                <button type="button" className="btn btn-ghost" onClick={() => setQty((q) => Math.max(product.minQty, q - product.qtyStep))} aria-label="−">−</button>
                <input className="input" style={{ textAlign: "center" }} type="number" inputMode="numeric" min={product.minQty} step={product.qtyStep} value={qty} onChange={(e) => setQty(Math.max(0, Math.floor(Number(e.target.value) || 0)))} />
                <button type="button" className="btn btn-ghost" onClick={() => setQty((q) => q + product.qtyStep)} aria-label="+">+</button>
              </div>
              <span className="hint">
                {t.product.minOrder}: {product.minQty} {product.unit === "case" ? t.product.cases : t.order.labels}
                {product.unit === "case" && ` · ${qty * product.caseSize} ${t.order.bottles}`}
              </span>
              {qErr && <span className="error-text">{qErr}</span>}
            </label>
            <label className="field">
              <span>{t.order.deliveryDate}</span>
              <input className="input" type="date" min={earliestDelivery(new Date(), 1)} value={date} onChange={(e) => setDate(e.target.value)} />
              <span className="hint">{t.order.earliest}: {earliestDelivery(new Date(), 1)} (Salem area)</span>
            </label>
            <div className="row between ink" style={{ fontWeight: 600, fontSize: "1.15rem" }}>
              <span>{t.order.total}</span>
              <span>{formatInr(pricing.totalPaise)}</span>
            </div>
            <div className="tiny muted">{t.product.gstIncl}</div>
            {product.bottleType === "glass" && <div className="note small">🫧 {GLASS_PACKING_NOTE[lang]}</div>}
            {sellable && <div className="note note-warn small">{t.product.notSellable}</div>}
            {hasLocalImages && <div className="note note-warn small">{lang === "ta" ? "ஆர்டர் செய்ய உள்நுழைந்து புகைப்படத்தை மீண்டும் பதிவேற்றவும்." : "Sign in and upload your photo again so we can print it."}</div>}
            <button type="button" className="btn btn-coral btn-block" onClick={toCart} disabled={Boolean(qErr) || !checks?.ok}>
              {t.order.addToCart}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

function ColorInput({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="row" style={{ gap: 6 }}>
      <input type="color" value={value} onChange={(e) => onChange(e.target.value.toUpperCase())} style={{ width: 44, height: 38, border: "1px solid var(--line)", borderRadius: 8, padding: 2, background: "#fff" }} aria-label="Colour" />
      {SWATCHES.map((c) => (
        <button key={c} type="button" onClick={() => onChange(c)} aria-label={c} style={{ width: 24, height: 24, borderRadius: 6, background: c, border: c === value ? "2px solid var(--purple)" : "1px solid var(--line)", cursor: "pointer" }} />
      ))}
    </div>
  );
}

function Inspector({ el, onChange, onDelete, onLayer }: { el: DesignElement; onChange: (p: Partial<DesignElement>) => void; onDelete: () => void; onLayer: (dir: number) => void }) {
  const { t, lang } = useI18n();
  return (
    <div className="card stack">
      <div className="row between">
        <div className="label">✎ {el.name ?? el.type}</div>
        <div className="row" style={{ gap: 4 }}>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => onLayer(1)} title={t.designer.bringFront}>⬆</button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => onLayer(-1)} title={t.designer.sendBack}>⬇</button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onDelete} style={{ color: "var(--err)" }}>{t.designer.delete}</button>
        </div>
      </div>
      {el.type === "text" && (
        <>
          <textarea className="textarea" rows={2} value={el.text} onChange={(e) => onChange({ text: e.target.value })} aria-label={t.designer.text} maxLength={300} style={{ fontFamily: `'${FONTS[el.font].family}', 'Noto Sans Tamil'` }} />
          <div className="grid grid-2">
            <label className="field">
              <span>{t.designer.font}</span>
              <select className="select" value={el.font} onChange={(e) => { const f = e.target.value as FontId; onChange({ font: f, weight: nearestWeight(f, el.weight) }); }}>
                {FONT_IDS.map((f) => (
                  <option key={f} value={f}>{FONTS[f].label}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>{t.designer.size2}: {el.sizePt} pt</span>
              <input type="range" min={6} max={72} step={1} value={el.sizePt} onChange={(e) => onChange({ sizePt: Number(e.target.value) })} />
            </label>
          </div>
          <div className="row">
            <div className="seg">
              {(FONTS[el.font].weights as readonly number[]).map((w) => (
                <button key={w} type="button" aria-pressed={el.weight === w} onClick={() => onChange({ weight: w })} style={{ fontWeight: w }}>
                  {w >= 700 ? "B" : w >= 500 ? "M" : "R"}
                </button>
              ))}
            </div>
            <div className="seg">
              {(["left", "center", "right"] as const).map((a) => (
                <button key={a} type="button" aria-pressed={el.align === a} onClick={() => onChange({ align: a })} aria-label={a}>
                  {a === "left" ? "⟸" : a === "center" ? "≡" : "⟹"}
                </button>
              ))}
            </div>
            <label className="check small"><input type="checkbox" checked={Boolean(el.uppercase)} onChange={(e) => onChange({ uppercase: e.target.checked })} /> ABC</label>
          </div>
          <ColorInput value={el.color} onChange={(c) => onChange({ color: c })} />
        </>
      )}
      {el.type === "motif" && (
        <>
          <select className="select" value={el.motif} onChange={(e) => onChange({ motif: e.target.value as MotifId })}>
            {MOTIF_IDS.map((m) => (
              <option key={m} value={m}>{MOTIFS[m][lang]}</option>
            ))}
          </select>
          <ColorInput value={el.color} onChange={(c) => onChange({ color: c })} />
          <ColorInput value={el.color2 ?? el.color} onChange={(c) => onChange({ color2: c })} />
        </>
      )}
      {el.type === "shape" && (
        <>
          <ColorInput value={el.fill ?? "#FFFFFF"} onChange={(c) => onChange({ fill: c })} />
          <div className="seg">
            {(["rect", "ellipse", "line"] as const).map((s) => (
              <button key={s} type="button" aria-pressed={el.shape === s} onClick={() => onChange({ shape: s })}>{s === "rect" ? "▭" : s === "ellipse" ? "◯" : "—"}</button>
            ))}
          </div>
        </>
      )}
      {el.type === "image" && (
        <div className="row">
          <div className="seg">
            <button type="button" aria-pressed={el.fit === "contain"} onClick={() => onChange({ fit: "contain" })}>Fit</button>
            <button type="button" aria-pressed={el.fit === "cover"} onClick={() => onChange({ fit: "cover" })}>Fill</button>
          </div>
          <label className="check small"><input type="checkbox" checked={Boolean(el.circle)} onChange={(e) => onChange({ circle: e.target.checked })} /> ◯</label>
        </div>
      )}
      <p className="tiny muted" style={{ margin: 0 }}>{lang === "ta" ? "நகர்த்த இழுக்கவும்; அளவை மாற்ற மூலைப் புள்ளியை இழுக்கவும்." : "Drag to move; drag the corner dot to resize."}</p>
    </div>
  );
}
