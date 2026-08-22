/**
 * Is this Stripe account one a Canadian charity's donations can settle to?
 *
 * A key can pass every "does it work" probe and still be unable to take a
 * single donation: the first production key was from an account registered in
 * **India**, and Stripe India refuses international (non-INR) charges for it —
 * `GET /v1/balance` succeeded, the connect form said "Connected", and every
 * Checkout session then failed with "only registered Indian businesses … can
 * accept international payments". That is invisible until a donor tries.
 *
 * KindPath issues CAD receipts to Canadian donors, so the account must be a
 * Canadian one. `country` is what Stripe reports on `GET /v1/account`.
 */
export type StripeAccountShape = {
  id?: string;
  country?: string;
  charges_enabled?: boolean;
  default_currency?: string;
};

export const REQUIRED_COUNTRY = "CA";

export function assessStripeAccount(
  acct: StripeAccountShape
): { ok: true; country: string } | { ok: false; reason: string } {
  const country = (acct.country ?? "").toUpperCase();
  if (!country) {
    return { ok: false, reason: "Stripe did not report the account's country; try again." };
  }
  if (country !== REQUIRED_COUNTRY) {
    return {
      ok: false,
      reason: `This Stripe account is registered in ${country}. Donations to a Canadian organization must settle to a Canadian Stripe account — create one at stripe.com with Canada as the country, then connect its key here.`,
    };
  }
  return { ok: true, country };
}
