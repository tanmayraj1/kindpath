import Link from "next/link";
import { UserCog, ScrollText, KeyRound, Repeat } from "lucide-react";
import { Topbar } from "@/components/dashboard/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, Thead, Th, Tr, Td } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { RunBillingButton } from "@/components/admin/run-billing-button";
import { requirePlatformAdmin } from "@/lib/auth/guards";
import { listAuditLog } from "@/lib/queries/audit";
import { listJobRuns, getJobHealth, STALE_AFTER_HOURS } from "@/lib/job-runs";

export const metadata = { title: "Support" };

export default async function SupportPage() {
  const session = await requirePlatformAdmin();
  // A recent slice only; the full, filterable trail lives at /admin/audit.
  const [logs, billingRuns, campaignRuns, billingHealth, campaignHealth] = await Promise.all([
    listAuditLog({ page: 1, size: 10, q: "", skip: 0 }),
    listJobRuns("billing", 8),
    listJobRuns("campaigns", 8),
    getJobHealth("billing"),
    getJobHealth("campaigns"),
  ]);
  const jobs = [
    { name: "Recurring billing", job: "billing", runs: billingRuns, health: billingHealth },
    { name: "Campaign sending", job: "campaigns", runs: campaignRuns, health: campaignHealth },
  ];

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
      // This card previously said "Coming soon" on a real <Link> that silently
      // navigated to /admin/organizations — for a feature that did not exist
      // anywhere in the product. It does now: open the org, find the donor, and
      // use the Portal access card on their record.
      title: "Help a donor into their portal",
      body: "Send a portal setup or password reset link from any donor's record.",
      href: "/admin/organizations",
      cta: "Find the organization",
    },
    {
      icon: ScrollText,
      title: "Audit log",
      body: "Who did what, to which record, and exactly what changed.",
      href: "/admin/audit",
      cta: "Open the audit log",
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

        {/* The heartbeat ledger was written on every cron run and displayed
            nowhere, so "did last night's billing actually run?" had no answer in
            the product — the failure this table exists to catch is silence. */}
        <Card>
          <CardHeader className="flex-row items-center gap-2">
            <Repeat className="size-5 text-muted-foreground" />
            <CardTitle>Scheduled jobs</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            {jobs.map((j) => (
              <div key={j.job} className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{j.name}</span>
                  <Badge variant={j.health.stale ? "destructive" : "success"}>
                    {j.health.stale
                      ? `No success in ${STALE_AFTER_HOURS}h`
                      : "Healthy"}
                  </Badge>
                  <code className="rounded bg-secondary px-1 text-xs">/api/cron/{j.job}</code>
                </div>
                {j.runs.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    This job has never run. If the schedule is configured, check CRON_SECRET
                    matches on both sides — a mismatch fails silently.
                  </p>
                ) : (
                  <Table>
                    <Thead>
                      <Th>Started</Th>
                      <Th>Status</Th>
                      <Th>Took</Th>
                      <Th>Result</Th>
                    </Thead>
                    <tbody>
                      {j.runs.map((r) => (
                        <Tr key={r.id}>
                          <Td className="whitespace-nowrap text-muted-foreground">
                            {new Date(r.startedAt).toLocaleString("en-CA")}
                          </Td>
                          <Td>
                            <Badge
                              variant={
                                r.status === "ok"
                                  ? "success"
                                  : r.status === "running"
                                    ? "warning"
                                    : "destructive"
                              }
                            >
                              {r.status}
                            </Badge>
                          </Td>
                          <Td className="text-muted-foreground">
                            {r.durationMs != null ? `${(r.durationMs / 1000).toFixed(1)}s` : "—"}
                          </Td>
                          <Td className="max-w-md truncate text-xs text-muted-foreground">
                            {r.error ?? (r.summary ? JSON.stringify(r.summary) : "—")}
                          </Td>
                        </Tr>
                      ))}
                    </tbody>
                  </Table>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center gap-2">
            <ScrollText className="size-5 text-muted-foreground" />
            <CardTitle>Recent activity</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {logs.rows.length === 0 ? (
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
                  {logs.rows.map((l) => (
                    <Tr key={l.id}>
                      <Td className="whitespace-nowrap text-muted-foreground">
                        {new Date(l.createdAt).toLocaleString("en-CA")}
                      </Td>
                      <Td className="text-muted-foreground">{l.actorLabel}</Td>
                      <Td className="font-medium">{l.action}</Td>
                      <Td className="text-muted-foreground">
                        {l.entityType ?? "—"}
                        {l.orgName ? ` · ${l.orgName}` : ""}
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            )}
            <Link
              href="/admin/audit"
              className={buttonVariants({ variant: "outline", size: "sm" }) + " w-fit"}
            >
              View the full audit log
            </Link>
          </CardContent>
        </Card>
      </main>
    </>
  );
}
