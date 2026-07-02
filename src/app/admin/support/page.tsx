import Link from "next/link";
import { UserCog, ScrollText, KeyRound, Repeat } from "lucide-react";
import { Topbar } from "@/components/dashboard/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, Thead, Th, Tr, Td } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { RunBillingButton } from "@/components/admin/run-billing-button";
import { requirePlatformAdmin } from "@/lib/auth/guards";
import { adminDb } from "@/lib/db";

export const metadata = { title: "Support" };

export default async function SupportPage() {
  const session = await requirePlatformAdmin();
  const logs = await adminDb.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 25,
  });

  const tools = [
    {
      icon: UserCog,
      title: "Impersonate an org",
      body: "Sign in as an org admin to reproduce and resolve issues.",
      href: "/admin/organizations",
      cta: "Go to organizations",
    },
    {
      icon: KeyRound,
      title: "Reset a donor password",
      body: "Trigger a secure password reset for any donor.",
      href: "/admin/organizations",
      cta: "Coming soon",
    },
  ];

  return (
    <>
      <Topbar title="Support" user={{ name: session.name, email: session.email }} />
      <main className="flex flex-col gap-6 p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          {tools.map((t) => (
            <Card key={t.title}>
              <CardContent className="flex flex-col gap-3 p-5">
                <span className="grid size-10 place-items-center rounded-xl bg-brand-50 text-brand-600">
                  <t.icon className="size-5" />
                </span>
                <div>
                  <p className="font-semibold">{t.title}</p>
                  <p className="text-sm text-muted-foreground">{t.body}</p>
                </div>
                <Link
                  href={t.href}
                  className={buttonVariants({ variant: "outline", size: "sm" }) + " w-fit"}
                >
                  {t.cta}
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader className="flex-row items-center gap-2">
            <Repeat className="size-5 text-muted-foreground" />
            <CardTitle>Recurring billing</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              Charges all due recurring plans, issues receipts, and emails donors. In production a
              daily cron hits <code className="rounded bg-secondary px-1">/api/cron/billing</code>.
            </p>
            <RunBillingButton />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center gap-2">
            <ScrollText className="size-5 text-muted-foreground" />
            <CardTitle>Audit log</CardTitle>
          </CardHeader>
          <CardContent>
            {logs.length === 0 ? (
              <EmptyState
                icon={<ScrollText className="size-5" />}
                title="No audit events yet"
                body="Privileged actions like impersonation and org status changes are recorded here."
              />
            ) : (
              <Table>
                <Thead>
                  <Th>When</Th>
                  <Th>Actor</Th>
                  <Th>Action</Th>
                  <Th>Entity</Th>
                </Thead>
                <tbody>
                  {logs.map((l) => (
                    <Tr key={l.id}>
                      <Td className="text-muted-foreground">
                        {new Date(l.createdAt).toLocaleString("en-CA")}
                      </Td>
                      <Td className="text-muted-foreground">{l.actorType}</Td>
                      <Td className="font-medium">{l.action}</Td>
                      <Td className="text-muted-foreground">{l.entityType ?? "—"}</Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
    </>
  );
}
