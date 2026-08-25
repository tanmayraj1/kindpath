# Draft email — WeVend integration requirements

> Sent to WeVend to unblock the WePay integration. Keep a copy of their answers next to
> `docs/13_PAYMENT_GATEWAYS.md`; several of them settle open questions recorded there.
> Placeholders in `[ ]` need filling before sending.

---

**Subject:** KindPath × WeVend — items needed to complete the WePay integration

Hi [Name],

We've completed the KindPath integration against the WePay API Gateway v3.2.2 and your
integration FAQ. The adapter covers the hosted card flow (`/payments/sale` →
iframe → `get-transaction` → `mark-transaction-complete`), tokenised recurring charges
(`sale-with-token`), refunds and voids, and we've verified organization authentication
against `wepay.wevend.dev` successfully.

We're now blocked on provisioning and a few points the documentation doesn't settle.
Grouped below by what blocks us today versus what we'll need before going live.

For context on the model: **KindPath is the integrator, and each of our customers is a
Canadian registered charity that will hold its own merchant account.** Donations must
settle directly to the charity — we never hold donor funds. Per your FAQ we're building on
the organization Global Token, addressing each charity's merchant by `mid` per call.

---

## 1. Organization and Global Token — blocking

1. Please confirm the **Global Token feature is enabled** on our organization, in both dev
   and production.
2. What is our **organization `wvNumber`** for each environment, and the credentials for
   `/api/auth/org-token`?
3. What's the process for **rotating the organization password** if we ever need to?

## 2. Merchant provisioning — blocking

4. Please register a **sandbox test merchant** under our organization and send the claim
   email to **[email address]**. We'll need the **MID** and **terminal ID**.
5. Your FAQ notes test merchants are registered in **US country**. Our merchants are
   **Canadian and must settle in CAD**. Please confirm merchants can be registered with
   **country = Canada and CAD settlement**, and register our test merchant that way if
   possible — we'd rather find any currency limitation in the sandbox than in production.
6. What's the **process and turnaround to register a production merchant** for each
   charity, and exactly what information do you need from them (legal entity, banking,
   underwriting documents)? We'd like to give charities an accurate checklist up front.
7. Is there an **API or portal route for us to submit merchant applications** on a
   charity's behalf, or does every request come through your team by email?

## 3. Request semantics — blocking

8. `/api/payments/sale` and `/api/payments/refund-with-token` take `amount` but no
   currency field. Please confirm **currency is determined by the merchant account**, and
   that there is no field we should be sending.
9. On `/api/payments/refund-with-token`, is `orderId` meant to be a **new reference for the
   refund**, or the **original sale's `orderId`**? The spec lists it as required without
   saying which, and we'd rather not learn the answer on a live refund.
10. For e-commerce donations, is calling **`mark-transaction-complete` immediately after an
    approved sale** the correct usage? Does it affect settlement timing?

## 4. Refunds and reconciliation — important for tax compliance

This one matters more for us than for a typical merchant. Our customers issue **official
CRA donation receipts**. If a gift is refunded, the receipt must be voided — a valid tax
receipt cannot stand for money that was returned.

11. Is there **any asynchronous notification** — webhook, callback, or push of any kind —
    for events initiated outside our API calls? Specifically a **refund or void performed by
    the merchant in the WePay portal**, which today would be invisible to us.
12. If not, is there a **query or reporting endpoint** we can poll to reconcile — for
    example transactions by merchant and date range, including refunds?
13. **Chargebacks and disputes:** your FAQ says these are outside the API. How is a merchant
    notified, and is there any way for us to learn of them programmatically?

## 5. Recurring / card-on-file

14. Does a prior sale's `transactionId` remain valid **indefinitely** as the token for
    `sale-with-token`, or does it expire? Our recurring donations run monthly for years.
15. Is any **flag or consent marker** required to identify a transaction as recurring or
    card-on-file, and does that affect authorisation rates or response codes?
16. What happens when the underlying **card expires or is reissued** — is there an account
    updater, or does the donor have to re-enter their card?

## 6. Test data

17. Your FAQ lists an approved PAN (`4111 1111 1111 1111`) and the expired-card case. Could
    we get **test cards for decline scenarios** — insufficient funds (116), do not honor
    (100), and an AVS failure — so we can verify our messaging and retry handling?
18. Please confirm the approved test PAN applies to the **hosted iframe** as well as
    server-to-server calls.

## 7. Before production

19. Do you apply **IP allowlisting** to API access? Our platform runs on cloud
    infrastructure with dynamic egress IPs, so a static-IP requirement would need planning.
20. What are the **rate limits** per organization or merchant?
21. **Apple Pay / Google Pay** in the iframe — is any domain registration or verification
    required on our side, and if so what's the process?
22. Is there a **certification, review or sign-off step** before production credentials are
    issued? If so, what does it involve and how long does it take?
23. What are typical **settlement timings**, and what does each charity need to set up to
    receive funds?

---

Happy to jump on a call if that's faster for any of this. The blocking items in sections 1–3
are what we need to complete testing; the rest we can work through in parallel.

Thanks,

[Your name]
[Title], KindPath
[Phone]
