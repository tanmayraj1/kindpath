# WeVend correspondence

## Answers received 2026-08-28

| Question | Answer |
|---|---|
| Organization Global Token | Enabled. `wvNumber` = `WV-ISV-50001`. **Shared org — do not change the global token.** |
| Sandbox merchant | MID `RCTST0000048568`. TID **`00000002`** (`00000003` was issued first but is not enabled for testing). |
| CAD | Supported |
| Refund `orderId` | The **original sale's**; the gateway issues its own id for the refund. **Policy: refund via WeCenter, not the API.** |
| Refund notification | No webhook. Refunds are viewed in WeCenter. |
| Production | Separate live MID/TID to be issued; contact Layal. |

**Integration verified end to end on the sandbox, 2026-08-28** — see `docs/15_GO_LIVE_RUNBOOK.md` §2.

## 2026-09-09 — WeVend added all three refund-reconciliation requests to the roadmap

David asked which to prioritise. Our answer: **the polling endpoint (#2)**, because it is the
only one of the three that can give a *guarantee* rather than a best effort. Reasoning and the
spec details that decide whether it is usable are in the reply below.

Still outstanding and unanswered: production MID/TID, recurring token longevity, production AVS
setting, decline test cards.

---

## Reply — prioritisation

**Subject:** Re: Refund reconciliation — priority order

Hi David,

Thanks for putting all three on the roadmap. If you're picking one, **the polling endpoint (#2)
is the one we'd ask for first.**

The reason is that a webhook alone can't give us a guarantee. Our customers issue official CRA
donation receipts, so when a gift is refunded the receipt has to be voided — otherwise a valid
tax receipt stands for money that was returned. If a webhook is dropped or our endpoint is down
for an hour, that failure is silent, and a silently valid tax receipt is precisely the outcome
we're trying to design out. A pollable endpoint is self-correcting: one call per merchant per
night, and if our job misses a few days we widen the window and catch up.

So our order would be **#2 first, then #1** as a latency improvement on top of it — webhook for
speed, poll for correctness.

**#3 is worth answering right away regardless**, since it's a question about existing behaviour
rather than something to build: if `get-transaction` on the original sale already reflects a
later refund, we can use that as a stopgap for low-volume merchants while #2 is built. It isn't
a long-term answer — it's one call per donation, so it doesn't scale past a few thousand gifts —
but it would let us close the gap now.

**Four details on #2 that decide whether we can use it:**

1. **Filter on the refund's own timestamp, not the original sale's date.** This is the important
   one. If the date range filters by when the sale happened, then a refund issued today against a
   gift from six months ago never appears in today's window, and we'd never see it.
2. **Include chargebacks and disputes**, not just merchant-initiated refunds. From our side the
   problem is identical — money went back to the cardholder and the receipt is no longer valid.
3. **Include the amount.** Partial refunds mean the receipt has to be reissued for the reduced
   eligible amount rather than simply voided, so we need the figure, not just the fact.
4. **Include a link to the original transaction** (the sale's `transactionId` or
   `paymentOrderId`), so we can match it to the right donation and receipt.

Filterable by `mid` and usable with the organization token, with pagination, would cover us.

Two other things while we have you:

- **Production MID/TID** — we're still waiting on these, and they're what's blocking our launch.
  Layal was copied on the earlier thread; is there anything you need from us to move that along?
- **Recurring token lifetime** — our recurring donations re-charge via `sale-with-token` against
  the original sale's `transactionId`, and these run monthly for years. Does that token expire?
  If it does, we need to design for re-authorisation before donors start silently failing.

Thanks,

[Your name]
