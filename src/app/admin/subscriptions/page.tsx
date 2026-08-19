import { Topbar } from "@/components/dashboard/topbar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, Thead, Th, Tr, Td } from "@/components/ui/table";
import { requirePlatformAdmin } from "@/lib/auth/guards";
import { listSubscriptions } from "@/lib/queries/admin";
import { formatCAD } from "@/lib/utils";

export const metadata = { title: "Subscriptions" };

const statusVariant: Record<string, "success" | "warning" | "destructive" | "neutral"> = {
  active: "success",
  trialing: "warning",
  past_due: "destructive",
  cancelled: "neutral",
};

export default async function SubscriptionsPage() {
  const session = await requirePlatformAdmin();
  const subs = await listSubscriptions();

  return (
    <>
      <Topbar title="Subscriptions" user={{ name: session.name, email: session.email }} />
      <main className="flex flex-col gap-6 p-6">
        <Card>
          <CardContent className="p-6">
            <Table>
              <Thead>
                <Th>Organization</Th>
                <Th>Plan</Th>
                <Th>Cycle</Th>
                <Th>Next billing</Th>
                <Th className="text-right">Price</Th>
                <Th className="text-right">Status</Th>
              </Thead>
              <tbody>
                {subs.map((s) => (
                  <Tr key={s.id}>
                    <Td className="font-medium">{s.org}</Td>
                    <Td className="capitalize text-muted-foreground">{s.plan}</Td>
                    <Td className="capitalize text-muted-foreground">{s.cycle}</Td>
                    <Td className="text-muted-foreground">
                      {s.status === "trialing" && s.trialEndsAt
                        ? `Trial ends ${new Date(s.trialEndsAt).toLocaleDateString("en-CA")}`
                        : s.nextBillingDate
                          ? new Date(s.nextBillingDate).toLocaleDateString("en-CA")
                          : "—"}
                    </Td>
                    <Td className="text-right font-medium">
                      {/* The cycle is already in the row; hardcoding "/mo" showed an
                          annual org at $2,400/yr as $2,400/mo. */}
                      {formatCAD(s.price, { maximumFractionDigits: 0 })}/
                      {s.cycle === "annual" ? "yr" : "mo"}
                    </Td>
                    <Td className="text-right">
                      <Badge variant={statusVariant[s.status] ?? "neutral"} className="capitalize">
                        {s.status.replace("_", " ")}
                      </Badge>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </>
  );
}
