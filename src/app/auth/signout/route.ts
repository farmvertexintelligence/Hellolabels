import { NextResponse } from "next/server";
import { features } from "@/lib/env";
import { supabaseUser } from "@/lib/supabase/server";

export async function POST(req: Request) {
  if (features.supabase) await (await supabaseUser()).auth.signOut();
  return NextResponse.redirect(new URL("/", req.url), { status: 303 });
}
