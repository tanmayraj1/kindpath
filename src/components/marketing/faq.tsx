"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Section, SectionHeading } from "@/components/ui/section";
import { cn } from "@/lib/utils";

const faqs = [
  {
    q: "Are the tax receipts actually CRA-compliant?",
    a: "Yes. For registered charities, KindPath generates official donation receipts with every CRA-required field — serial number, eligible amount, your registration number, donor name and address, and an authorized signature. Organizations that aren't registered charities issue clear payment confirmations instead.",
  },
  {
    q: "What if a donor receives something in return for their gift?",
    a: "KindPath supports split receipting. When a donor receives an advantage (like an event ticket or dinner), you record its value and the receipt automatically shows the reduced eligible amount — keeping you compliant.",
  },
  {
    q: "Can donors manage their own recurring donations?",
    a: "Absolutely. Donors get a self-service portal where they can pause, change the amount or frequency, update their payment method, and download any past receipt — all without contacting your office.",
  },
  {
    q: "How do payments work?",
    a: "Card and bank details are securely tokenized at the payment gateway and never stored on our servers, minimizing PCI-DSS scope. KindPath connects to your payment processor and handles recurring billing, retries, and refunds automatically.",
  },
  {
    q: "Is my data kept in Canada?",
    a: "Yes. KindPath is built for Canadian compliance — data is hosted in Canadian regions, and we're designed around PIPEDA and Quebec's Law 25. Donor communications follow CASL with built-in consent and unsubscribe.",
  },
  {
    q: "Is there a free trial?",
    a: "Every plan starts with a 14-day free trial. No credit card required to start, no setup fees, and you can cancel anytime.",
  },
];

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <Section id="faq" className="bg-secondary/40">
      <div className="container">
        <SectionHeading
          eyebrow="FAQ"
          title="Questions, answered"
          description="Everything you need to know about KindPath and Canadian donation compliance."
        />
        <div className="mx-auto mt-14 flex max-w-3xl flex-col gap-3">
          {faqs.map((faq, i) => {
            const isOpen = open === i;
            return (
              <div
                key={faq.q}
                className={cn(
                  "rounded-2xl border bg-card shadow-sm transition-colors",
                  isOpen ? "border-brand-200" : "border-border"
                )}
              >
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : i)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center justify-between gap-4 p-5 text-left"
                >
                  <span className="font-display text-base font-semibold">{faq.q}</span>
                  <ChevronDown
                    className={cn(
                      "size-5 shrink-0 text-brand-600 transition-transform duration-300",
                      isOpen && "rotate-180"
                    )}
                  />
                </button>
                <div
                  className={cn(
                    "grid transition-all duration-300 ease-out",
                    isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                  )}
                >
                  <div className="overflow-hidden">
                    <p className="px-5 pb-5 text-sm leading-relaxed text-muted-foreground">
                      {faq.a}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Section>
  );
}
