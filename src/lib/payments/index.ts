import type { PaymentProvider } from "./provider";
import { MockAdapter } from "./mock-adapter";
import { StripeAdapter } from "./stripe-adapter";
import { WeVendAdapter } from "./wevend-adapter";

let provider: PaymentProvider | null = null;

/**
 * Returns the configured payment provider (singleton). Switch on PAYMENT_PROVIDER.
 * WeVend uses the single-merchant env credentials here; per-org merchant creds
 * will be threaded through once credential storage is wired.
 */
export function getPaymentProvider(): PaymentProvider {
  if (provider) return provider;

  switch (process.env.PAYMENT_PROVIDER) {
    case "stripe":
      provider = new StripeAdapter();
      break;
    case "wevend":
      provider = new WeVendAdapter();
      break;
    case "mock-hosted":
      // Simulates a WeVend-style redirect gateway locally (see MockAdapter).
      provider = new MockAdapter({ hosted: true });
      break;
    case "mock":
    default:
      provider = new MockAdapter();
  }
  return provider;
}

export { supportsHostedSale } from "./provider";
export type { PaymentProvider } from "./provider";
export * from "./types";
