"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n/client";
import { cartCount, onCartChange } from "@/lib/cart";

export function LangToggle() {
  const { lang, setLang, t } = useI18n();
  return (
    <button type="button" className="icon-btn lang-btn" onClick={() => setLang(lang === "en" ? "ta" : "en")} aria-label="Switch language / மொழியை மாற்று">
      {t.nav.langSwitch}
    </button>
  );
}

export function CartButton() {
  const { t } = useI18n();
  const [n, setN] = useState(0);
  useEffect(() => {
    setN(cartCount());
    return onCartChange(() => setN(cartCount()));
  }, []);
  return (
    <Link href="/cart" className="icon-btn" aria-label={`${t.nav.cart} (${n})`}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M5 7h14l-1.2 11.1a2 2 0 0 1-2 1.9H8.2a2 2 0 0 1-2-1.9L5 7Z" />
        <path d="M9 7V6a3 3 0 0 1 6 0v1" />
      </svg>
      {n > 0 && <span className="badge">{n}</span>}
    </Link>
  );
}

export function MobileMenu({ links }: { links: { href: string; label: string }[] }) {
  const [open, setOpen] = useState(false);
  const { t } = useI18n();
  return (
    <>
      <button type="button" className="icon-btn only-mobile" aria-expanded={open} aria-controls="mobile-menu" onClick={() => setOpen(!open)}>
        <span className="sr-only">{t.nav.menu}</span>
        <svg width="22" height="22" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
          {open ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
        </svg>
      </button>
      {open && (
        <nav id="mobile-menu" className="mobile-menu only-mobile" style={{ position: "absolute", left: 0, right: 0, top: 64, background: "var(--paper)", padding: "8px 16px 16px" }} onClick={() => setOpen(false)}>
          {links.map((l) => (
            <Link key={l.href} href={l.href}>
              {l.label}
            </Link>
          ))}
        </nav>
      )}
    </>
  );
}
