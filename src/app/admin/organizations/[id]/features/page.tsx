import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FeatureToggle } from "@/components/admin/feature-toggle";
import { getOrgManage } from "@/lib/queries/admin";
import { FEATURES, getEffectiveFeatures, featureSource } from "@/lib/features";

// Static rather than generateMetadata: the detail pages already load their
// record inside a withTenant transaction, and Prisma calls are not deduped
// across a second metadata pass — naming the row in the tab would cost every
// one of these pages a duplicate query. The section name is what actually
// fixes the defect: without it these 13 pages fell through to the root
// layout's marketing title, so every open tab read "KindPath — Donation
// management for faith communities" and none could be told apart.
export const metadata = { title: "Organization features" };

export default async function OrgFeatures({ params }: { params: { id: string } }) {
  const org = await getOrgManage(params.id);
  if (!org) notFound();

  const effective = getEffectiveFeatures(org.plan, org.featureOverrides);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Feature access</CardTitle>
        <p className="text-sm text-muted-foreground">
          Each plan includes a baseline of features. Grant or revoke individual features to override
          the plan for this institution — changes take effect immediately in their dashboard.
          Use reset (↺) to return a feature to its plan default.
        </p>
      </CardHeader>
      <CardContent>
        <div className="divide-y divide-border">
          {FEATURES.map((f) => (
            <FeatureToggle
              key={f.key}
              orgId={org.id}
              featureKey={f.key}
              label={f.label}
              description={f.description}
              enabled={effective[f.key]}
              source={featureSource(org.plan, org.featureOverrides, f.key)}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
