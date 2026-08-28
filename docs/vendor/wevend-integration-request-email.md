# WeVend correspondence

## Answers received 2026-08-28

| Question | Answer |
|---|---|
| Organization Global Token | Enabled. `wvNumber` = `WV-ISV-50001`. **Shared org — do not change the global token.** |
| Sandbox merchant | MID `RCTST0000048568`. TID **`00000002`** (`00000003` was issued first but is not enabled for testing). |
| CAD | Supported |
| Refund `orderId` | The **original sale's**; the gateway issues its own id for the refund. **Policy: refund via WeCenter, not the API.** |
| Refund notification | No webhook. Refunds are viewed in WeCenter. They offered to build a "refund receipt" feature. |
| Production | Separate live MID/TID to be issued; contact Layal. |

**Integration verified end to end on the sandbox, 2026-08-28** — see
`docs/15_GO_LIVE_RUNBOOK.md` §2. Still open: refund detection (below).

---

## Reply — confirming it works, one open item

**Subject:** Re: KindPath integration — working on TID 00000002

Hi [Name],

That was it — TID `00000002` works. A full donation now runs end to end on the sandbox:
order created, card authorized on the hosted page, redirect back, transaction confirmed
(`respCode 000`), and an official donation receipt issued. Thanks for tracking it down.

Two notes for your records:

1. With `00000003` the `/api/payments/sale` call succeeded and returned a `paymentOrderId`
   normally — only the card authorization failed, with a 500. If a terminal isn't enabled for
   testing, it would help integrators if the sale call rejected it up front, since nothing
   before the cardholder's final click reveals the problem.
2. `00000002` prompts for a Zip / Postal Code and `00000003` did not, so I assume AVS is
   configured differently on the two. Worth confirming which setting production will have, as
   it changes what the donor sees.

**Still open — refund detection.** As mentioned, our customers issue official CRA donation
receipts, so when a gift is refunded the receipt has to be voided; otherwise a valid tax
receipt stands for money that was returned. A refund receipt from WeCenter doesn't close this,
because the gap is knowing a refund happened at all. Any one of these would solve it:

- a webhook on refund, or
- an endpoint we can poll — transactions including refunds for a merchant over a date range, or
- confirmation that `get-transaction` on the original sale reflects a later refund (if it does,
  we can reconcile with what already exists).

Could you let me know which is feasible?

Separately, we'll follow up with Layal on the production MID/TID.

Thanks,

[Your name]
