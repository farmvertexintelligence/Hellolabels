import "server-only";
import { ZodError } from "zod";
import { HttpError } from "../auth";

export interface ActionResult {
  ok: boolean;
  msg: string;
}

/** Runs a server action body and turns any error into a message for the form. */
export async function run(fn: () => Promise<string>): Promise<ActionResult> {
  try {
    return { ok: true, msg: await fn() };
  } catch (e) {
    if (e instanceof HttpError) return { ok: false, msg: e.message };
    if (e instanceof ZodError) return { ok: false, msg: e.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
    if (e && typeof e === "object" && "digest" in e) throw e; // let Next.js redirects/notFound through
    console.error(e);
    return { ok: false, msg: e instanceof Error ? e.message : "Something went wrong" };
  }
}

export const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
export const num = (fd: FormData, k: string) => Number(str(fd, k));
/** "₹12.50" / "12.5" → 1250 paise */
export const paise = (fd: FormData, k: string) => Math.round(Number(str(fd, k).replace(/[₹,\s]/g, "")) * 100);
