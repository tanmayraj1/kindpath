import Link from "next/link";
import { Lock } from "lucide-react";
import { Topbar } from "@/components/dashboard/topbar";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { requireOrgUser } from "@/lib/auth/guards";
import { FEATURES } from "@/lib/features";

export const metadata = { title: "Feature unavailable" };

export default async function UpgradePage({
  searchParams,
}: {
  searchParams: { feature?: string };
}) {
  const session = await requireOrgUser();
  const feature = FEATURES.find((f) => f.key === searchParams.feature);

  return (
    <>
      <Topbar title="Feature unavailable" user={{ name: session.name, email: session.email }} />
      <main className="flex flex-col gap-6 p-6">
        <Card className="mx-auto max-w-lg">
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <span className="grid size-12 place-items-center rounded-full bg-secondary text-muted-foreground">
              <Lock className="size-6" />
            </span>
            <h2 className="font-display text-xl font-bold">
              {feature ? feature.label : "This feature"} isn&apos;t enabled
            </h2>
            <p className="max-w-sm text-sm text-muted-foreground">
              {feature?.description ?? "This feature isn't part of your current plan."} Upgrading
              takes effect immediately — nothing you&apos;ve already recorded is affected.
            </p>
            {/* This page previously said "contact your account manager" and gave
                no email, no phone and no link — a dead end on the one screen
                whose whole purpose is to convert. */}
            <div className="mt-2 flex flex-wrap justify-center gap-2">
              <Link href="/contact" className={buttonVariants({ size: "sm" })}>
                Talk to us about upgrading
              </Link>
              <Link
                href="/dashboard/billing"
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                See your plan
              </Link>
            </div>
            <Link
              href="/dashboard"
              className="mt-1 text-sm text-muted-foreground hover:text-foreground hover:underline"
            >
              Back to dashboard
            </Link>
          </CardContent>
        </Card>
      </main>
    </>
  );
}
