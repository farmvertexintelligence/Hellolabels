import Link from "next/link";
import { getUser } from "@/lib/server/auth";
import { getDict } from "@/lib/i18n/server";
import { CartButton, LangToggle, MobileMenu } from "./HeaderClient";
import { Logo } from "./Squares";

export async function SiteHeader() {
  const { t } = await getDict();
  const user = await getUser().catch(() => null);
  const home = user?.role === "admin" ? "/admin" : user?.role === "dealer" ? "/dealer" : user?.role === "driver" ? "/driver" : "/account";
  const links = [
    { href: "/products", label: t.nav.products },
    { href: "/design", label: t.nav.design },
    { href: "/templates", label: t.nav.templates },
    { href: "/track", label: t.nav.track },
    { href: "/dealer/apply", label: t.nav.dealers },
  ];
  return (
    <header className="site-header">
      <div className="wrap bar" style={{ position: "relative" }}>
        <Logo />
        <nav className="nav" aria-label="Main">
          {links.map((l) => (
            <Link key={l.href} href={l.href}>
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="header-actions">
          <LangToggle />
          <Link href={user ? home : "/login"} className="icon-btn" aria-label={user ? t.nav.account : t.nav.login}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
            </svg>
          </Link>
          <CartButton />
          <MobileMenu links={[...links, { href: user ? home : "/login", label: user ? t.nav.account : t.nav.login }]} />
        </div>
      </div>
    </header>
  );
}
