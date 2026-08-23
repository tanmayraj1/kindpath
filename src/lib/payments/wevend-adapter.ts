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
 * WeVend WePay API Gateway adapter (spec v3.2.2).
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
 * Auth: JWT bearer, 7-day expiry, single-use refresh tokens. Either ORG mode
 * (wvNumber + password → /auth/org-token; one "Global Token" acts across every
 * merchant in the organization, so `mid` must be sent on each payment call) or
 * MERCHANT mode (mid + email + password → /auth/token). WeVend's guidance is to
 * default to the organization Global Token, which is what org mode does. We cache
 * the token per adapter instance and re-auth on 401.
 *
 * Environments (v3.2.2 p.125 + WeVend integration FAQ):
 *   dev   API https://wepay.wevend.dev   iframe https://iframe.wevend.dev  (CA)
 *   prod  API https://wepay.wevend.pro   iframe https://iframe.wevend.pro  (CA)
 * The gateway is hosted by WeVend; there is nothing to deploy on our side, and
 * the `localhost:3000` in their docs is only their local example.
 *
 * Multi-tenant note: each KindPath org maps to a WeVend merchant (mid/email/
 * password/termId). Pass those per-org via the constructor; env vars are the
 * single-merchant default until per-org credential storage is wired.
 */

export type WeVendConfig = {
  baseUrl: string; // gateway API base, e.g. https://wepay.wevend.dev
  iframeUrl: string; // hosted card iframe base, e.g. https://iframe.wevend.dev
  mid: string; // the merchant to transact as (required in both auth modes)
  termId: string;
  // Auth: either ORG/ISV mode (wvNumber + password → /auth/org-token, one token
  // acts across many merchant MIDs) or MERCHANT mode (mid + email + password →
  // /auth/token). Org mode is used when wvNumber is set.
  wvNumber?: string;
  email?: string;
  password: string;
  /**
   * Absolute URL WeVend echoes back on server-to-server calls. It is a required
   * field on refund/sale-with-token even though those return synchronously and
   * never redirect a browser, so it must still be one of OUR urls.
   */
  appUrl?: string;
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

  private readonly orgMode: boolean;

  constructor(opts?: Partial<WeVendConfig> & { fetchImpl?: typeof fetch }) {
    this.cfg = {
      baseUrl: WeVendAdapter.normalizeBase(opts?.baseUrl ?? process.env.WEVEND_BASE_URL ?? ""),
      iframeUrl: (opts?.iframeUrl ?? process.env.WEVEND_IFRAME_URL ?? "").replace(/\/$/, ""),
      appUrl: (opts?.appUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, ""),
      mid: opts?.mid ?? process.env.WEVEND_MID ?? "",
      termId: opts?.termId ?? process.env.WEVEND_TERM_ID ?? "",
      wvNumber: opts?.wvNumber ?? process.env.WEVEND_WV_NUMBER ?? "",
      email: opts?.email ?? process.env.WEVEND_EMAIL ?? "",
      password: opts?.password ?? process.env.WEVEND_PASSWORD ?? "",
    };
    this.fetchImpl = opts?.fetchImpl ?? fetch;
    this.orgMode = Boolean(this.cfg.wvNumber);

    const ok = this.cfg.baseUrl && this.cfg.mid && this.cfg.password &&
      (this.orgMode ? this.cfg.wvNumber : this.cfg.email);
    if (!ok) {
      throw new Error(
        "PAYMENT_PROVIDER=wevend requires WEVEND_BASE_URL, WEVEND_MID and either " +
          "(WEVEND_WV_NUMBER + WEVEND_PASSWORD) for org mode or (WEVEND_EMAIL + WEVEND_PASSWORD) for merchant mode"
      );
    }
  }

  /**
   * Prove the credentials work before anything is stored. Authentication is
   * the only call that is free of side effects and still exercises mid + email
   * + password (merchant mode) or wvNumber + password (org mode): a wrong MID
   * fails right here instead of at a donor's first gift.
   */
  async probe(): Promise<{ environment: "sandbox" | "production" | "unknown" }> {
    await this.login();
    return { environment: WeVendAdapter.environmentOf(this.cfg.baseUrl) };
  }

  /** Which WeVend environment a base URL points at — shown to admins, never inferred silently. */
  static environmentOf(baseUrl: string | undefined): "sandbox" | "production" | "unknown" {
    if (!baseUrl) return "unknown";
    if (/wevend\.dev/i.test(baseUrl)) return "sandbox";
    if (/wevend\.pro/i.test(baseUrl)) return "production";
    return "unknown";
  }

  // ---------- helpers ----------

  /**
   * WeVend's own FAQ gives the base URL as ".../api" while their endpoint tables
   * give paths that already start with "/api". Taking either at face value would
   * produce "/api/api/payments/sale", so normalize to the origin and let the
   * paths below own the "/api" prefix.
   */
  private static normalizeBase(raw: string): string {
    return raw.trim().replace(/\/+$/, "").replace(/\/api$/i, "");
  }

  /**
   * WeVend requires a redirectUrl on refund and sale-with-token, which are pure
   * server-to-server calls with no browser to redirect. It must still be a real
   * URL of ours — pointing it at WeVend's own API base (as this once did) named
   * the gateway as the merchant's return address.
   */
  private get serverCallbackUrl(): string {
    return `${this.cfg.appUrl || "https://kindpath.ca"}/api/payments/wevend/response`;
  }

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
    // Org/ISV token acts across many merchant MIDs; merchant token is single-MID.
    const path = this.orgMode ? "/api/auth/org-token" : "/api/auth/token";
    const payload = this.orgMode
      ? { wvNumber: this.cfg.wvNumber, password: this.cfg.password }
      : { mid: this.cfg.mid, email: this.cfg.email, password: this.cfg.password };

    const res = await this.fetchImpl(`${this.cfg.baseUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
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
      amount?: string; // WeVend returns the charged amount in DOLLARS here (e.g. "0.12")
    }>("GET", `/api/payments/get-transaction/${encodeURIComponent(transactionId)}`);

    const d = body.data ?? {};
    const ok = body.success === true && WeVendAdapter.approved(d.respCode);
    const amount = d.amount != null && d.amount !== "" ? Number(d.amount) : undefined;

    // WeVend expects a sale to be marked complete once the payer has received what
    // they paid for. For a donation that is true the instant the charge approves,
    // so there is no state in which we would want to hold it back. Best-effort:
    // the donation is already recorded and receipted off the confirmation above,
    // and a failure here must not turn a successful gift into an error page.
    if (ok) await this.markTransactionComplete(transactionId);

    return {
      success: ok,
      providerChargeRef: transactionId,
      paymentOrderId: d.paymentOrderId,
      amount: Number.isFinite(amount) ? amount : undefined,
      cardBrand: d.cardType,
      last4: d.cardNum ? d.cardNum.replace(/[^0-9]/g, "").slice(-4) : undefined,
      failureCode: ok ? undefined : String(d.respCode ?? "declined"),
      failureMessage: ok ? undefined : d.detailRespData ?? "The payment was not approved.",
    };
  }

  /**
   * Marks a sale as fulfilled in WeVend's records. Deliberately swallows failures:
   * the money has already moved and the receipt is already issued by the time this
   * runs, so raising here would report a completed gift as a failure to the donor.
   */
  private async markTransactionComplete(transactionId: string): Promise<void> {
    try {
      await this.authed("POST", "/api/payments/mark-transaction-complete", { transactionId });
    } catch {
      // Non-fatal by design — see above.
    }
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
        redirectUrl: this.serverCallbackUrl,
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

  /**
   * Refund an already-settled transaction. Partial refunds are supported — the
   * amount is explicit — so this is NOT interchangeable with voidTransaction():
   * a void only works before settlement, and a completion cannot be voided at all.
   *
   * `orderId` here is a fresh merchant reference for the refund transaction, not
   * the original sale's. WeVend's spec lists it as required without saying which,
   * and their response returns a new transaction record, which reads as "new
   * reference". Confirm with WeVend before the first live refund.
   */
  async refund(input: RefundInput): Promise<RefundResult> {
    const body = await this.authed<{ returnCode?: string | number; transactionId?: string }>(
      "POST",
      "/api/payments/refund-with-token",
      {
        amount: this.toCents(input.money?.amount ?? 0),
        orderId: this.orderId(),
        mid: this.cfg.mid,
        termId: this.cfg.termId,
        redirectUrl: this.serverCallbackUrl,
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
