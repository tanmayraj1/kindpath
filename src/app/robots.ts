import type { MetadataRoute } from "next";

const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

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
