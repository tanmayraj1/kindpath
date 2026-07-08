import type { PaymentProvider } from "./provider";
import type {
  EnrollInput,
  PaymentToken,
  ChargeInput,
  ChargeResult,
  RecurringInput,
  RecurringRef,
  RefundInput,
  RefundResult,
  RawWebhook,
  PaymentEvent,
  HostedSaleInput,
  HostedSaleInit,
  ConfirmResult,
} from "./types";

/**
 * WeVend WePay API Gateway adapter (spec v2.2.0).
 *
 * WeVend is a HOSTED-IFRAME gateway, not a server-side charge API:
 *  - One-time gift: POST /payments/sale → paymentOrderId → redirect the donor to
 *    {iframeUrl}/{paymentOrderId}/carNew to enter their card → WeVend redirects
 *    back to redirectUrl?transactionId=…&success=1 → we confirm via get-transaction.
 *    (beginHostedSale + confirmTransaction)
 *  - Recurring: the first sale's transactionId is a reusable token; subsequent
 *    charges use /payments/sale-with-token, which IS synchronous. (charge)
 *  - Refund/void are synchronous. (refund / voidTransaction)
 *  - No webhooks: reconciliation is the return URL + get-transaction polling.
 *
 * Auth: POST /auth/token {mid,email,password} → 7-day accessToken + refreshToken.
 * We cache the token per adapter instance and re-auth on 401.
 *
 * Multi-tenant note: each KindPath org maps to a WeVend merchant (mid/email/
 * password/termId). Pass those per-org via the constructor; env vars are the
 * single-merchant default until per-org credential storage is wired.
 */

export type WeVendConfig = {
  baseUrl: string; // gateway API base, e.g. https://api.wevend.dev
  iframeUrl: string; // hosted card iframe base, e.g. https://iframe.wevend.dev
  mid: string;
  email: string;
  password: string;
  termId: string;
};

// WeVend returnCode/respCode values that mean "approved".
const APPROVED_CODES = new Set(["000", "200"]);

type WeVendEnvelope<T> = {
  success?: boolean;
  message?: string;
  data?: T;
};

export class WeVendAdapter implements PaymentProvider {
  readonly name = "wevend";

  private readonly cfg: WeVendConfig;
  private readonly fetchImpl: typeof fetch;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;

  constructor(opts?: Partial<WeVendConfig> & { fetchImpl?: typeof fetch }) {
    this.cfg = {
      baseUrl: (opts?.baseUrl ?? process.env.WEVEND_BASE_URL ?? "").replace(/\/$/, ""),
      iframeUrl: (opts?.iframeUrl ?? process.env.WEVEND_IFRAME_URL ?? "").replace(/\/$/, ""),
      mid: opts?.mid ?? process.env.WEVEND_MID ?? "",
      email: opts?.email ?? process.env.WEVEND_EMAIL ?? "",
      password: opts?.password ?? process.env.WEVEND_PASSWORD ?? "",
      termId: opts?.termId ?? process.env.WEVEND_TERM_ID ?? "",
    };
    this.fetchImpl = opts?.fetchImpl ?? fetch;
    if (!this.cfg.baseUrl || !this.cfg.mid || !this.cfg.email || !this.cfg.password) {
      throw new Error(
        "PAYMENT_PROVIDER=wevend requires WEVEND_BASE_URL, WEVEND_MID, WEVEND_EMAIL, WEVEND_PASSWORD"
      );
    }
  }

  // ---------- helpers ----------

  /** Amount → integer cents as a string (WeVend takes amounts in cents, as strings). */
  private toCents(amount: number): string {
    return String(Math.round(amount * 100));
  }

  /** A unique order id ≤15 chars (WeVend constraint). base36 of hrtime keeps it short. */
  private orderId(provided?: string): string {
    if (provided) return provided.slice(0, 15);
    const s = Buffer.from(process.hrtime.bigint().toString()).toString("hex");
    return `kp${parseInt(s.slice(-10), 16).toString(36)}`.slice(0, 15);
  }

