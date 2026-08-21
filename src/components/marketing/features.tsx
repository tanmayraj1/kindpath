"use client";

import {
  Repeat,
  FileCheck2,
  Users,
  LayoutDashboard,
  CreditCard,
  Landmark,
  BellRing,
  ShieldCheck,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Section, SectionHeading } from "@/components/ui/section";
import { Stagger, StaggerItem } from "@/components/motion/primitives";

const features = [
  {
    icon: FileCheck2,
    title: "CRA-compliant tax receipts",
    description:
      "Official donation receipts auto-generated on every gift, with serial numbers, eligible amounts, and your registration number. Non-registered orgs get clean payment confirmations.",
  },
  {
    icon: Repeat,
    title: "Recurring giving on autopilot",
    description:
      "Weekly, monthly, quarterly, or annual plans. Automatic billing, smart retries on failure, and donor self-service to pause or change anytime.",
  },
  {
    icon: Landmark,
    title: "Fund & designation tracking",
    description:
      "Let donors give to what matters — General, Building, Zakat, Sadaqah, Seva, or Missions. Report on every fund separately.",
  },
  {
    icon: Users,
    title: "Complete donor database",
    description:
      "Profiles, giving history, recurring status, communication preferences, and CASL consent — all in one searchable place.",
  },
  {
    icon: LayoutDashboard,
    title: "Insightful dashboards",
    description:
      "Track total raised, retention, top donors, and fund-wise revenue. Beautiful reporting your board will actually read.",
  },
  {
    icon: CreditCard,
    title: "Secure, tokenized payments",
    description:
      "Card details are tokenized at the gateway — never stored on our servers. PCI-DSS scope minimized by design.",
  },
  {
    icon: BellRing,
    title: "Automated communications",
    description:
      "Donation confirmations, receipt delivery, failed-payment alerts, and branded announcements — CASL-compliant by default.",
  },
  {
    icon: ShieldCheck,
    title: "Built for Canada",
    description:
      "PIPEDA & Quebec Law 25 aware, Canadian data residency, and GST/HST handled on your subscription. Compliance you can trust.",
  },
];

export function Features() {
  return (
    <Section id="features">
      <div className="container">
        <SectionHeading
          eyebrow="Everything you need"
          title="One platform for modern faith-based giving"
          description="From the first donation to year-end tax receipts, KindPath handles the busywork so your team can focus on community."
        />
        {/* Three columns rather than four. At lg the four-up grid gave each card
            a ~14em measure, so every description broke to six or seven ragged
            lines and the row read as a wall. Stagger replaces the hand-tuned
            `delay={(i % 4) * 80}`, which had to be renumbered by hand whenever a
            feature was added or reordered. */}
        <Stagger className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-3" step={0.06}>
          {features.map((feature) => (
            <StaggerItem key={feature.title} className="h-full">
              <Card interactive className="group h-full overflow-hidden">
                <CardContent className="flex h-full flex-col gap-4 p-6">
                  <span className="grid size-11 place-items-center rounded-xl bg-brand-50 text-brand-600 transition-all duration-300 group-hover:scale-110 group-hover:bg-brand-gradient group-hover:text-white">
                    <feature.icon className="size-5" aria-hidden />
                  </span>
                  <h3 className="font-display text-base font-semibold">{feature.title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </Section>
  );
}
