# WeVend correspondence

## Answers received 2026-08-28

| Question | Answer |
|---|---|
| Organization Global Token | Enabled. `wvNumber` = `WV-ISV-50001`. **Shared org — do not change the global token.** |
| Sandbox merchant | MID `RCTST0000048568`, TID `00000003` |
| CAD | Supported |
| Refund `orderId` | The **original sale's**; the gateway issues its own id for the refund. **Policy: refund via WeCenter, not the API.** |
| Refund notification | No webhook. Refunds are viewed in WeCenter. They offered to build a "refund receipt" feature. |
| Production | Separate live MID/TID to be issued; contact Layal. |

Recorded in `docs/13_PAYMENT_GATEWAYS.md` and `docs/15_GO_LIVE_RUNBOOK.md`.

---

## Reply — sandbox authorization failing

**Subject:** Re: KindPath integration — sandbox merchant returning Code 500 on authorization

Hi [Name],

Thanks — that unblocked us, and the integration is nearly there. Everything up to the card
authorization works against `RCTST0000048568`:

- organization token issues correctly
- the merchant resolves (a wrong MID is correctly rejected)
- `/api/payments/sale` returns a `paymentOrderId`
- the hosted card page loads

**Where it stops:** submitting the test card `4111 1111 1111 1111` (12/30, any CVV) sits on
"AUTHORIZING…" for roughly 45 seconds and then returns **"Transaction Unsuccessful — Code 500"**.

We tried both card-entry hosts and got the identical result, so it doesn't appear to be a
region issue:

- `iframe.wevend.dev` — paymentOrderId `6a919dd226da2b1b08c1909c`
- `iframe-us.wevend.dev` — paymentOrderId `6a919eaf26da2b1b08c1909e`

A 500 reads as a gateway-side error rather than a card decline. Could you check whether the
terminal on this merchant is fully provisioned against the processor? Happy to re-run any test
you'd like.

Two smaller things:

1. Which card-entry host should we use for this merchant — the Canadian or the US one?
2. On refunds: a refund receipt from WeCenter would be useful, but our actual gap is
   **detection**. Our customers issue official CRA donation receipts, and when a gift is
   refunded the receipt has to be voided — otherwise a valid tax receipt stands for money that
   was returned. Without a notification we have no way to know a refund happened. Would either
   of these be possible?
   - a webhook on refund, or
   - an endpoint we could poll — transactions (including refunds) for a merchant over a date
     range — so a nightly job can reconcile.

   Alternatively, does `get-transaction` on the original sale reflect a later refund? If so we
   can reconcile with what already exists.

Thanks,

[Your name]
