import type { Metadata } from "next";
import { LegalPage, Section } from "@/components/marketing/legal-page";

export const metadata: Metadata = {
  title: "Privacy policy",
  description:
    "How KindPath collects, uses, stores and protects personal information under PIPEDA and Quebec's Law 25.",
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy policy" updated="6 August 2026">
      <Section title="Who this covers">
        <p>
          KindPath is software used <em>by</em> Canadian charities and faith communities. Two
          different relationships are involved, and they are governed differently:
        </p>
        <ul className="ml-5 list-disc space-y-1.5">
          <li>
            <strong>Donor information</strong> — names, addresses, email addresses, giving history.
            The organization you gave to is the one that decides what happens to this information.
            KindPath processes it on that organization&apos;s behalf and under its instructions.
          </li>
          <li>
            <strong>Organization account information</strong> — staff names, sign-in credentials,
            billing details. KindPath is responsible for this directly.
          </li>
        </ul>
        <p>
          If you are a donor and you want your information corrected or removed, contact the
          organization you gave to. They can act on it immediately; we act on their instruction.
        </p>
      </Section>

      <Section title="What we collect, and why">
        <ul className="ml-5 list-disc space-y-1.5">
          <li>
            <strong>To issue tax receipts.</strong> The Income Tax Act requires an official donation
            receipt to carry the donor&apos;s name and address. We collect these because a receipt is
            invalid without them.
          </li>
          <li>
            <strong>To process gifts.</strong> Payment card details are entered directly with the
            payment provider and are never transmitted to or stored on KindPath&apos;s servers. We
            retain only a gateway token and the last four digits, where the gateway reports them.
          </li>
          <li>
            <strong>To keep the service working and secure.</strong> Sign-in times, audit records of
            who issued or voided a receipt, and error diagnostics.
          </li>
        </ul>
        <p>
          We do not sell personal information, and we do not use donor information to advertise to
          anyone.
        </p>
      </Section>

      <Section title="Consent to email (CASL)">
        <p>
          Transactional messages — your receipt, a failed-payment notice — are sent because you made
          a gift, and Canada&apos;s Anti-Spam Legislation permits them without separate consent.
        </p>
        <p>
          Marketing and newsletter messages are sent only to people who have opted in. Every such
          message identifies the sending organization and includes a one-click way to unsubscribe.
          You can change your preferences at any time in your donor portal.
        </p>
      </Section>

      <Section title="Where your information is stored">
        <p>
          Data is stored in Canada. Certain sub-processors — email delivery and error monitoring —
          may process limited information outside Canada. Personal information may be accessible to
          the courts or law enforcement of a jurisdiction where it is stored.
        </p>
        <p>
          Each organization&apos;s data is isolated at the database level using PostgreSQL row-level
          security, so one organization&apos;s staff cannot read another&apos;s records even in the
          event of an application-level fault. This isolation is verified automatically before every
          deployment.
        </p>
      </Section>

      <Section title="How long we keep it">
        <p>
          Records supporting an official donation receipt are retained as long as the Income Tax Act
          requires — currently a minimum of two years after the end of the last calendar year to
          which the receipt relates, and longer for certain records. This is why a receipt is
          <strong> voided rather than deleted</strong> when a gift is refunded: the record must
          survive, clearly marked as no longer valid.
        </p>
        <p>
          Information not subject to a retention obligation is deleted at the organization&apos;s
          instruction, or when an account closes.
        </p>
      </Section>

      <Section title="Your rights">
        <p>
          Under PIPEDA, and under Law 25 in Quebec, you may ask for access to the personal
          information held about you, ask for it to be corrected, withdraw consent to
          non-essential uses, and — in Quebec — request portability of the information you provided.
        </p>
        <p>
          Requests go to the organization that holds your record. KindPath supports them in
          responding and will act on their instruction.
        </p>
      </Section>

      <Section title="Security incidents">
        <p>
          If a breach creates a real risk of significant harm, affected organizations and, where
          required, the Office of the Privacy Commissioner of Canada and the Commission d&apos;accès
          à l&apos;information du Québec will be notified as the law requires.
        </p>
      </Section>

      <Section title="Contact">
        <p>
          Questions about this policy, or about how an organization handles your information, can be
          sent through the contact form on this site.
        </p>
      </Section>
    </LegalPage>
  );
}
