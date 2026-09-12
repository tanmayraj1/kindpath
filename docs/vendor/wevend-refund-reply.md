# Draft reply — WeVend, 2026-09-12

Answers David's questions of Sep 10 and re-raises the two things actually blocking go-live.

The substantive point: **choosing API-triggered refunds may remove the need for both the webhook
and the polling endpoint.** If KindPath initiates the refund, it knows at that moment and can void
the CRA receipt in the same step — nothing has to be pushed to us. That is cheaper for WeVend than
either roadmap item and closes the gap sooner.

Prerequisite on our side if they agree: `WeVendAdapter.refund()` currently sends a fresh `orderId`,
but WeVend confirmed it must be the **original sale's**, which we do not persist. See the note on
that method in `src/lib/payments/wevend-adapter.ts`.

---

**Subject:** Re: KindPath — refunds, and the credentials we're still waiting on

Hi David,

**1. Where refunds are triggered.** Option (a) — from KindPath via the WePay API. "Credit cards
only" is not a limitation for us: every donation we take is a card payment through your hosted
iframe.

That choice may also answer items 2 and 3 for you. If KindPath initiates the refund, we know it
happened at that moment and can void the tax receipt in the same step — so we would need neither
the webhook nor the polling endpoint.

For that to be airtight we'd want (b) restricted for our merchants. If a merchant refunds in
WeCenter we never see it, and that is the gap we originally wrote about. API-initiated refunds,
with WeCenter refunds blocked, closes it completely.

**2. The receipt feature — we described this poorly, apologies.** We don't need WeVend to produce
a receipt document. Our customers are registered Canadian charities: when they receive a donation
we issue an official CRA donation receipt. If that gift is later refunded, the receipt has to be
voided, or a valid tax receipt stands for money that was given back — a CRA problem for the
charity, not a cosmetic one. So the only thing we ever needed was to **know a refund happened**.
If refunds run through the API, we know, and there is nothing further for you to build.

**3. Chargebacks** are the one case neither route covers. How is a merchant notified today, and is
there any way for us to learn of them programmatically?

Separately — we are still blocked on going live, and these matter more to us than the refund work:

- **Production MID and TID.** Layal was copied on Aug 28; we haven't received these yet. Is
  anything needed from us?
- **The sandbox credentials have stopped working.** `WV-ISV-50001` now returns
  `401 Invalid credentials` from `/api/auth/org-token`. It last worked on Aug 28. Could it be
  reissued?

Thanks,

Tanmay
