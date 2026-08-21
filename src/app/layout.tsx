import type { Metadata } from "next";
import { Inter, Instrument_Sans } from "next/font/google";
import "./globals.css";

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

export const metadata: Metadata = {
  title: {
    default: "KindPath — Donation management for faith communities",
    template: "%s · KindPath",
  },
  description:
    "KindPath helps temples, churches, and mosques across Canada collect donations, automate recurring giving, and issue CRA-compliant tax receipts — beautifully.",
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
