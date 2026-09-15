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

// Approval + human meanings live in one place, transcribed from WeVend's FAQ
// (Fiserv Appendix A). `donorMessage` is deliberately narrower than the raw
// meaning — see that file.
import { isApprovedCode, donorMessage, describeResponseCode } from "./wevend-response-codes";
import { appUrl as deploymentUrl } from "@/lib/app-url";

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
      appUrl: (opts?.appUrl ?? deploymentUrl()).replace(/\/$/, ""),
      mid: opts?.mid ?? process.env.WEVEND_MID ?? "",
      termId: opts?.termId ?? process.env.WEVEND_TERM_ID ?? "",
      wvNumber: opts?.wvNumber ?? process.env.WEVEND_WV_NUMBER ?? "",
      email: opts?.email ?? process.env.WEVEND_EMAIL ?? "",
      password: opts?.password ?? process.env.WEVEND_PASSWORD ?? "",
    };
    this.fetchImpl = opts?.fetchImpl ?? fetch;
    this.orgMode = Boolean(this.cfg.wvNumber);

    // Org mode needs no MID to authenticate: the platform-level adapter (health
    // probe) holds only the organization login, and each charity's merchant is
    // supplied per org. Merchant mode logs in WITH the MID, so needs it up front.
    const ok = this.cfg.baseUrl && this.cfg.password &&
      (this.orgMode ? this.cfg.wvNumber : this.cfg.email && this.cfg.mid);
    if (!ok) {
      throw new Error(
        "PAYMENT_PROVIDER=wevend requires WEVEND_BASE_URL and either " +
          "(WEVEND_WV_NUMBER + WEVEND_PASSWORD) for org mode or (WEVEND_EMAIL + WEVEND_PASSWORD + WEVEND_MID) for merchant mode"
      );
    }
  }

  /** Every payment call names a merchant; an organization login alone cannot transact. */
  private merchant(): { mid: string; termId: string } {
    if (!this.cfg.mid || !this.cfg.termId) {
      throw new Error("WeVend: no merchant (MID and terminal ID) is configured for this organization");
    }
    return { mid: this.cfg.mid, termId: this.cfg.termId };
  }

  /**
   * Prove the credentials work before anything is stored.
   *
   * Merchant mode authenticates with mid + email + password, so login alone
   * proves the merchant. An ORGANIZATION token does not: it authenticates the
   * organization, and every merchant under it is addressed by passing `mid` per
   * call — so a typo'd MID would sail through login and fail at a donor's first
   * gift. Org mode therefore follows up with a read-only lookup carrying the
   * MID; WeVend answers 401 "Merchant not found or has been deleted" for an
   * unknown merchant, and something else (an unknown *transaction*) for a real
   * one. Deliberately a GET for a transaction that cannot exist: it validates
   * the merchant while creating nothing.
   */
  async probe(): Promise<{ environment: "sandbox" | "production" | "unknown"; midChecked: boolean }> {
    await this.login();
    const environment = WeVendAdapter.environmentOf(this.cfg.baseUrl);
    if (!this.orgMode) return { environment, midChecked: true };
    // Platform-level check: the organization login is all there is to prove.
    if (!this.cfg.mid) return { environment, midChecked: false };

    const body = await this.authed<unknown>(
      "GET",
      `/api/payments/get-transaction/${WeVendAdapter.PROBE_TXN_ID}?mid=${encodeURIComponent(this.cfg.mid)}`
    );
    if (WeVendAdapter.isUnknownMerchant(body.message)) {
      throw new Error(`WeVend: merchant ${this.cfg.mid} not found under this organization`);
    }
    return { environment, midChecked: true };
  }

  /** A transaction id that cannot exist, used only to bounce a merchant lookup. */
  private static readonly PROBE_TXN_ID = "kp-merchant-probe";

  static isUnknownMerchant(message: unknown): boolean {
    return /merchant not found|merchant .*deleted/i.test(String(message ?? ""));
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
    return isApprovedCode(code);
  }

  // ---------- hosted (iframe) one-time sale ----------

  async beginHostedSale(input: HostedSaleInput): Promise<HostedSaleInit> {
    const body = await this.authed<{ paymentOrderId: string; returnCode?: string | number }>(
      "POST",
      "/api/payments/sale",
      {
        amount: this.toCents(input.money.amount),
        orderId: this.orderId(input.orderId),
        ...this.merchant(),
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
      // `mid` is REQUIRED on this call when authenticated with an organization
      // token — without it WeVend answers 400 "mid is required when using an
      // organization token". That would fail AFTER the donor has paid, which is
      // the worst possible place: money taken, no confirmation, no receipt. It is
      // accepted (and correct) in merchant mode too, so it is always sent.
    }>(
      "GET",
      `/api/payments/get-transaction/${encodeURIComponent(transactionId)}?mid=${encodeURIComponent(this.merchant().mid)}`
    );

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
      // What the DONOR sees. WeVend's own detailRespData is a processor string
      // ("DO NOT HONOR"), and some codes must not be repeated to a payer at all,
      // so this is mapped rather than passed through.
      failureMessage: ok ? undefined : donorMessage(d.respCode),
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
        ...this.merchant(),
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
        // Recurring charges are read by staff, not the donor, so the raw Fiserv
        // meaning is more useful here than the softened donor wording.
        failureMessage:
          describeResponseCode(body.data?.returnCode) ??
          body.message ??
          "The recurring payment was declined.",
      };
    }
    return { success: true, providerChargeRef: body.data?.transactionId ?? "" };
  }

  /**
   * Refund an already-settled transaction. Partial refunds are supported — the
   * amount is explicit — so this is NOT interchangeable with voidTransaction():
   * a void only works before settlement, and a completion cannot be voided at all.
   *
   * ⚠️ NOT USABLE AS WRITTEN — see below. Kept because the endpoint is correct and
   * the shape is right; what is missing is a stored reference.
   *
   * WeVend confirmed (2026-08-28) that `orderId` must be **the original sale's**,
   * not a fresh one — the gateway generates its own id for the refund. This code
   * sends a fresh `orderId`, which is wrong. It cannot simply be fixed here
   * either: the sale's `orderId` is generated inside `beginHostedSale` and never
   * persisted, so there is nothing to send. Storing it on the donation row is the
   * prerequisite for any API refund.
   *
   * WeVend also stated that as a matter of policy refunds should be issued
   * through WeCenter rather than the API, so this path is not on the critical
   * path today. The product consequence is documented in
   * docs/13_PAYMENT_GATEWAYS.md: KindPath has no refund feature, and a refund
   * made in WeCenter does not reach us, so the donor's tax receipt must be voided
   * by hand.
   */
  async refund(input: RefundInput): Promise<RefundResult> {
    const body = await this.authed<{ returnCode?: string | number; transactionId?: string }>(
      "POST",
      "/api/payments/refund-with-token",
      {
        amount: this.toCents(input.money?.amount ?? 0),
        orderId: this.orderId(),
        ...this.merchant(),
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
