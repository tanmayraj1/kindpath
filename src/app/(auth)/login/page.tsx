import Link from "next/link";
import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";
import { FormAlert } from "@/components/ui/form-alert";

export const metadata: Metadata = { title: "Sign in" };

/** Why a session was rejected, explained rather than silently bouncing to /login. */
const REASONS: Record<string, string> = {
  suspended:
    "This organization's account is currently suspended. Please contact your KindPath administrator.",
  disabled: "This account has been deactivated. Please contact your organization's administrator.",
  expired: "You were signed out because your password or access changed. Please sign in again.",
  no_portal_access:
    "You'll need to set a password before you can open your giving portal. Use “Set up portal access” below and we'll email you a link.",
};

/**
 * One sign-in page for four kinds of account.
 *
 * It used to say "Sign in to your KindPath dashboard" and offer a single "New to
 * KindPath? Create an account" link to /signup — which creates an entire
 * organization with a trialing subscription. A donor arriving from a dunning
 * email and following that link became a charity administrator.
 *
 * So the two audiences are named separately, and `next` decides which one leads:
 * somebody bounced from /portal is a donor, somebody bounced from /dashboard is
 * staff, and we already know which from the URL middleware built.
 */
export default function LoginPage({
  searchParams,
}: {
  searchParams: { reason?: string; next?: string };
}) {
  const notice = searchParams.reason ? REASONS[searchParams.reason] : null;
  const next = searchParams.next;
  const audience = next?.startsWith("/portal")
    ? "donor"
    : next?.startsWith("/dashboard") || next?.startsWith("/admin")
      ? "staff"
      : "unknown";

  const subtitle =
    audience === "donor"
      ? "Sign in to manage your giving."
      : audience === "staff"
        ? "Sign in to your KindPath dashboard."
        : "Donors, volunteers and staff all sign in here.";

  const donorLine = (
    <p className="text-center text-sm text-muted-foreground">
      Donated to a charity that uses KindPath?{" "}
      <Link href="/claim" className="font-medium text-brand-600 hover:underline">
        Set up portal access
      </Link>
    </p>
  );

  const orgLine = (
    <p className="text-center text-sm text-muted-foreground">
      Running a charity?{" "}
      <Link href="/signup" className="font-medium text-brand-600 hover:underline">
        Start a free trial
      </Link>
    </p>
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-2xl font-bold tracking-tight">Sign in</h1>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>

      {notice && <FormAlert variant="info">{notice}</FormAlert>}

      <LoginForm next={next} />

      <div className="flex flex-col gap-2 border-t border-border pt-5">
        {audience === "staff" ? (
          <>
            {orgLine}
            {donorLine}
          </>
        ) : (
          <>
            {donorLine}
            {orgLine}
          </>
        )}
      </div>
    </div>
  );
}
