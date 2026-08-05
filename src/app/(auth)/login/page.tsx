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
};

export default function LoginPage({ searchParams }: { searchParams: { reason?: string } }) {
  const notice = searchParams.reason ? REASONS[searchParams.reason] : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-2xl font-bold tracking-tight">Welcome back</h1>
        <p className="text-sm text-muted-foreground">
          Sign in to your KindPath dashboard.
        </p>
      </div>

      {notice && <FormAlert variant="info">{notice}</FormAlert>}

      <LoginForm />

      <p className="text-center text-sm text-muted-foreground">
        New to KindPath?{" "}
        <Link href="/signup" className="font-medium text-brand-600 hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}
