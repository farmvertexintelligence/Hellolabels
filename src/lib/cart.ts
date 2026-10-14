"use client";
import type { Segment } from "@/lib/catalog/types";
import type { Design } from "@/lib/design/types";

export interface CartItem {
  key: string;
  productId: string;
  labelSizeId: string;
  segment: Segment;
  qty: number;
  design: Design;
  designId?: string | null;
  addedAt: number;
}

export interface CartState {
  items: CartItem[];
  deliveryDate?: string;
}

const KEY = "hl_cart_v1";
const EVT = "hl-cart";

export function readCart(): CartState {
  if (typeof window === "undefined") return { items: [] };
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "null");
    return v && Array.isArray(v.items) ? v : { items: [] };
  } catch {
    return { items: [] };
  }
}

export function writeCart(c: CartState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(c));
  } catch {
    /* storage full or blocked — cart lives for this page only */
  }
  window.dispatchEvent(new Event(EVT));
}

export function addToCart(item: Omit<CartItem, "key" | "addedAt">, deliveryDate?: string) {
  const c = readCart();
  c.items.push({ ...item, key: Math.random().toString(36).slice(2), addedAt: Date.now() });
  if (deliveryDate) c.deliveryDate = deliveryDate;
  writeCart(c);
}

export function updateItem(key: string, patch: Partial<CartItem>) {
  const c = readCart();
  c.items = c.items.map((i) => (i.key === key ? { ...i, ...patch } : i));
  writeCart(c);
}

export function removeItem(key: string) {
  const c = readCart();
  c.items = c.items.filter((i) => i.key !== key);
  writeCart(c);
}

export const clearCart = () => writeCart({ items: [] });
export const cartCount = () => readCart().items.length;

export function onCartChange(fn: () => void) {
  window.addEventListener(EVT, fn);
  window.addEventListener("storage", fn);
  return () => {
    window.removeEventListener(EVT, fn);
    window.removeEventListener("storage", fn);
  };
}
