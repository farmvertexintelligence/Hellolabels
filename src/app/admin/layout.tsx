import type { Metadata } from "next";
import { features } from "@/lib/env";
import { requireRole } from "@/lib/server/auth";
import { AdminNav } from "./AdminNav";

export const metadata: Metadata = { title: "Admin", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!features.serviceRole) {
    return <div className="wrap section"><div className="note note-warn">Connect Supabase (see README) to use the admin panel.</div></div>;
  }
  await requireRole(["admin"], "/admin");
  return (
    <div className="wrap admin-shell">
      <AdminNav />
      {children}
    </div>
  );
}
