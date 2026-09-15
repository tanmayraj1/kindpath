import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/observability", () => ({ captureError: vi.fn() }));
vi.mock("@/lib/qr", () => ({ givingPageUrl: (slug: string) => `https://www.kind-path.org/give/${slug}` }));

import { sendOnboardingCompleteEmail } from "./onboarding-email";
import { captureError } from "@/lib/observability";

const ARGS = {
  to: "admin@stmarys.ca",
  name: "<b>Grace</b> Hopper",
  orgName: "St. Mary's",
  slug: "st-marys",
  orgId: "org_1",
};

describe("sendOnboardingCompleteEmail", () => {
  let sent: { to: string; subject: string; html: string }[];

  beforeEach(() => {
    sent = [];
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        sent.push(JSON.parse(String(init.body)));
        return new Response(JSON.stringify({ id: "em_1" }));
      })
    );
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("sends the giving link to the admin who finished setup", async () => {
    await expect(sendOnboardingCompleteEmail({ ...ARGS, gatewayConnected: true })).resolves.toBe(true);
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe("admin@stmarys.ca");
    expect(sent[0].subject).toBe("St. Mary's is set up on KindPath");
    expect(sent[0].html).toContain("https://www.kind-path.org/give/st-marys");
    expect(sent[0].html).toContain("Payments are connected");
  });

  it("tells an admin who skipped the gateway that the page takes no payments yet", async () => {
    await sendOnboardingCompleteEmail({ ...ARGS, gatewayConnected: false });
    expect(sent[0].html).toContain("connect payments");
    expect(sent[0].html).toContain("Settings → Payments");
  });

  it("escapes names typed at signup", async () => {
    await sendOnboardingCompleteEmail({ ...ARGS, gatewayConnected: true });
    expect(sent[0].html).not.toContain("<b>");
  });

  it("reports a rejected send instead of throwing, so finishing setup never fails on mail", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("domain not verified", { status: 403 })));
    await expect(sendOnboardingCompleteEmail({ ...ARGS, gatewayConnected: true })).resolves.toBe(false);
    expect(captureError).toHaveBeenCalled();
  });
});
