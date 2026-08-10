import type { Metadata } from "next";
import { LegalPage, Section } from "@/components/marketing/legal-page";

export const metadata: Metadata = {
  title: "Data processing agreement",
  description:
    "How KindPath processes personal information on behalf of the Canadian charities that use it.",
};

export default function DpaPage() {
  return (
    <LegalPage title="Data processing agreement" updated="10 August 2026">
      <Section title="Who is responsible for what">
        <p>
          Your organization decides what donor information is collected and why. KindPath processes
          it on your instructions, and for no other purpose. In PIPEDA terms you remain accountable
          for the personal information under your control; KindPath is your service provider.
        </p>
        <p>
          Separately, KindPath is responsible for your own account information — staff names,
          sign-in credentials, billing records.
        </p>
      </Section>

      <Section title="What we do with donor information">
        <p>We use it only to:</p>
        <ul className="ml-5 list-disc space-y-1.5">
          <li>run the service you asked for — receipts, recurring giving, reporting;</li>
          <li>keep it secure and diagnose faults;</li>
          <li>meet a legal obligation that applies to us.</li>
        </ul>
        <p>
          We do not sell it, we do not use it to advertise, and we do not use one
          organization&apos;s data to benefit another.
        </p>
      </Section>

      <Section title="Isolation between organizations">
        <p>
          Each organization&apos;s data is separated at the database level using PostgreSQL
          row-level security, so a fault in the application cannot expose one organization&apos;s
          records to another. That isolation is verified automatically before every deployment, and
          a change that would weaken it fails the build rather than shipping.
        </p>
      </Section>

      <Section title="Sub-processors">
        <p>
          We use a small number of providers to operate the service: application hosting, a
          Canadian-region managed PostgreSQL database, transactional email delivery, and error
          monitoring. Payment card details are handled entirely by your own payment gateway and
          never reach KindPath&apos;s servers.
        </p>
        <p>
          We&apos;ll give you notice before adding a sub-processor that handles donor personal
          information, so you have the opportunity to object.
        </p>
      </Section>

      <Section title="Security">
        <p>
          Encryption in transit and at rest; gateway credentials sealed with AES-256-GCM so they are
          never readable in the database or in a backup; least-privilege database roles; multi-factor
          authentication available for staff accounts; audit logging of receipt issue and void,
          exports, and erasure requests.
        </p>
      </Section>

      <Section title="Breach notification">
        <p>
          If we become aware of a breach affecting your data, we will notify you without undue delay
          and give you the information you need to meet your own obligations to the Office of the
          Privacy Commissioner of Canada, the Commission d&apos;accès à l&apos;information du
          Québec, and to affected individuals.
        </p>
      </Section>

      <Section title="Donor requests">
        <p>
          Donors can access, correct, port and request erasure of their information directly in their
          donor portal, and your team can action the same requests from a donor&apos;s record. When a
          donor is erased, the receipts already issued to them are{" "}
          <strong className="text-foreground">retained</strong> — the Income Tax Act requires it, and
          each receipt keeps the name and address it was issued with so your records stay valid.
        </p>
      </Section>

      <Section title="Return and deletion">
        <p>
          You can export donors, donations and receipts at any time while your account is active. On
          termination we will provide an export on request, and delete your data once any applicable
          retention period has passed.
        </p>
      </Section>
    </LegalPage>
  );
}
