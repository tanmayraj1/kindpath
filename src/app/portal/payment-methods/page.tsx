import { CreditCard } from "lucide-react";
import { Topbar } from "@/components/dashboard/topbar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { RemoveMethodButton } from "@/components/portal/remove-method-button";
import { requireDonor } from "@/lib/auth/guards";
import { listDonorPaymentMethods } from "@/lib/queries/donor";

export const metadata = { title: "Payment methods" };

export default async function PaymentMethodsPage() {
  const session = await requireDonor();
  const methods = await listDonorPaymentMethods(session.orgId, session.sub);

  return (
    <>
      <Topbar title="Payment methods" user={{ name: session.name, email: session.email }} />
      <main className="flex flex-col gap-6 p-6">
        <Card>
          <CardContent className="p-6">
            {methods.length === 0 ? (
              <EmptyState
                icon={<CreditCard className="size-5" />}
                title="No saved payment methods"
                body="When you set up recurring giving, your tokenized card is saved here. We never store full card numbers."
              />
            ) : (
              <div className="flex flex-col gap-3">
                {methods.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between rounded-xl border border-border p-4"
                  >
                    <div className="flex items-center gap-3">
                      <span className="grid size-10 place-items-center rounded-lg bg-secondary text-muted-foreground">
                        <CreditCard className="size-5" />
                      </span>
                      <div>
                        <p className="font-medium">
                          {m.brand ?? "Card"} •••• {m.last4 ?? "····"}
                          {m.isDefault && (
                            <Badge variant="brand" className="ml-2">
                              Default
                            </Badge>
                          )}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {m.expMonth && m.expYear
                            ? `Expires ${String(m.expMonth).padStart(2, "0")}/${m.expYear}`
                            : "Tokenized at gateway"}
                        </p>
                      </div>
                    </div>
                    <RemoveMethodButton methodId={m.id} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </>
  );
}
