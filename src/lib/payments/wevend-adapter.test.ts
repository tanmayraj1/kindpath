import { describe, it, expect, vi } from "vitest";
import { WeVendAdapter } from "./wevend-adapter";

const CONFIG = {
  baseUrl: "https://api.wevend.dev",
  iframeUrl: "https://iframe.wevend.dev",
  mid: "RCTST1234567890",
  email: "merchant@example.com",
  password: "Password1",
  termId: "00000003",
};

function jsonResponse(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

const AUTH_OK = jsonResponse({
  success: true,
  message: "Merchant logged in and token created successfully!",
  data: { accessToken: "access-tok-1", refreshToken: "refresh-tok-1", role: "admin" },
});

/** Route a mock fetch by URL suffix; records calls for assertions. */
function router(routes: Record<string, () => Response>) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const impl = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    const u = String(url);
    calls.push({ url: u, init });
    const key = Object.keys(routes).find((k) => u.endsWith(k));
    if (!key) throw new Error(`unrouted: ${u}`);
    return routes[key]();
  }) as unknown as typeof fetch;
  return { impl, calls };
}

function adapter(fetchImpl: typeof fetch) {
  return new WeVendAdapter({ ...CONFIG, fetchImpl });
}

describe("WeVendAdapter config", () => {
  it("accepts a base URL given with or without the /api suffix", async () => {
    // WeVend's FAQ quotes the base as ".../api"; their endpoint tables quote paths
    // that already start with "/api". Taken together that yields "/api/api/...".
    for (const base of ["https://wepay.wevend.dev", "https://wepay.wevend.dev/api", "https://wepay.wevend.dev/api/"]) {
      const { impl, calls } = router({
        "/api/auth/token": () => AUTH_OK,
        "/api/payments/sale": () => jsonResponse({ success: true, data: { paymentOrderId: "po" } }),
      });
      const a = new WeVendAdapter({ ...CONFIG, baseUrl: base, fetchImpl: impl });
      await a.beginHostedSale({
        orgId: "o",
        money: { amount: 1, currency: "CAD" },
        redirectUrl: "https://x/response",
      });
      const sale = calls.find((c) => c.url.includes("/payments/sale"))!;
      expect(sale.url, `base ${base}`).toBe("https://wepay.wevend.dev/api/payments/sale");
    }
  });

  it("throws without required credentials", () => {
    expect(() => new WeVendAdapter({ baseUrl: "", fetchImpl: vi.fn() as unknown as typeof fetch })).toThrow(
      /requires WEVEND/
    );
  });
});

describe("auth", () => {
  it("uses org-token auth (wvNumber) when in org mode", async () => {
    const { impl, calls } = router({
      "/api/auth/org-token": () => AUTH_OK,
      "/api/payments/sale": () =>
        jsonResponse({ success: true, data: { paymentOrderId: "po_org" } }),
    });
    const a = new WeVendAdapter({
      baseUrl: "https://wepay.wevend.dev",
      iframeUrl: "https://iframe.wevend.dev",
      wvNumber: "WV-ISV-50001",
      password: "password123",
      mid: "KPTEST0001",
      termId: "00000003",
      fetchImpl: impl,
    });
    await a.beginHostedSale({ orgId: "o", money: { amount: 10, currency: "CAD" }, redirectUrl: "https://x/response" });
    const login = calls.find((c) => c.url.endsWith("/api/auth/org-token"))!;
    expect(login).toBeDefined();
    expect(JSON.parse(String(login.init?.body))).toEqual({ wvNumber: "WV-ISV-50001", password: "password123" });
    // sale still carries the merchant MID per call
    const sale = calls.find((c) => c.url.endsWith("/api/payments/sale"))!;
    expect(JSON.parse(String(sale.init?.body)).mid).toBe("KPTEST0001");
  });

  it("logs in once and reuses the token across calls", async () => {
    const { impl, calls } = router({
      "/api/auth/token": () => AUTH_OK,
      "/api/payments/sale": () =>
        jsonResponse({ success: true, data: { returnCode: 200, paymentOrderId: "po_1" } }),
    });
    const a = adapter(impl);
    await a.beginHostedSale({ orgId: "o", money: { amount: 10, currency: "CAD" }, redirectUrl: "https://x/response" });
    await a.beginHostedSale({ orgId: "o", money: { amount: 20, currency: "CAD" }, redirectUrl: "https://x/response" });
    const logins = calls.filter((c) => c.url.endsWith("/api/auth/token"));
    expect(logins).toHaveLength(1); // token cached after first login
    const loginBody = JSON.parse(String(logins[0].init?.body));
    expect(loginBody).toMatchObject({ mid: CONFIG.mid, email: CONFIG.email, password: CONFIG.password });
  });

  it("re-authenticates once on a 401 and retries", async () => {
    let saleCalls = 0;
    const { impl, calls } = router({
      "/api/auth/token": () => AUTH_OK,
      "/api/payments/sale": () => {
        saleCalls++;
        return saleCalls === 1
          ? jsonResponse({ success: false, message: "unauthorized" }, 401)
          : jsonResponse({ success: true, data: { paymentOrderId: "po_2" } });
      },
    });
    const res = await adapter(impl).beginHostedSale({
      orgId: "o",
      money: { amount: 10, currency: "CAD" },
      redirectUrl: "https://x/response",
    });
    expect(res.paymentOrderId).toBe("po_2");
    expect(calls.filter((c) => c.url.endsWith("/api/auth/token"))).toHaveLength(2); // initial + re-auth
  });
});

