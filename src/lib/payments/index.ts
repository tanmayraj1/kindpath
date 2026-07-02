import type { PaymentProvider } from "./provider";
import { MockAdapter } from "./mock-adapter";
import { StripeAdapter } from "./stripe-adapter";

let provider: PaymentProvider | null = null;

/**
 * Returns the configured payment provider. Switch on PAYMENT_PROVIDER env to
 * plug in the client POS adapter later without touching call sites:
 *
 *   case "wevend": return new WeVendAdapter({ baseUrl, apiKey });
 */
export function getPaymentProvider(): PaymentProvider {
  if (provider) return provider;

  switch (process.env.PAYMENT_PROVIDER) {
    case "stripe":
      provider = new StripeAdapter();
      break;
    case "mock":
    default:
      provider = new MockAdapter();
  }
  return provider;
}

export type { PaymentProvider } from "./provider";
export * from "./types";
