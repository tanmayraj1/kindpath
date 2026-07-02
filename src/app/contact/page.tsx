import type { Metadata } from "next";
import { Mail, MessageSquare, ShieldCheck, CalendarClock } from "lucide-react";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { ContactForm } from "@/components/marketing/contact-form";

export const metadata: Metadata = {
  title: "Book a demo",
  description: "Talk to the KindPath team about donation management for your faith community.",
};

const points = [
  { icon: CalendarClock, title: "A 30-minute walkthrough", body: "See the donor flow, receipts, and dashboards live." },
  { icon: ShieldCheck, title: "Compliance answered", body: "CRA receipts, CASL, and Canadian data residency — all your questions." },
  { icon: MessageSquare, title: "Tailored to you", body: "We'll map KindPath to how your community actually gives." },
];

export default function ContactPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <section className="border-b border-border bg-secondary/40">
          <div className="container py-16 sm:py-20">
            <div className="mx-auto max-w-2xl text-center">
              <span className="text-sm font-semibold uppercase tracking-wider text-brand-600">
                Contact
              </span>
              <h1 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
                Book a demo
              </h1>
              <p className="mt-4 text-lg text-muted-foreground">
                See how KindPath helps your temple, church, or mosque collect donations and issue
                compliant tax receipts — automatically.
              </p>
            </div>
          </div>
        </section>

        <section className="container py-16">
          <div className="mx-auto grid max-w-5xl gap-10 lg:grid-cols-[1fr_1.2fr]">
            <div className="flex flex-col gap-6">
              {points.map((p) => (
                <div key={p.title} className="flex gap-4">
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600">
                    <p.icon className="size-5" />
                  </span>
                  <div>
                    <h3 className="font-display font-semibold">{p.title}</h3>
                    <p className="text-sm text-muted-foreground">{p.body}</p>
                  </div>
                </div>
              ))}
              <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                <Mail className="size-4" /> Or email us at{" "}
                <a href="mailto:hello@kindpath.app" className="font-medium text-brand-600 hover:underline">
                  hello@kindpath.app
                </a>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
              <ContactForm />
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
