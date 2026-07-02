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
              {feature?.description ?? "This feature isn't part of your current plan."} Contact your
              KindPath account manager to enable it for your organization.
            </p>
            <Link href="/dashboard" className={buttonVariants({ size: "sm" }) + " mt-2"}>
              Back to dashboard
            </Link>
          </CardContent>
        </Card>
      </main>
    </>
  );
}
