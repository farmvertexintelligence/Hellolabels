import Link from "next/link";
import { DISTRICTS } from "@/lib/districts";
import { getDict } from "@/lib/i18n/server";
import { whatsappLink } from "@/lib/contact";
import { Logo } from "./Squares";

export async function SiteFooter() {
  const { t, lang } = await getDict();
  const wa = whatsappLink("Hello hellolabels, I would like to order custom labelled bottles.");
  return (
    <>
      <footer className="site-footer">
        <div className="wrap grid grid-4" style={{ gap: 32 }}>
          <div className="stack">
            <Logo />
            <p className="small" style={{ color: "#c9ccd3" }}>{t.brandTagline}</p>
            <address className="small" style={{ fontStyle: "normal" }}>
              {t.footer.address}
            </address>
            {wa && (
              <a className="btn btn-sm" style={{ background: "#25d366", borderColor: "#25d366", color: "#08311a" }} href={wa} target="_blank" rel="noopener">
                {t.footer.whatsapp}
              </a>
            )}
          </div>
          <div>
            <h4>{t.nav.products}</h4>
            <ul className="footer-links">
              <li><Link href="/products">{t.product.allProducts}</Link></li>
              <li><Link href="/design">{t.nav.design}</Link></li>
              <li><Link href="/templates">{t.nav.templates}</Link></li>
              <li><Link href="/track">{t.nav.track}</Link></li>
              <li><Link href="/dealer/apply">{t.nav.dealers}</Link></li>
            </ul>
          </div>
          <div>
            <h4>{t.footer.districts}</h4>
            <ul className="footer-links" style={{ gridTemplateColumns: "1fr 1fr" }}>
              {DISTRICTS.filter((d) => d.zone === 1 || ["CBE", "MDU", "TRY", "CHN"].includes(d.code)).map((d) => (
                <li key={d.code}><Link href={`/districts/${d.slug}`}>{lang === "ta" ? d.ta : d.en}</Link></li>
              ))}
              <li><Link href="/districts">+ {DISTRICTS.length}</Link></li>
            </ul>
          </div>
          <div>
            <h4>hellolabels</h4>
            <ul className="footer-links">
              <li><Link href="/privacy">{t.footer.privacy}</Link></li>
              <li><Link href="/refund-policy">{t.footer.refund}</Link></li>
              <li><Link href="/terms">{t.footer.terms}</Link></li>
            </ul>
          </div>
        </div>
        <div className="wrap tiny" style={{ marginTop: 32, color: "#8b909b" }}>
          © {new Date().getFullYear()} hellolabels. {t.footer.rights}
        </div>
      </footer>
      {wa && (
        <a className="wa-fab no-print" href={wa} target="_blank" rel="noopener" aria-label={t.footer.whatsapp}>
          <svg width="28" height="28" viewBox="0 0 32 32" fill="currentColor" aria-hidden="true">
            <path d="M16 3a13 13 0 0 0-11.2 19.6L3 29l6.6-1.7A13 13 0 1 0 16 3Zm0 23.7c-2 0-4-.6-5.7-1.6l-.4-.2-3.9 1 1-3.8-.3-.4A10.7 10.7 0 1 1 16 26.7Zm5.9-8c-.3-.2-1.9-.9-2.2-1-.3-.1-.5-.2-.7.2l-1 1.2c-.2.2-.4.2-.7.1a8.8 8.8 0 0 1-4.4-3.8c-.3-.6.3-.5 1-1.7.1-.2 0-.4 0-.6l-1-2.4c-.3-.6-.5-.5-.7-.5h-.6c-.2 0-.6.1-.9.4-.3.3-1.2 1.1-1.2 2.8s1.2 3.2 1.4 3.5c.2.2 2.4 3.7 5.8 5.1 2.2.9 3 1 4.1.8.7-.1 1.9-.8 2.2-1.5.3-.8.3-1.4.2-1.5l-.6-.3Z" />
          </svg>
        </a>
      )}
    </>
  );
}