describe("beginHostedSale", () => {
  it("creates a sale order and returns the iframe URL", async () => {
    const { impl, calls } = router({
      "/api/auth/token": () => AUTH_OK,
      "/api/payments/sale": () =>
        jsonResponse({ success: true, data: { returnCode: 200, paymentOrderId: "687161c48dd27ade7d85ac96" } }),
    });
    const res = await adapter(impl).beginHostedSale({
      orgId: "o",
      money: { amount: 25.5, currency: "CAD" },
      redirectUrl: "https://kindpath.app/give/x/return/response",
    });
    expect(res).toEqual({
      paymentOrderId: "687161c48dd27ade7d85ac96",
      redirectTo: "https://iframe.wevend.dev/687161c48dd27ade7d85ac96/carNew",
    });
    const sale = calls.find((c) => c.url.endsWith("/api/payments/sale"))!;
    const body = JSON.parse(String(sale.init?.body));
    expect(body.amount).toBe("2550"); // cents, as string
    expect(body.mid).toBe(CONFIG.mid);
    expect(body.termId).toBe(CONFIG.termId);
    expect(body.orderId.length).toBeLessThanOrEqual(15); // WeVend constraint
    expect((sale.init?.headers as Record<string, string>).Authorization).toBe("Bearer access-tok-1");
  });
});

