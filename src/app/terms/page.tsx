import type { Metadata } from "next";
import { LegalPage, Section } from "@/components/marketing/legal-page";

export const metadata: Metadata = {
  title: "Terms of service",
  description: "The terms under which Canadian charities and faith communities use KindPath.",
};

export default function TermsPage() {
  return (
    <LegalPage title="Terms of service" updated="6 August 2026">
      <Section title="What KindPath is">
        <p>
          KindPath is software for managing donations, donors and receipts. It is a tool, not an
          advisor: it does not provide legal, tax or accounting advice, and using it does not make
          KindPath responsible for your organization&apos;s compliance with the Income Tax Act.
        </p>
      </Section>

      <Section title="Your responsibilities as a registered charity">
        <p>
          An official donation receipt is issued by <em>your</em> organization, under your charity
          registration number and your authorized signatory. You are responsible for:
        </p>
        <ul className="ml-5 list-disc space-y-1.5">
          <li>the accuracy of your registration number, legal name and signatory details;</li>
          <li>
            determining the eligible amount of each gift, including the value of any advantage
            received by the donor;
          </li>
          <li>reviewing the receipt template with your own advisors before issuing receipts;</li>
          <li>retaining records for the period the Income Tax Act requires.</li>
        </ul>
        <p>
          KindPath produces receipts from the information you supply. It cannot verify that the
          information is correct.
        </p>
      </Section>

      <Section title="Payments">
        <p>
          Donations are processed by a third-party payment provider under your organization&apos;s own
          merchant agreement. Funds settle from the provider to your organization; KindPath does not
          hold, direct or take a share of donated funds.
        </p>
      </Section>

      <Section title="Fees and billing">
        <p>
          Subscription fees are stated when you sign up. Trials are genuinely free — no payment
          method is collected up front, and nothing is charged when a trial ends. Invoices are issued
          in Canadian dollars, with GST or HST applied according to your province.
        </p>
        <p>
          If an invoice goes unpaid, you keep full access for a grace period, after which the
          dashboard is paused. <strong>Nothing is deleted.</strong> Donor records, donation history
          and every receipt already issued remain intact and are restored as soon as the account is
          settled — a charity must not lose its statutory records because of a billing dispute.
        </p>
      </Section>

      <Section title="Your data">
        <p>
          Your organization&apos;s data belongs to your organization. You can export donors,
          donations and receipts as CSV at any time while your account is active. On request we will
          provide an export after closure, and delete your data once any applicable retention period
          has passed.
        </p>
      </Section>

      <Section title="Acceptable use">
        <p>
          Do not use KindPath to issue receipts for gifts that were not received, to solicit on
          behalf of an organization you are not authorized to represent, or to send messages to
          people who have not consented to receive them.
        </p>
      </Section>

      <Section title="Availability and liability">
        <p>
          We aim for continuous availability but do not guarantee uninterrupted service. To the
          extent Canadian law permits, KindPath&apos;s aggregate liability is limited to the
          subscription fees you paid in the twelve months preceding the claim. Nothing in these terms
          limits liability that cannot lawfully be limited.
        </p>
      </Section>

      <Section title="Changes and termination">
        <p>
          Either party may end the agreement with notice. Material changes to these terms will be
          communicated to account administrators before they take effect. These terms are governed by
          the laws of the province in which your organization is located.
        </p>
      </Section>
    </LegalPage>
  );
}
