import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { adminDb } from "@/lib/db";
import { readAccountTicket } from "@/lib/auth/account-ticket";
import { ChooseAccountForm } from "@/components/auth/choose-account-form";

export const metadata: Metadata = { title: "Choose an account", robots: { index: false } };
export const dynamic = "force-dynamic";

const ROLE_LABEL: Record<string, string> = {
  platform: "Platform administrator",
  org: "Staff account",
  donor: "Giving portal",
  volunteer: "Volunteer",
};

/**
 * Which account did they mean?
 *
 * Reached only when one email and password authenticated against more than one
 * account — legitimate here, because donors, volunteers and org users are unique
 * per organization rather than globally. A person can give to two charities, or
 * volunteer at the parish she also donates to.
 *
 * This runs AFTER the password, never before. Asking up front would tell an
 * anonymous visitor which charities an email address is connected to.
 */
export default async function ChooseAccountPage() {
  const ticket = await readAccountTicket();
  if (!ticket) redirect("/login");

  // Labels are resolved here rather than carried in the cookie, so a rename or a
  // disable between the two steps is reflected.
  const accounts = await Promise.all(
    ticket.accounts.map(async (a) => {
      let orgName: string | null = null;
      let name = "";
      let email = "";
      if (a.kind === "org") {
        const u = await adminDb.orgUser.findUnique({
          where: { id: a.id },
          include: { org: { select: { name: true } } },
        });
        orgName = u?.org.name ?? null;
        name = u?.name ?? "";
        email = u?.email ?? "";
      } else if (a.kind === "donor") {
        const d = await adminDb.donor.findUnique({
          where: { id: a.id },
          include: { org: { select: { name: true } } },
        });
        orgName = d?.org.name ?? null;
        name = d ? `${d.firstName} ${d.lastName}` : "";
        email = d?.email ?? "";
      } else if (a.kind === "volunteer") {
        const v = await adminDb.volunteer.findUnique({
          where: { id: a.id },
          include: { org: { select: { name: true } } },
        });
        orgName = v?.org.name ?? null;
        name = v ? `${v.firstName} ${v.lastName}` : "";
        email = v?.email ?? "";
      } else {
        const p = await adminDb.platformAdmin.findUnique({ where: { id: a.id } });
        name = p?.name ?? "";
        email = p?.email ?? "";
      }
      return { ...a, orgName, name, email, roleLabel: ROLE_LABEL[a.kind] ?? a.kind };
    })
  );

  const live = accounts.filter((a) => a.email);
  if (live.length === 0) redirect("/login");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-2xl font-bold tracking-tight">Choose an account</h1>
        <p className="text-sm text-muted-foreground">
          This email is used by {live.length} accounts. Which one would you like to open?
        </p>
      </div>
      <ChooseAccountForm accounts={live} email={live[0].email} />
    </div>
  );
}
