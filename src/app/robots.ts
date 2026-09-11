import type { MetadataRoute } from "next";
import { canonicalUrl as canonicalSiteUrl } from "@/lib/app-url";

const base = canonicalSiteUrl();

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/give/", "/c/", "/contact", "/login", "/signup"],
      disallow: ["/dashboard", "/admin", "/portal", "/r/", "/api/"],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
