"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Section, SectionHeading } from "@/components/ui/section";
import { PLANS, type PlanKey } from "@/lib/plans";
import { cn, formatCAD } from "@/lib/utils";

type Plan = {
  name: string;
  tagline: string;
  monthly: number | null;
  features: string[];
  highlighted?: boolean;
  cta: string;
};

/**
 * Prices come from the plan catalog, not from this file.
 *
 * They were hardcoded here AND in lib/plans.ts, which is two sources of truth
 * for the number a customer is quoted. They had already drifted: Enterprise said
 * "Talk to sales" with no price on the public page while the catalog billed it
 * at $199/month, so an Enterprise customer could be invoiced an amount they were
 * never shown.
 */
const priceOf = (key: PlanKey) => PLANS.find((p) => p.key === key)?.priceMonthly ?? 0;

const plans: Plan[] = [
  {
    name: "Starter",
    tagline: "For small congregations getting started.",
    monthly: priceOf("starter"),
    cta: "Start free trial",
    features: [
      "Up to 250 donors",
      "One-time & recurring giving",
      "CRA-compliant tax receipts",
      "Branded donation page",
      "Email receipts & confirmations",
      "Donor self-service portal",
    ],
  },
  {
    name: "Community",
    tagline: "For growing faith communities.",
    monthly: priceOf("community"),
    highlighted: true,
    cta: "Start free trial",
    features: [
      "Up to 1,500 donors",
      "Everything in Starter, plus:",
      "Fund & designation tracking",
      "SMS notifications & alerts",
      "Donor segments & campaigns (CASL)",
      "Advanced reporting & exports",
      "Annual consolidated receipts",
    ],
  },
  {
    name: "Enterprise",
    tagline: "For large or multi-campus organizations.",
    monthly: priceOf("enterprise"),
    cta: "Talk to sales",
    features: [
      "Unlimited donors",
      "Everything in Community, plus:",
      "Multi-campus / multi-entity",
      "Priority support & onboarding",
      "Custom receipt templates",
      "Dedicated success manager",
      "SLA & audit support",
    ],
  },
];

export function Pricing() {
  const [annual, setAnnual] = useState(true);

  return (
    <Section id="pricing">
      <div className="container">
        <SectionHeading
          eyebrow="Membership plans"
          title="Simple pricing that grows with you"
          description="No setup fees, no long-term contracts. Every plan includes compliant tax receipts and a 14-day free trial."
        />

        {/* billing toggle — segmented control */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <div
            role="tablist"
            aria-label="Billing period"
            className="inline-flex items-center rounded-full border border-border bg-card p-1 shadow-sm"
          >
            <button
              type="button"
              role="tab"
              aria-selected={!annual}
              onClick={() => setAnnual(false)}
              className={cn(
                "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                !annual
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Monthly
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={annual}
              onClick={() => setAnnual(true)}
              className={cn(
                "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                annual
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Annual
            </button>
          </div>
          <Badge variant="success">Save 2 months</Badge>
        </div>

        {/* plans */}
        <div className="mx-auto mt-12 grid max-w-5xl gap-6 lg:grid-cols-3">
          {plans.map((plan) => (
            <PlanCard key={plan.name} plan={plan} annual={annual} />
          ))}
        </div>

        <p className="mt-8 text-center text-sm text-muted-foreground">
          Prices in CAD, plus applicable GST/HST. Payment processing fees billed separately.
        </p>
      </div>
    </Section>
  );
}

function PlanCard({ plan, annual }: { plan: Plan; annual: boolean }) {
  const price =
    plan.monthly == null ? null : annual ? Math.round(plan.monthly * 10) / 12 : plan.monthly;

  return (
    <div
      className={cn(
        "relative flex flex-col rounded-2xl border bg-card p-7 shadow-sm transition-all",
        plan.highlighted
          ? "border-brand-300 shadow-lg ring-1 ring-brand-200 lg:-mt-4 lg:mb-4"
          : "border-border hover:shadow-md"
      )}
    >
      {plan.highlighted && (
        <Badge
          variant="brand"
          className="absolute -top-3 left-1/2 -translate-x-1/2 bg-brand-gradient px-3 py-1 text-white"
        >
          <Sparkles className="size-3.5" /> Most popular
        </Badge>
      )}

      <h3 className="font-display text-xl font-bold">{plan.name}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{plan.tagline}</p>

      <div className="mt-6 flex items-end gap-1">
        {price == null ? (
          <span className="font-display text-4xl font-extrabold">Custom</span>
        ) : (
          <>
            <span className="font-display text-4xl font-extrabold">
              {formatCAD(price, { maximumFractionDigits: 0 })}
            </span>
            <span className="mb-1 text-sm text-muted-foreground">/mo</span>
          </>
        )}
      </div>
      {price != null && annual && (
        <p className="mt-1 text-xs text-muted-foreground">billed annually</p>
      )}

      <Link
        href={plan.monthly == null ? "/contact" : "/signup"}
        className={cn(
          buttonVariants({
            variant: plan.highlighted ? "accent" : "outline",
            size: "lg",
          }),
          "mt-6 w-full"
        )}
      >
        {plan.cta}
      </Link>

      <ul className="mt-7 flex flex-col gap-3">
        {plan.features.map((feature) => {
          const isHeader = feature.endsWith("plus:");
          return (
            <li
              key={feature}
              className={cn(
                "flex items-start gap-2.5 text-sm",
                isHeader && "font-medium text-foreground"
              )}
            >
              {!isHeader && (
                <Check className="mt-0.5 size-4 shrink-0 text-success" />
              )}
              <span className={cn(isHeader ? "text-foreground" : "text-muted-foreground")}>
                {feature}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
