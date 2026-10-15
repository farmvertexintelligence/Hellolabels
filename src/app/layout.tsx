import type { Metadata, Viewport } from "next";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { ScrollFx } from "@/components/motion/ScrollFx";
import { LangProvider } from "@/lib/i18n/client";
import { getLang } from "@/lib/i18n/server";
import { env } from "@/lib/env";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(env.siteUrl),
  title: { default: "hellolabels — custom labelled water bottles & labels, Mettur", template: "%s · hellolabels" },
  description:
    "Packaged drinking water bottles with your own label for weddings, birthdays, temple festivals and shops. AI label designer in English and Tamil. Printed in Mettur, delivered across Tamil Nadu.",
  applicationName: "hellolabels",
  openGraph: { type: "website", siteName: "hellolabels", locale: "en_IN", alternateLocale: ["ta_IN"] },
  icons: { icon: "/icon.svg" },
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = { themeColor: "#F6F3EC", width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const lang = await getLang();
  return (
    <html lang={lang}>
      <head>
        <link rel="preload" href="/fonts/core.css" as="style" />
        {/* Self-hosted font faces split by unicode-range: Tamil files load only when Tamil text is shown. */}
        {/* eslint-disable-next-line @next/next/no-css-tags */}
        <link rel="stylesheet" href="/fonts/core.css" />
      </head>
      <body>
        <LangProvider lang={lang}>
          <ScrollFx />
          <SiteHeader />
          <main id="main">{children}</main>
          <SiteFooter />
        </LangProvider>
      </body>
    </html>
  );
}
