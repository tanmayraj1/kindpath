/**
 * Does a confirmed gateway transaction belong to the sale WE opened?
 *
 * The browser returns from the gateway carrying a transactionId we did not
 * choose. The signed session cookie proves which order we opened, for which
 * charity and amount — but nothing tied the transactionId to that order. Under
 * WeVend's organization Global Token one login can see transactions across every
 * merchant, so a lookup alone does not prove the money went to this charity's
 * merchant. The gateway's own paymentOrderId on the transaction does: it is the
 * order we created with this charity's MID.
 *
 *  - "mismatch": the transaction belongs to a different order. Refuse.
 *  - "unverified": WeVend returned no order id, so the binding cannot be checked.
 *    Allowed (refusing would fail a donor who has already paid) but reported, so
 *    a gateway response change is noticed rather than silently weakening this.
 *  - "ok": bound, or a provider that doesn't return order ids (simulated).
 */
export function orderBinding(
  provider: string,
  confirmedOrderId: string | undefined | null,
  expectedOrderId: string
): "ok" | "mismatch" | "unverified" {
  if (confirmedOrderId) return confirmedOrderId === expectedOrderId ? "ok" : "mismatch";
  return provider === "wevend" ? "unverified" : "ok";
}
