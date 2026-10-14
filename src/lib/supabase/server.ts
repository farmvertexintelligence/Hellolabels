import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { env, features } from "@/lib/env";

/** Supabase client acting as the signed-in user (RLS applies). */
export async function supabaseUser(): Promise<SupabaseClient> {
  if (!features.supabase) throw new Error("Supabase is not configured");
  const store = await cookies();
  return createServerClient(env.supabaseUrl!, env.supabaseAnonKey!, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // Called from a Server Component: cookies are refreshed by middleware instead.
        }
      },
    },
  });
}

let admin: SupabaseClient | null = null;

/** Service-role client: bypasses RLS. Server only, and only after the caller's role is checked. */
export function supabaseAdmin(): SupabaseClient {
  if (!features.serviceRole) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
  admin ??= createClient(env.supabaseUrl!, env.supabaseServiceKey!, { auth: { persistSession: false, autoRefreshToken: false } });
  return admin;
}
