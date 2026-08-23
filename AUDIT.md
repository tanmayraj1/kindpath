# AUDIT.md — pre-reskin parity checklist

Generated from source, not written by hand: `scripts/audit.py` walks every
`page.tsx` under `src/app`, plus the `@/components/*` files each one imports one
level deep — most interactive elements live in those, not in the page file.

This is the checklist the reskin is verified against. A restyle may change markup
structure, classes and wrappers freely; it may not change what is in these
columns. Regenerate after each surface and diff against this baseline:

```bash
python3 scripts/audit.py > AUDIT.md && git diff --stat AUDIT.md
```

A non-empty diff means the reskin changed behaviour, and that is a bug unless it
was explicitly asked for.

**74 pages.**

| Route | Links | Server actions | Submitted fields | Handlers |
|---|---|---|---|---|
| `/change-password` | — | `formAction` | `confirm`, `current`, `password` | — |
| `/claim` | `/login` | `formAction` | `email` | — |
| `/forgot` | `/login` | `formAction` | `email` | — |
| `/login/2fa` | `/login` | `formAction` | `code` | — |
| `/login/choose` | — | `formAction` | `account`, `email` | — |
| `/login/code` | `/login` | `requestAction`, `verifyAction` | `code`, `email`, `next` | `e` |
| `/login` | `/claim`, `/forgot`, `/signup` | `formAction` | `email`, `next`, `password` | — |
| `/reset` | `/forgot`, `/login` | `formAction` | `confirm`, `password`, `token` | — |
| `/signup` | `/login` | `formAction` | `email`, `name`, `org`, `password` | — |
| `/verify` | `/dashboard` | — | — | — |
| `/dashboard/assistant` | — | — | — | `document`, `e`, `nav`, `send` |
| `/dashboard/billing` | — | — | — | `document`, `nav` |
| `/dashboard/campaigns/[id]` | `/dashboard/campaigns` | — | — | `document`, `nav` |
| `/dashboard/campaigns` | — | `action`, `updateCampaign`, `updateEvent`, `updateMembershipPlan`, `updatePledge`, `updateTeamMember`, `updateTicketType`, `updateVolunteer` | `accent`, `deadline`, `description`, `fundId`, `goalAmount`, `title` | `document`, `nav` |
| `/dashboard/communications` | — | `action` | `message`, `segment`, `subject` | `document`, `e`, `nav` |
| `/dashboard/donations/new` | — | `action` | `addressLine1`, `advantageDescription`, `advantageValue`, `amount`, `city`, `email`, `firstName`, `fundId`, `lastName`, `postalCode`, `province`, `type` | `document`, `nav` |
| `/dashboard/donors/[id]` | `/dashboard/donors` | `action` | `addressLine1`, `city`, `donorId`, `emailMarketing`, `firstName`, `lastName`, `notes`, `phone`, `postalCode`, `province`, `smsMarketing` | `document`, `nav`, `setOpen`, `start` |
| `/dashboard/donors` | — | `action` | `q` | `document`, `nav` |
| `/dashboard/events/[id]` | `/dashboard/events` | `action`, `updateCampaign`, `updateEvent`, `updateMembershipPlan`, `updatePledge`, `updateTeamMember`, `updateTicketType`, `updateVolunteer` | `advantage`, `eventId`, `name`, `price` | `document`, `nav` |
| `/dashboard/events` | — | `action` | `description`, `location`, `startsAt`, `ticketAdvantage`, `ticketName`, `ticketPrice`, `title` | `document`, `nav` |
| `/dashboard/funds` | — | `action`, `updateFund` | `code`, `name` | `document`, `nav` |
| `/dashboard/giving` | — | — | — | `copy`, `document`, `nav` |
| `/dashboard/memberships` | — | `action`, `updateCampaign`, `updateEvent`, `updateMembershipPlan`, `updatePledge`, `updateTeamMember`, `updateTicketType`, `updateVolunteer` | `amount`, `description`, `frequency`, `name`, `q` | `document`, `nav` |
| `/dashboard/onboarding/done` | `/dashboard`, `/dashboard/settings#payments` | — | — | `copy`, `document`, `nav` |
| `/dashboard/onboarding` | `/dashboard/onboarding?step=3` | `action`, `skipGatewayAndFinish` | `addressLine1`, `authorizedSignatory`, `charityStatus`, `city`, `craRegistrationNumber`, `cycle`, `logoUrl`, `plan`, `postalCode`, `primaryColor`, `province`, `receiptMessage` | `document`, `e`, `nav`, `setCycle`, `setPlan` |
| `/dashboard` | `/dashboard/communications`, `/dashboard/donations/new`, `/dashboard/donors`, `/dashboard/onboarding`, `/dashboard/settings#payments` | — | — | `document`, `nav` |
| `/dashboard/pledges` | — | `action`, `updateCampaign`, `updateEvent`, `updateMembershipPlan`, `updatePledge`, `updateTeamMember`, `updateTicketType`, `updateVolunteer` | `amount`, `campaignId`, `donorEmail`, `donorName`, `dueDate`, `note`, `q` | `document`, `nav` |
| `/dashboard/receipts` | — | `action` | `q` | `document`, `e`, `nav`, `run` |
| `/dashboard/recurring` | — | `action` | `q` | `document`, `nav` |
| `/dashboard/reports` | — | — | — | `document`, `nav` |
| `/dashboard/security` | — | `activateAction`, `disableAction` | `code` | `document`, `nav`, `navigator`, `start` |
| `/dashboard/settings` | `https://dashboard.stripe.com/apikeys` | `action`, `disconnectGateway`, `formAction` | `addressLine1`, `authorizedSignatory`, `charityStatus`, `city`, `craRegistrationNumber`, `email`, `logo`, `mid`, `minReceiptAmount`, `name`, `password`, `postalCode`, `primaryColor`, `province` _+8_ | `document`, `e`, `nav`, `start` |
| `/dashboard/team` | — | `action`, `updateCampaign`, `updateEvent`, `updateMembershipPlan`, `updatePledge`, `updateTeamMember`, `updateTicketType`, `updateVolunteer` | `email`, `name`, `role` | `document`, `e`, `nav`, `run` |
| `/dashboard/upgrade` | `/contact`, `/dashboard`, `/dashboard/billing` | — | — | `document`, `nav` |
| `/dashboard/volunteers` | — | `action`, `updateCampaign`, `updateEvent`, `updateMembershipPlan`, `updatePledge`, `updateTeamMember`, `updateTicketType`, `updateVolunteer` | `email`, `firstName`, `lastName`, `phone`, `q`, `role`, `title`, `validUntil`, `volunteerId` | `document`, `nav`, `start` |
| `/admin/analytics` | — | — | — | `document`, `nav` |
| `/admin/audit` | — | `action` | `q` | `document`, `nav` |
| `/admin/organizations/[id]/donors` | — | `action`, `basePath` | `q` | — |
| `/admin/organizations/[id]/features` | — | — | — | `start` |
| `/admin/organizations/[id]/funds` | — | `action`, `basePath` | `q` | — |
| `/admin/organizations/[id]` | — | — | — | — |
| `/admin/organizations/[id]/receipts` | — | `action`, `basePath` | `q` | — |
| `/admin/organizations/[id]/recurring` | — | `action`, `basePath` | `q` | — |
| `/admin/organizations/[id]/settings` | — | `action` | `authorizedSignatory`, `charityStatus`, `craRegistrationNumber`, `email`, `mid`, `name`, `orgId`, `password`, `provider`, `receiptLocality`, `secretKey`, `stripeWebhookSecret`, `termId`, `wvNumber` | `e` |
| `/admin/organizations/[id]/subscription` | — | `action` | `cycle`, `orgId`, `plan`, `price`, `status`, `trialDays` | — |
| `/admin/organizations/[id]/users` | — | `adminInviteOrgUser` | — | `async` |
| `/admin/organizations` | — | `action` | `adminEmail`, `adminName`, `charityStatus`, `name`, `plan` | `document`, `nav` |
| `/admin` | `/admin/organizations` | — | — | `document`, `nav` |
| `/admin/revenue` | — | — | — | `document`, `nav`, `start` |
| `/admin/subscriptions` | — | — | — | `document`, `nav` |
| `/admin/support` | `/admin/audit` | — | — | `document`, `nav`, `run` |
| `/c/[slug]/[campaign]` | — | `completeFormAction` | `addressLine1`, `amount`, `campaignId`, `chargeRef`, `city`, `email`, `firstName`, `frequency`, `fundId`, `lastName`, `postalCode`, `province`, `slug` | `e`, `pay`, `setFrequency`, `setStep` |
| `/contact` | `/`, `/login`, `/signup`, `https://rytfulmedia.in`, `mailto:hello@kindpath.app` | `action` | `email`, `message`, `name`, `org` | `setOpen` |
| `/dpa` | — | — | — | — |
| `/e/[slug]/[event]` | — | `formAction` | `addressLine1`, `chargeRef`, `city`, `email`, `eventId`, `firstName`, `lastName`, `postalCode`, `province`, `quantity`, `slug`, `ticketTypeId` | `e`, `pay`, `setStep`, `setTtId` |
| `/give/[slug]` | — | `completeFormAction` | `addressLine1`, `amount`, `campaignId`, `chargeRef`, `city`, `email`, `firstName`, `frequency`, `fundId`, `lastName`, `postalCode`, `province`, `slug` | `e`, `pay`, `setFrequency`, `setStep` |
| `/give/[slug]/response` | — | `action` | `addressLine1`, `amount`, `campaignId`, `chargeRef`, `city`, `email`, `eventId`, `firstName`, `frequency`, `fundId`, `lastName`, `planId`, `postalCode`, `province` _+3_ | — |
| `/join/[slug]` | — | `formAction` | `addressLine1`, `chargeRef`, `city`, `email`, `firstName`, `lastName`, `planId`, `postalCode`, `province`, `slug` | `pay`, `setPlanId`, `setStep` |
| `/kiosk/[slug]` | — | `action` | `addressLine1`, `amount`, `campaignId`, `chargeRef`, `city`, `email`, `firstName`, `frequency`, `fundId`, `lastName`, `postalCode`, `province`, `slug` | `e`, `pay`, `reset`, `setAmount` |
| `/mock-gateway/[paymentOrderId]` | — | — | — | `authorize` |
| `/` | `#how-it-works`, `/`, `/contact`, `/login`, `/signup`, `https://rytfulmedia.in` | — | — | `setAnnual`, `setOpen` |
| `/portal/history` | — | — | — | `document`, `nav` |
| `/portal/my-data` | `/api/portal/my-data`, `/api/portal/my-data?format=csv` | — | — | `document`, `nav` |
| `/portal` | `/portal/history`, `/portal/recurring` | — | — | `document`, `nav` |
| `/portal/payment-methods` | — | — | — | `document`, `nav` |
| `/portal/profile` | — | `action` | `addressLine1`, `city`, `emailMarketing`, `firstName`, `lastName`, `phone`, `postalCode`, `province`, `smsMarketing` | `document`, `nav` |
| `/portal/receipts` | — | — | — | `document`, `nav` |
| `/portal/recurring` | `/portal/payment-methods` | `updatePlanAmount` | — | `document`, `nav`, `start` |
| `/privacy` | — | — | — | — |
| `/r/[id]` | `/` | — | — | — |
| `/terms` | — | — | — | — |
| `/volunteer` | — | — | — | `document`, `nav` |
| `/volunteer/profile` | — | `action` | `currentPassword`, `newPassword` | `document`, `nav` |
| `/vp/[id]` | — | — | — | — |
