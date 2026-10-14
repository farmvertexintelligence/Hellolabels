import "server-only";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { features } from "@/lib/env";
import { supabaseAdmin, supabaseUser } from "@/lib/supabase/server";

export type Role = "customer" | "dealer" | "driver" | "admin";

export interface SessionUser {
  id: string;
  phone: string | null;
  role: Role;
  fullName: string | null;
  gstin: string | null;
  districtCode: string | null;
}

/** The signed-in user with their role from `profiles` (never from the browser), or null. */
export async function getUser(): Promise<SessionUser | null> {
  if (!features.supabase) return null;
  const sb = await supabaseUser();
  const { data } = await sb.auth.getUser();
  if (!data.user) return null;
  const db = features.serviceRole ? supabaseAdmin() : sb;
  const { data: p } = await db.from("profiles").select("role, full_name, phone, gstin, district_code").eq("id", data.user.id).maybeSingle();
  return {
    id: data.user.id,
    phone: p?.phone ?? data.user.phone ?? null,
    role: (p?.role as Role) ?? "customer",
    fullName: p?.full_name ?? null,
    gstin: p?.gstin ?? null,
    districtCode: p?.district_code ?? null,
  };
}

/** For pages: send signed-out visitors to the OTP login, and wrong roles home. */
export async function requireRole(roles: Role[] | null, next: string): Promise<SessionUser> {
  const user = await getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  if (roles && !roles.includes(user.role)) redirect("/?denied=1");
  return user;
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** For API routes: throws HttpError 401/403 instead of redirecting. */
export async function apiUser(roles: Role[] | null = null): Promise<SessionUser> {
  const user = await getUser();
  if (!user) throw new HttpError(401, "Please sign in");
  if (roles && !roles.includes(user.role)) throw new HttpError(403, "Not allowed");
  return user;
}

/** Wraps an API handler: HttpError → JSON error with its status; anything else → 500 (logged). */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (e) {
      if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
      if (e instanceof ZodError) {
        const i = e.issues[0];
        return NextResponse.json({ error: `${i.path.join(".") || "input"}: ${i.message}` }, { status: 400 });
      }
      console.error(e);
      return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
    }
  };
}

export async function audit(actorId: string | null, action: string, entity: string, entityId: string | null, meta?: Record<string, unknown>) {
  if (!features.serviceRole) return;
  await supabaseAdmin().from("audit_log").insert({ actor_id: actorId, action, entity, entity_id: entityId, meta: meta ?? null });
}
