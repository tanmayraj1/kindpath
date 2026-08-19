"use client";

import { useFormState } from "react-dom";
import { Building2, HeartHandshake, Shield, User } from "lucide-react";
import { chooseAccountAction, type AuthState } from "@/app/(auth)/actions";
import { FormAlert } from "@/components/ui/form-alert";
import { SubmitButton } from "./submit-button";

const initial: AuthState = {};

const ICON = {
  platform: Shield,
  org: Building2,
  donor: User,
  volunteer: HeartHandshake,
} as const;

type Account = {
  kind: keyof typeof ICON;
  id: string;
  orgName: string | null;
  name: string;
  roleLabel: string;
};

/**
 * One submit button per account.
 *
 * The selection rides on the button's own name/value rather than hidden inputs:
 * only the clicked submitter is included in the form data, whereas every hidden
 * input in a form is submitted regardless of which button was pressed — which
 * would make the choice ambiguous.
 *
 * The chosen id is checked against the signed ticket server-side, so tampering
 * with these values selects nothing — the ticket lists exactly the accounts the
 * password already matched.
 */
export function ChooseAccountForm({ accounts, email }: { accounts: Account[]; email: string }) {
  const [state, formAction] = useFormState(chooseAccountAction, initial);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <FormAlert>{state.error}</FormAlert>
      <input type="hidden" name="email" value={email} />

      {accounts.map((a) => {
        const Icon = ICON[a.kind] ?? User;
        return (
          <SubmitButton
            key={`${a.kind}:${a.id}`}
            name="account"
            value={`${a.kind}:${a.id}`}
            variant="outline"
            className="h-auto w-full justify-start gap-3 px-4 py-3 text-left"
          >
            <Icon className="size-5 shrink-0 text-brand-600" aria-hidden />
            <span className="flex flex-col">
              <span className="font-medium">{a.orgName ?? "KindPath"}</span>
              <span className="text-xs text-muted-foreground">
                {a.roleLabel}
                {a.name ? ` · ${a.name}` : ""}
              </span>
            </span>
          </SubmitButton>
        );
      })}
    </form>
  );
}