  private async login(): Promise<void> {
    const res = await this.fetchImpl(`${this.cfg.baseUrl}/api/auth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mid: this.cfg.mid, email: this.cfg.email, password: this.cfg.password }),
    });
    const body = (await res.json()) as WeVendEnvelope<{ accessToken: string; refreshToken: string }>;
    if (!res.ok || !body.success || !body.data?.accessToken) {
      throw new Error(body.message ?? "WeVend: authentication failed");
    }
    this.accessToken = body.data.accessToken;
    this.refreshToken = body.data.refreshToken ?? null;
  }

  /** Authenticated request; logs in on first use and re-auths once on a 401. */
  private async authed<T>(
    method: "GET" | "POST",
    path: string,
    payload?: Record<string, string>
  ): Promise<WeVendEnvelope<T>> {
    if (!this.accessToken) await this.login();

    const call = () =>
      this.fetchImpl(`${this.cfg.baseUrl}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          ...(method === "POST" ? { "Content-Type": "application/json" } : {}),
        },
        body: method === "POST" && payload ? JSON.stringify(payload) : undefined,
      });

    let res = await call();
    if (res.status === 401) {
      // token expired/blacklisted → re-authenticate once and retry.
      this.accessToken = null;
      await this.login();
      res = await call();
    }
    const body = (await res.json()) as WeVendEnvelope<T>;
    if (!res.ok && body.success === undefined) {
      throw new Error(body.message ?? `WeVend: request to ${path} failed (${res.status})`);
    }
    return body;
  }

  private static approved(code: unknown): boolean {
    return APPROVED_CODES.has(String(code));
  }

  // ---------- hosted (iframe) one-time sale ----------

  async beginHostedSale(input: HostedSaleInput): Promise<HostedSaleInit> {
    const body = await this.authed<{ paymentOrderId: string; returnCode?: string | number }>(
      "POST",
      "/api/payments/sale",
      {
        amount: this.toCents(input.money.amount),
        orderId: this.orderId(input.orderId),
        mid: this.cfg.mid,
        termId: this.cfg.termId,
        redirectUrl: input.redirectUrl,
      }
    );
    const paymentOrderId = body.data?.paymentOrderId;
    if (!body.success || !paymentOrderId) {
      throw new Error(body.message ?? "WeVend: could not create sale order");
    }
    return {
      paymentOrderId,
      redirectTo: `${this.cfg.iframeUrl}/${paymentOrderId}/carNew`,
    };
  }

  async confirmTransaction(transactionId: string): Promise<ConfirmResult> {
    const body = await this.authed<{
      respCode?: string;
      detailRespData?: string;
      cardType?: string;
      cardNum?: string;
      paymentOrderId?: string;
      txnType?: string;
    }>("GET", `/api/payments/get-transaction/${encodeURIComponent(transactionId)}`);

    const d = body.data ?? {};
    const ok = body.success === true && WeVendAdapter.approved(d.respCode);
    return {
      success: ok,
      providerChargeRef: transactionId,
      paymentOrderId: d.paymentOrderId,
      cardBrand: d.cardType,
      last4: d.cardNum ? d.cardNum.replace(/[^0-9]/g, "").slice(-4) : undefined,
      failureCode: ok ? undefined : String(d.respCode ?? "declined"),
      failureMessage: ok ? undefined : d.detailRespData ?? "The payment was not approved.",
    };
  }

  // ---------- tokenized / recurring charge (synchronous) ----------

  /** Recurring charge via sale-with-token. `providerToken` is a prior sale's transactionId. */
  async charge(input: ChargeInput): Promise<ChargeResult> {
    const body = await this.authed<{ returnCode?: string | number; transactionId?: string }>(
      "POST",
      "/api/payments/sale-with-token",
      {
        amount: this.toCents(input.money.amount),
        orderId: this.orderId(input.metadata?.orderId),
        mid: this.cfg.mid,
        termId: this.cfg.termId,
        redirectUrl: `${this.cfg.baseUrl}/response`,
        transactionId: input.providerToken,
      }
    );
    const approved = body.success === true && WeVendAdapter.approved(body.data?.returnCode);
    if (!approved) {
      return {
        success: false,
        providerChargeRef: body.data?.transactionId ?? "",
        failureCode: String(body.data?.returnCode ?? "declined"),
        failureMessage: body.message ?? "The recurring payment was declined.",
      };
    }
    return { success: true, providerChargeRef: body.data?.transactionId ?? "" };
  }

  async refund(input: RefundInput): Promise<RefundResult> {
    const body = await this.authed<{ returnCode?: string | number; transactionId?: string }>(
      "POST",
      "/api/payments/refund-with-token",
      {
        amount: this.toCents(input.money?.amount ?? 0),
        orderId: this.orderId(),
        mid: this.cfg.mid,
        termId: this.cfg.termId,
        redirectUrl: `${this.cfg.baseUrl}/response`,
        transactionId: input.providerChargeRef,
      }
    );
    return {
      success: body.success === true && WeVendAdapter.approved(body.data?.returnCode),
      providerRefundRef: body.data?.transactionId ?? "",
    };
  }

  async voidTransaction(providerChargeRef: string): Promise<{ success: boolean; providerRef: string }> {
    const body = await this.authed<{ returnCode?: string | number; transactionId?: string }>(
      "POST",
      "/api/payments/void",
      { transactionId: providerChargeRef }
    );
    return {
      success: body.success === true && WeVendAdapter.approved(body.data?.returnCode),
      providerRef: body.data?.transactionId ?? "",
    };
  }

  // ---------- interface members WeVend handles differently ----------

  async enrollPaymentMethod(_input: EnrollInput): Promise<PaymentToken> {
    // WeVend has no standalone tokenization; the reusable "token" is a transactionId
    // captured from an initial hosted sale (beginHostedSale → confirmTransaction).
    throw new Error(
      "WeVend: enroll a payment method by capturing a transactionId from an initial hosted sale."
    );
  }

  async createRecurring(_input: RecurringInput): Promise<RecurringRef> {
    // KindPath's billing cron owns the schedule and re-charges via sale-with-token,
    // so there is no provider-side subscription — the ref is synthetic.
    return { providerRecurringRef: `kp_sched_${this.orderId()}` };
  }

  async cancelRecurring(_ref: RecurringRef): Promise<void> {
    return;
  }

  async verifyWebhook(_req: RawWebhook): Promise<PaymentEvent> {
    throw new Error(
      "WeVend does not send webhooks; confirm payments via the return URL + confirmTransaction()."
    );
  }
}
