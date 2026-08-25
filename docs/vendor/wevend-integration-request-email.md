# Draft email — WeVend integration requirements

> Keep their answers next to `docs/13_PAYMENT_GATEWAYS.md`; items 4 and 5 settle open
> questions recorded there. Fill the `[ ]` placeholders before sending.

---

**Subject:** KindPath integration — sandbox merchant and organization token

Hi [Name],

Our WePay integration is built and authenticating successfully against
`wepay.wevend.dev`. To finish testing we need:

1. **Organization Global Token** — confirmation it's enabled for us, our `wvNumber`, and
   the credentials, for both dev and production.
2. **A sandbox test merchant** under our organization — MID and terminal ID. Please send
   the claim email to **[email address]**.
3. **Canada / CAD confirmation** — our customers are Canadian registered charities and
   donations must settle in CAD. Your FAQ notes test merchants are registered US-country,
   so please confirm CAD is supported and register ours as Canadian if possible.

Two things the documentation doesn't answer:

4. On `refund-with-token`, is `orderId` a **new reference for the refund** or the
   **original sale's**?
5. Is there any webhook, callback or reporting endpoint that would tell us about a
   **refund issued in the WePay portal**? Our customers issue official CRA tax receipts, so
   a refund has to void the receipt — today a portal-initiated refund would be invisible to
   us.

Also useful if you have them: test cards for decline scenarios (insufficient funds,
do-not-honor).

Happy to jump on a call if that's quicker.

Thanks,

[Your name]
[Title], KindPath
