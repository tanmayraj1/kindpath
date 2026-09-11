import type { Metadata } from "next";
import { Inter, Instrument_Sans } from "next/font/google";
import "./globals.css";
import { canonicalUrl as canonicalSiteUrl } from "@/lib/app-url";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

/**
 * Display face. The design calls for General Sans, which is a Fontshare release —
 * next/font/google cannot fetch it, and self-hosting it means committing licensed
 * binaries to the repo. Instrument Sans is the named fallback and is on Google
 * Fonts: same tight editorial grotesque, same tone. Swap in General Sans by
 * dropping the woff2 files into src/app/fonts and switching to next/font/local —
 * nothing else has to change, because everything reads --font-display.
 */
const display = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  weight: ["500", "600", "700"],
});

const SITE = canonicalSiteUrl();

export const metadata: Metadata = {
  // metadataBase is what makes every relative OG/canonical URL resolve to an
  // absolute one. Without it Next emits relative og:image paths, which crawlers
  // and every social unfurler silently drop — the tags look present in the HTML
  // and do nothing.
  metadataBase: new URL(SITE),
  title: {
    default: "KindPath — Donation management for Canadian faith communities",
    template: "%s · KindPath",
  },
  description:
    "KindPath helps temples, churches, and mosques across Canada collect donations, automate recurring giving, and issue CRA-compliant tax receipts — beautifully.",
  applicationName: "KindPath",
  // The apex 308-redirects to www, so the canonical host is already settled at
  // the edge; declaring it here stops any stray absolute link from splitting
  // authority between the two.
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "KindPath",
    locale: "en_CA",
    url: SITE,
    title: "KindPath — Donation management for Canadian faith communities",
    description:
      "Collect one-time and recurring donations, issue CRA-compliant tax receipts automatically, and manage every donor — from one branded platform.",
  },
  twitter: {
    card: "summary_large_image",
    title: "KindPath — Donation management for Canadian faith communities",
    description:
      "CRA-compliant receipts, recurring giving and a donor portal, built for Canadian temples, churches and mosques.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${display.variable}`}>
      <body>{children}</body>
    </html>
  );
}
