import type { MetadataRoute } from "next";
import { env } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/dealer", "/driver", "/account", "/checkout", "/cart", "/orders", "/api/", "/login"] }],
    sitemap: `${env.siteUrl.replace(/\/$/, "")}/sitemap.xml`,
  };
}
