import type { MetadataRoute } from "next";
import { canonicalUrl as canonicalSiteUrl } from "@/lib/app-url";

const base = canonicalSiteUrl();

/**
 * Public, indexable pages only.
 *
 * /login and /signup are deliberately absent. They were listed before, but a
 * sitemap is a statement about what should RANK, and a sign-in form competing
 * with the homepage for the brand query is a worse result for someone searching
 * "kindpath" than the homepage is. robots.txt still allows them, so they remain
 * crawlable and reachable — they just aren't nominated.
 *
 * Org giving pages (/give/[slug]) are not listed either: they belong to
 * individual charities, they come and go, and enumerating them here would put
 * KindPath's sitemap in charge of a customer's indexing.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const pages: { path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] }[] = [
    { path: "", priority: 1.0, changeFrequency: "weekly" },
    { path: "/contact", priority: 0.7, changeFrequency: "monthly" },
    { path: "/privacy", priority: 0.4, changeFrequency: "yearly" },
    { path: "/terms", priority: 0.4, changeFrequency: "yearly" },
    { path: "/dpa", priority: 0.3, changeFrequency: "yearly" },
  ];

  return pages.map(({ path, priority, changeFrequency }) => ({
    url: `${base}${path}`,
    lastModified: now,
    changeFrequency,
    priority,
  }));
}
