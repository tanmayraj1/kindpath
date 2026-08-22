import { describe, it, expect } from "vitest";
import { emailLayout, brandHex } from "./email";

describe("emailLayout white-labeling", () => {
  it("uses the org name, brand color, and 'powered by' footer when branded", () => {
    const html = emailLayout({
      heading: "Hi",
      body: "Body",
      cta: { label: "Go", url: "https://x" },
      brand: { orgName: "St. Mary's Parish", brandColor: "#0d9488" },
    });
    expect(html).toContain("#0d9488"); // brand color applied
    expect(html).toContain("St. Mary's Parish");
    expect(html).toContain("powered by KindPath");
  });

  it("falls back to KindPath styling + brand teal when unbranded", () => {
    const html = emailLayout({ heading: "Hi", body: "Body" });
    expect(html).toContain("Kind");
    expect(html).toContain(brandHex(null));
  });

  it("ignores an invalid brand color (falls back to default)", () => {
    const html = emailLayout({ heading: "Hi", body: "Body", brand: { brandColor: "not-a-color" } });
    expect(html).toContain(brandHex(null));
  });
});
