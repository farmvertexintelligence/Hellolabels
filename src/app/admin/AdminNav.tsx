"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  ["/admin", "Dashboard"],
  ["/admin/orders", "Orders"],
  ["/admin/production", "Print · Pack · Stock"],
  ["/admin/trips", "Trucks & routes"],
  ["/admin/catalog", "Prices & sizes"],
  ["/admin/settings", "Regulatory & settings"],
  ["/admin/dealers", "Dealers"],
  ["/admin/ads", "Ad bookings"],
  ["/admin/customers", "Customers & staff"],
  ["/admin/reports", "Reports"],
] as const;

export function AdminNav() {
  const path = usePathname();
  return (
    <nav className="admin-nav" aria-label="Admin">
      {LINKS.map(([href, label]) => (
        <Link key={href} href={href} aria-current={(href === "/admin" ? path === href : path.startsWith(href)) ? "page" : undefined}>
          {label}
        </Link>
      ))}
    </nav>
  );
}