describe("confirmTransaction", () => {
  it("treats respCode 000 as approved and extracts card info", async () => {
    const { impl } = router({
      "/api/auth/token": () => AUTH_OK,
      "/api/payments/get-transaction/txn_1": () =>
        jsonResponse({
          success: true,
          data: {
            respCode: "000",
            detailRespData: "Approved",
            cardType: "Visa",
            cardNum: "XXXXXXXXXXXX1111",
            paymentOrderId: "po_1",
            txnType: "Authorization",
            amount: "51.75",
          },
        }),
    });
    const r = await adapter(impl).confirmTransaction("txn_1");
    expect(r).toMatchObject({
      success: true,
      providerChargeRef: "txn_1",
      paymentOrderId: "po_1",
      amount: 51.75,
      cardBrand: "Visa",
      last4: "1111",
    });
  });

  it("marks an approved sale complete, so WeVend sees the gift as fulfilled", async () => {
    const { impl, calls } = router({
      "/api/auth/token": () => AUTH_OK,
      "/api/payments/get-transaction/txn_c": () =>
        jsonResponse({ success: true, data: { respCode: "000", amount: "10.00" } }),
      "/api/payments/mark-transaction-complete": () =>
        jsonResponse({ success: true, data: { error: false } }),
    });
    await adapter(impl).confirmTransaction("txn_c");
    const mark = calls.find((c) => c.url.endsWith("/api/payments/mark-transaction-complete"));
    expect(mark, "an approved sale must be marked complete").toBeDefined();
    expect(JSON.parse(String(mark!.init?.body))).toEqual({ transactionId: "txn_c" });
  });

  it("does NOT mark a declined transaction complete", async () => {
    const { impl, calls } = router({
      "/api/auth/token": () => AUTH_OK,
      "/api/payments/get-transaction/txn_d": () =>
        jsonResponse({ success: true, data: { respCode: "005" } }),
      "/api/payments/mark-transaction-complete": () => jsonResponse({ success: true }),
    });
    await adapter(impl).confirmTransaction("txn_d");
    expect(calls.some((c) => c.url.includes("mark-transaction-complete"))).toBe(false);
  });

  it("still reports success when marking complete fails", async () => {
    // The card is charged and the receipt is issued off this result. A bookkeeping
    // call failing afterwards must never present a completed gift as a failure.
    const { impl } = router({
      "/api/auth/token": () => AUTH_OK,
      "/api/payments/get-transaction/txn_e": () =>
        jsonResponse({ success: true, data: { respCode: "000", amount: "25.00" } }),
      "/api/payments/mark-transaction-complete": () => {
        throw new Error("gateway timeout");
      },
    });
    const r = await adapter(impl).confirmTransaction("txn_e");
    expect(r.success).toBe(true);
    expect(r.amount).toBe(25);
  });

  it("treats a non-000 respCode as a decline", async () => {
    const { impl } = router({
      "/api/auth/token": () => AUTH_OK,
      "/api/payments/get-transaction/txn_2": () =>
        jsonResponse({ success: true, data: { respCode: "005", detailRespData: "Declined" } }),
    });
    const r = await adapter(impl).confirmTransaction("txn_2");
    expect(r.success).toBe(false);
    expect(r.failureCode).toBe("005");
    expect(r.failureMessage).toBe("Declined");
  });
});

describe("charge (sale-with-token, recurring)", () => {
  it("maps returnCode 000 to success", async () => {
    const { impl, calls } = router({
      "/api/auth/token": () => AUTH_OK,
      "/api/payments/sale-with-token": () =>
        jsonResponse({ success: true, data: { returnCode: "000", transactionId: "txn_new" } }),
    });
    const r = await adapter(impl).charge({
      orgId: "o",
      providerToken: "txn_initial",
      money: { amount: 30, currency: "CAD" },
      idempotencyKey: "k1",
    });
    expect(r).toEqual({ success: true, providerChargeRef: "txn_new" });
    const body = JSON.parse(String(calls.find((c) => c.url.endsWith("/api/payments/sale-with-token"))!.init?.body));
    expect(body.transactionId).toBe("txn_initial");
    expect(body.amount).toBe("3000");
  });

  it("maps a declined token charge to failure", async () => {
    const { impl } = router({
      "/api/auth/token": () => AUTH_OK,
      "/api/payments/sale-with-token": () =>
        jsonResponse({ success: false, message: "declined", data: { returnCode: "051" } }),
    });
    const r = await adapter(impl).charge({
      orgId: "o",
      providerToken: "txn_initial",
      money: { amount: 30, currency: "CAD" },
      idempotencyKey: "k1",
    });
    expect(r.success).toBe(false);
    expect(r.failureCode).toBe("051");
  });
});

