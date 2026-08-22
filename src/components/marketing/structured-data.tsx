import { PLANS, planPrice } from "@/lib/plans";

const SITE = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.kind-path.org";

/**
 * JSON-LD for the marketing pages.
 *
 * The single highest-value line here is `alternateName`. The product is written
 * "KindPath" but people search "kind path" and "kind-path" — three strings a
 * search engine has no reason to treat as one entity unless told. Declaring them
 * as names of the same Organization is what lets a query for any of them resolve
 * to this site rather than to unrelated pages that happen to contain the words.
 *
 * Everything asserted below is checkable. There are no aggregateRating or review
 * fields: this product has no customers yet, inventing ratings is a manual-action
 * risk with Google, and it is the same class of claim already removed twice from
 * the landing page.
 *
 * Rendered as a plain <script> rather than next/script because structured data
 * must be in the initial HTML — a crawler that does not execute JS will not see
 * anything injected later.
 */
export function StructuredData() {
  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${SITE}/#organization`,
        name: "KindPath",
        alternateName: ["Kind Path", "kind-path", "KindPath Canada"],
        url: SITE,
        description:
          "Donation management for Canadian faith communities — CRA-compliant tax receipts, recurring giving and a donor portal.",
        areaServed: { "@type": "Country", name: "Canada" },
        knowsLanguage: ["en-CA", "fr-CA"],
      },
      {
        "@type": "WebSite",
        "@id": `${SITE}/#website`,
        url: SITE,
        name: "KindPath",
        alternateName: "Kind Path",
        publisher: { "@id": `${SITE}/#organization` },
        inLanguage: "en-CA",
      },
      {
        "@type": "SoftwareApplication",
        "@id": `${SITE}/#software`,
        name: "KindPath",
        applicationCategory: "BusinessApplication",
        applicationSubCategory: "Donation management",
        operatingSystem: "Web",
        url: SITE,
        publisher: { "@id": `${SITE}/#organization` },
        featureList: [
          "CRA-compliant tax receipts",
          "Recurring giving with automatic retries",
          "Fund and designation tracking",
          "Donor self-service portal",
          "CASL consent tracking",
          "QR code giving",
        ],
        // Read from the catalog, not restated: this block used to hard-code the
        // annual-billed per-month equivalents (24/49/166) as "monthly subscription"
        // prices while src/lib/plans.ts billed 29/59/199 — a lower price than the
        // one charged, asserted to search engines. Both cycles are listed, each
        // labelled with its own billing increment.
        offers: PLANS.flatMap((p) => [
          {
            "@type": "Offer",
            name: `${p.name} (monthly)`,
            price: String(planPrice(p.key, "monthly")),
            priceCurrency: "CAD",
            priceSpecification: {
              "@type": "UnitPriceSpecification",
              price: String(planPrice(p.key, "monthly")),
              priceCurrency: "CAD",
              billingIncrement: 1,
              unitCode: "MON",
            },
          },
          {
            "@type": "Offer",
            name: `${p.name} (annual)`,
            price: String(planPrice(p.key, "annual")),
            priceCurrency: "CAD",
            priceSpecification: {
              "@type": "UnitPriceSpecification",
              price: String(planPrice(p.key, "annual")),
              priceCurrency: "CAD",
              billingIncrement: 1,
              unitCode: "ANN",
            },
          },
        ]),
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      // Serialised with JSON.stringify, so every value is escaped — none of this
      // is user input today, and this keeps it safe if any of it later becomes so.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }}
    />
  );
}
