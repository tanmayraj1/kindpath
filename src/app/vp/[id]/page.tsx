import { notFound } from "next/navigation";
import { BadgeCheck, BadgeX, Clock } from "lucide-react";
import { adminDb } from "@/lib/db";
import { verifyPassToken } from "@/lib/pass-links";
import { getSession } from "@/lib/auth/session";
import { Logo } from "@/components/brand/logo";
import { cn } from "@/lib/utils";

export const metadata = { title: "Volunteer pass", robots: { index: false } };

/**
 * Public pass verification page — the target of the QR on a volunteer pass.
 * Door staff scan the QR and see ACTIVE / REVOKED / EXPIRED at a glance.
 * Gated by the signed token in the QR (or an entitled session).
 */
export default async function PassVerifyPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { t?: string };
}) {
  const pass = await adminDb.volunteerPass.findUnique({
    where: { id: params.id },
    include: { volunteer: true, org: { select: { name: true, logoUrl: true } } },
  });
  if (!pass) notFound();

  let allowed = verifyPassToken(pass.id, searchParams.t);
  if (!allowed) {
    const session = await getSession();
    if (session) {
      allowed =
        session.kind === "platform" ||
        (session.kind === "org" && session.orgId === pass.orgId) ||
        (session.kind === "volunteer" && session.sub === pass.volunteerId);
    }
  }
  if (!allowed) notFound();

  const expired = !!pass.validUntil && pass.validUntil < new Date();
  const state =
    pass.status === "revoked"
      ? { label: "REVOKED", icon: BadgeX, tone: "bg-destructive/10 text-destructive border-destructive/30" }
      : pass.volunteer.status !== "active"
        ? { label: "INACTIVE VOLUNTEER", icon: BadgeX, tone: "bg-destructive/10 text-destructive border-destructive/30" }
        : expired
          ? { label: "EXPIRED", icon: Clock, tone: "bg-warning/10 text-warning-foreground border-warning/30" }
          : { label: "VALID", icon: BadgeCheck, tone: "bg-success/10 text-success border-success/30" };
  const Icon = state.icon;

  return (
    <div className="grid min-h-dvh place-items-center bg-secondary/40 p-6">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-background p-6 text-center shadow-sm">
        <Logo className="mx-auto" />
        <p className="mt-1 text-xs text-muted-foreground">Volunteer pass verification</p>

        <div className={cn("mx-auto mt-5 flex items-center justify-center gap-2 rounded-xl border px-4 py-3 font-display text-lg font-bold", state.tone)}>
          <Icon className="size-6" /> {state.label}
        </div>

        <div className="mt-5 flex flex-col gap-1">
          <p className="font-display text-xl font-bold">
            {pass.volunteer.firstName} {pass.volunteer.lastName}
          </p>
          {pass.volunteer.role && <p className="text-sm text-muted-foreground">{pass.volunteer.role}</p>}
          <p className="mt-2 text-sm font-medium">{pass.title}</p>
          <p className="text-xs text-muted-foreground">{pass.org.name}</p>
        </div>

        <dl className="mt-5 grid grid-cols-2 gap-2 rounded-xl bg-secondary/60 p-3 text-left text-xs">
          <dt className="text-muted-foreground">Serial</dt>
          <dd className="text-right font-mono">{pass.serial}</dd>
          <dt className="text-muted-foreground">Issued</dt>
          <dd className="text-right">{pass.issuedAt.toLocaleDateString("en-CA")}</dd>
          <dt className="text-muted-foreground">Valid until</dt>
          <dd className="text-right">
            {pass.validUntil ? pass.validUntil.toLocaleDateString("en-CA") : "No expiry"}
          </dd>
        </dl>
      </div>
    </div>
  );
}