describe("refund + void", () => {
  it("refunds by transactionId (amount in cents)", async () => {
    const { impl, calls } = router({
      "/api/auth/token": () => AUTH_OK,
      "/api/payments/refund-with-token": () =>
        jsonResponse({ success: true, data: { returnCode: "000", transactionId: "txn_refund" } }),
    });
    const r = await adapter(impl).refund({
      orgId: "o",
      providerChargeRef: "txn_orig",
      money: { amount: 12, currency: "CAD" },
      idempotencyKey: "k",
    });
    expect(r).toEqual({ success: true, providerRefundRef: "txn_refund" });
    const body = JSON.parse(String(calls.find((c) => c.url.endsWith("/api/payments/refund-with-token"))!.init?.body));
    expect(body).toMatchObject({ transactionId: "txn_orig", amount: "1200" });
    // v3.2.2 lists all six as required; omitting any is rejected by the gateway.
    for (const field of ["amount", "orderId", "mid", "termId", "transactionId", "redirectUrl"]) {
      expect(body[field], `refund requires ${field}`).toBeTruthy();
    }
  });

  it("sends a redirectUrl of ours, not the gateway's own origin", async () => {
    // redirectUrl is required even on this server-to-server call. Pointing it at
    // WeVend's API base named the gateway as the merchant's return address.
    const { impl, calls } = router({
      "/api/auth/token": () => AUTH_OK,
      "/api/payments/refund-with-token": () =>
        jsonResponse({ success: true, data: { returnCode: "000", transactionId: "t" } }),
    });
    const a = new WeVendAdapter({ ...CONFIG, appUrl: "https://kindpath.example", fetchImpl: impl });
    await a.refund({ orgId: "o", providerChargeRef: "txn_orig", idempotencyKey: "k" });
    const body = JSON.parse(String(calls.find((c) => c.url.includes("refund-with-token"))!.init?.body));
    expect(new URL(body.redirectUrl).origin).toBe("https://kindpath.example");
  });

  it("voids by transactionId", async () => {
    const { impl } = router({
      "/api/auth/token": () => AUTH_OK,
      "/api/payments/void": () =>
        jsonResponse({ success: true, data: { returnCode: "000", transactionId: "txn_void" } }),
    });
    const r = await adapter(impl).voidTransaction("txn_orig");
    expect(r).toEqual({ success: true, providerRef: "txn_void" });
  });
});

describe("unsupported operations", () => {
  it("enrollPaymentMethod and verifyWebhook throw with guidance", async () => {
    const a = adapter(vi.fn() as unknown as typeof fetch);
    await expect(
      a.enrollPaymentMethod({ orgId: "o", donorId: "d", gatewayToken: "x" })
    ).rejects.toThrow(/initial hosted sale/);
    await expect(a.verifyWebhook({ headers: {}, body: "{}" })).rejects.toThrow(/does not send webhooks/);
  });
});

describe("probe", () => {
  it("authenticates in merchant mode and reports the environment", async () => {
    const calls: string[] = [];
    const fetchImpl = (async (url: string, init?: RequestInit) => {
      calls.push(url);
      expect(JSON.parse(String(init?.body))).toEqual({ mid: "RCTST1", email: "t@x.ca", password: "pw" });
      return new Response(
        JSON.stringify({ success: true, data: { accessToken: "tok", refreshToken: "r" } }),
        { status: 200 }
      );
    }) as unknown as typeof fetch;
    const a = new (await import("./wevend-adapter")).WeVendAdapter({
      baseUrl: "https://wepay.wevend.dev",
      iframeUrl: "https://iframe.wevend.dev",
      mid: "RCTST1",
      termId: "00000003",
      email: "t@x.ca",
      password: "pw",
      fetchImpl,
    });
    await expect(a.probe()).resolves.toEqual({ environment: "sandbox" });
    expect(calls).toEqual(["https://wepay.wevend.dev/api/auth/token"]);
  });

  it("rejects bad credentials with WeVend's message", async () => {
    const fetchImpl = (async () =>
      new Response(JSON.stringify({ success: false, message: "Merchant not found" }), { status: 401 })) as unknown as typeof fetch;
    const a = new (await import("./wevend-adapter")).WeVendAdapter({
      baseUrl: "https://wepay.wevend.pro",
      iframeUrl: "https://iframe.wevend.pro",
      mid: "X",
      termId: "1",
      email: "t@x.ca",
      password: "pw",
      fetchImpl,
    });
    await expect(a.probe()).rejects.toThrow(/Merchant not found/);
  });

  it("names the environment from the host", async () => {
    const { WeVendAdapter } = await import("./wevend-adapter");
    expect(WeVendAdapter.environmentOf("https://wepay.wevend.dev/api")).toBe("sandbox");
    expect(WeVendAdapter.environmentOf("https://wepay.wevend.pro")).toBe("production");
    expect(WeVendAdapter.environmentOf("")).toBe("unknown");
  });
});
