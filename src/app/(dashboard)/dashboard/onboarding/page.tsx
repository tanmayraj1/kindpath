import { redirect } from "next/navigation";
import { Topbar } from "@/components/dashboard/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireOrgAdmin } from "@/lib/auth/guards";
import { getOrg } from "@/lib/queries/org";
import { withTenant } from "@/lib/tenant";
import { OrgProfileStep, BrandingStep, PlanStep } from "@/components/onboarding/steps";
import { cn } from "@/lib/utils";

export const metadata = { title: "Set up your organization" };

const STEPS = [
  { n: 1, title: "Organization & receipts", blurb: "The legal details that appear on every receipt." },
  { n: 2, title: "Your branding", blurb: "Make your giving page and receipts look like you." },
  { n: 3, title: "Pick your plan", blurb: "Start free for 14 days on any plan." },
];

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: { step?: string };
}) {
  const session = await requireOrgAdmin();
  const org = await getOrg(session.orgId);
  if (!org) redirect("/dashboard");
  if (org.onboardedAt) redirect("/dashboard");

  const step = Math.min(3, Math.max(1, Number(searchParams.step) || 1));
  const sub = await withTenant(session.orgId, (tx) =>
    tx.subscription.findUnique({ where: { orgId: session.orgId } })
  );
  const current = STEPS[step - 1];

  return (
    <>
      <Topbar title="Welcome to KindPath" user={{ name: session.name, email: session.email }} />
      <main className="flex flex-col gap-6 p-6">
        <ol className="flex max-w-3xl items-center gap-2" aria-label="Setup progress">
          {STEPS.map((s, i) => (
            <li key={s.n} className="flex flex-1 items-center gap-2">
              <span
                className={cn(
                  "grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold",
                  s.n < step && "bg-success text-white",
                  s.n === step && "bg-brand-600 text-white",
                  s.n > step && "bg-secondary text-muted-foreground"
                )}
              >
                {s.n}
              </span>
              <span
                className={cn(
                  "hidden text-xs font-medium sm:block",
                  s.n === step ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {s.title}
              </span>
              {i < STEPS.length - 1 && <span className="h-px flex-1 bg-border" aria-hidden />}
            </li>
          ))}
        </ol>

        <Card className={step === 3 ? "max-w-4xl" : "max-w-2xl"}>
          <CardHeader>
            <CardTitle>{current.title}</CardTitle>
            <p className="text-sm text-muted-foreground">{current.blurb}</p>
          </CardHeader>
          <CardContent>
            {step === 1 && (
              <OrgProfileStep
                charityStatus={(org.charityStatus as "registered" | "non_registered") ?? "non_registered"}
                craRegistrationNumber={org.craRegistrationNumber}
                authorizedSignatory={org.authorizedSignatory}
                addressLine1={org.addressLine1}
                city={org.city}
                province={org.province}
                postalCode={org.postalCode}
              />
            )}
            {step === 2 && (
              <BrandingStep
                primaryColor={org.primaryColor}
                logoUrl={org.logoUrl}
                receiptMessage={org.receiptMessage}
              />
            )}
            {step === 3 && <PlanStep plan={sub?.plan ?? "starter"} cycle={sub?.cycle ?? "monthly"} />}
          </CardContent>
        </Card>
      </main>
    </>
  );
}
