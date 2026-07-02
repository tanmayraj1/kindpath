import Link from "next/link";
import type { Metadata } from "next";
import { Check } from "lucide-react";
import { SignupForm } from "@/components/auth/signup-form";

export const metadata: Metadata = { title: "Start free trial" };

const perks = ["14-day free trial", "No credit card required", "Cancel anytime"];

export default function SignupPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-2xl font-bold tracking-tight">
          Start your free trial
        </h1>
        <p className="text-sm text-muted-foreground">
          Set up your organization in minutes.
        </p>
      </div>

      <ul className="flex flex-wrap gap-x-4 gap-y-1">
        {perks.map((perk) => (
          <li key={perk} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Check className="size-3.5 text-success" /> {perk}
          </li>
        ))}
      </ul>

      <SignupForm />

      <p className="text-center text-xs text-muted-foreground">
        By continuing you agree to KindPath&apos;s Terms and Privacy Policy.
      </p>
      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-brand-600 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
