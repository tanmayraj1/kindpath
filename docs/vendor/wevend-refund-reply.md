# Draft reply — WeVend, 2026-09-12

Answers David's questions of Sep 10 and re-raises the two things blocking go-live.

Substantive point: **choosing API-triggered refunds may remove the need for both roadmap items.**
If KindPath initiates the refund it knows at that moment and can void the CRA receipt in the same
step — nothing has to be pushed to us. Cheaper for WeVend than either feature, and closes the gap
sooner.

If they agree, one prerequisite on our side: `WeVendAdapter.refund()` sends a fresh `orderId`, but
WeVend confirmed it must be the **original sale's**, which we don't persist. Noted on that method
in `src/lib/payments/wevend-adapter.ts`.

---

**Subject:** Re: KindPath — refunds, and credentials

Hi David,

**Where refunds are triggered:** option (a), from KindPath via the WePay API. Credit-cards-only
isn't a limitation — every donation we take is a card through your hosted iframe.

That may also settle your items 2 and 3. If we initiate the refund, we know immediately and can
void the tax receipt in the same step, so we'd need neither the webhook nor the polling endpoint.
The only gap left would be a merchant refunding in WeCenter, which we'd never see — so if (b) can
be blocked for our merchants, as you suggested, that closes it entirely.

**On the receipt feature** — restating what Dhruv sent on Aug 29: we don't need WeVend to generate
a receipt. Our customers are registered charities and we issue the official CRA donation receipt
ourselves. If a gift is refunded that receipt must be voided, or it stands as a valid tax receipt
for money that was returned. The only thing we need is to *know* a refund happened — and with API
refunds, we do.

**Chargebacks** are the one case neither route covers. How is a merchant notified, and can we learn
of them programmatically?

Separately, two things still blocking our launch:

- **Production MID and TID** — Layal was copied on Aug 28 but we haven't received these. Anything
  needed from us?
- **Sandbox credentials have stopped working.** `WV-ISV-50001` returns `401 Invalid credentials`
  from `/api/auth/org-token`; it last worked Aug 28 and nothing changed on our side. This is the
  organization password, not the MID or TID — we're on `00000002` as you advised, and that part
  was working. Could the credentials be reissued?

Thanks,

Tanmay
