"use client";

import { useState } from "react";
import { useFormState } from "react-dom";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { updateOrgDetailsAsAdmin, type AdminState } from "@/app/admin/actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/auth/submit-button";

const initial: AdminState = {};
const selectCls =
  "flex h-11 w-full rounded-lg border border-input bg-background px-3.5 text-sm focus-visible:border-brand-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30";

type Props = {
  orgId: string;
  name: string;
  charityStatus: "registered" | "non_registered";
  craRegistrationNumber?: string | null;
  authorizedSignatory?: string | null;
  receiptLocality?: string | null;
};

export function OrgDetailsForm(props: Props) {
  const [state, action] = useFormState(updateOrgDetailsAsAdmin, initial);
  const [status, setStatus] = useState(props.charityStatus);

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
          <CheckCircle2 className="size-4 shrink-0" /> Saved.
        </div>
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor="name">Organization name</Label>
        <Input id="name" name="name" defaultValue={props.name} required />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="charityStatus">Charity status</Label>
        <select
          id="charityStatus"
          name="charityStatus"
          defaultValue={props.charityStatus}
          onChange={(e) => setStatus(e.target.value as Props["charityStatus"])}
          className={selectCls}
        >
          <option value="registered">Registered charity (official tax receipts)</option>
          <option value="non_registered">Not a registered charity (payment confirmations)</option>
        </select>
      </div>

      {status === "registered" && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="craRegistrationNumber">CRA registration number (BN/RR)</Label>
          <Input
            id="craRegistrationNumber"
            name="craRegistrationNumber"
            placeholder="123456789 RR 0001"
            defaultValue={props.craRegistrationNumber ?? ""}
          />
        </div>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="authorizedSignatory">Authorized signatory</Label>
          <Input
            id="authorizedSignatory"
            name="authorizedSignatory"
            defaultValue={props.authorizedSignatory ?? ""}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="receiptLocality">Place issued (locality)</Label>
          <Input
            id="receiptLocality"
            name="receiptLocality"
            defaultValue={props.receiptLocality ?? ""}
          />
        </div>
      </div>

      <div>
        <SubmitButton>Save details</SubmitButton>
      </div>
    </form>
  );
}
