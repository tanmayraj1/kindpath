"use client";

import { useFormState } from "react-dom";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { updateSubscription, type AdminState } from "@/app/admin/actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/auth/submit-button";

const initial: AdminState = {};
const selectCls =
  "flex h-11 w-full rounded-lg border border-input bg-background px-3.5 text-sm focus-visible:border-brand-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30";

type Props = {
  orgId: string;
  plan: string;
  cycle: string;
  price: number;
  status: string;
};

export function SubscriptionForm(props: Props) {
  const [state, action] = useFormState(updateSubscription, initial);

  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="orgId" value={props.orgId} />

      {state.error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" /> {state.error}
        </div>
      )}
      {state.ok && (
        <div className="flex items-center gap-2 rounded-lg border border-success/20 bg-success/5 px-3 py-2.5 text-sm text-success">
          <CheckCircle2 className="size-4 shrink-0" /> Subscription updated.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="plan">Plan</Label>
          <select id="plan" name="plan" defaultValue={props.plan} className={selectCls}>
            <option value="starter">Starter</option>
            <option value="community">Community</option>
            <option value="enterprise">Enterprise</option>
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="status">Status</Label>
          <select id="status" name="status" defaultValue={props.status} className={selectCls}>
            <option value="trialing">Trialing</option>
            <option value="active">Active (access granted)</option>
            <option value="past_due">Past due</option>
            <option value="cancelled">Cancelled (access revoked)</option>
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="cycle">Billing cycle</Label>
          <select id="cycle" name="cycle" defaultValue={props.cycle} className={selectCls}>
            <option value="monthly">Monthly</option>
            <option value="annual">Annual</option>
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="price">Price (CAD)</Label>
          <Input id="price" name="price" inputMode="decimal" defaultValue={props.price} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="trialDays">Trial length (days, if trialing)</Label>
          <Input id="trialDays" name="trialDays" inputMode="numeric" placeholder="14" />
        </div>
      </div>

      <div>
        <SubmitButton>Save subscription</SubmitButton>
      </div>
    </form>
  );
}
