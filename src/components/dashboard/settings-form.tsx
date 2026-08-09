"use client";

import { useState } from "react";
import { useFormState } from "react-dom";
import { updateOrgSettings, type ActionState } from "@/app/(dashboard)/dashboard/actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormAlert } from "@/components/ui/form-alert";
import { SubmitButton } from "@/components/auth/submit-button";
import { PROVINCES } from "@/lib/tax";

const initial: ActionState = {};

type Props = {
  name: string;
  charityStatus: "registered" | "non_registered";
  craRegistrationNumber?: string | null;
  authorizedSignatory?: string | null;
  receiptLocality?: string | null;
  primaryColor?: string | null;
  receiptMessage?: string | null;
  receiptFooter?: string | null;
  receiptPrefix?: string | null;
  receiptMode: "per_gift" | "annual" | "both";
  minReceiptAmount: number;
  province?: string | null;
  addressLine1?: string | null;
  city?: string | null;
  postalCode?: string | null;
};

const selectCls =
  "flex h-11 w-full rounded-lg border border-input bg-background px-3.5 text-sm focus-visible:border-brand-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30";

export function SettingsForm(props: Props) {
  const [state, action] = useFormState(updateOrgSettings, initial);
  const [status, setStatus] = useState(props.charityStatus);

  return (
    <form action={action} className="flex flex-col gap-5">
      <FormAlert>{state.error}</FormAlert>
      {state.ok && <FormAlert variant="success">Settings saved.</FormAlert>}

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
          className="flex h-11 w-full rounded-lg border border-input bg-background px-3.5 text-sm focus-visible:border-brand-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
        >
          <option value="registered">Registered charity (issues official tax receipts)</option>
          <option value="non_registered">Not a registered charity (issues payment confirmations)</option>
        </select>
        <p className="text-xs text-muted-foreground">
          Only registered charities may issue official CRA donation receipts.
        </p>
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
            placeholder="Rev. Thomas Allen"
            defaultValue={props.authorizedSignatory ?? ""}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="receiptLocality">Place issued (locality)</Label>
          <Input
            id="receiptLocality"
            name="receiptLocality"
            placeholder="Toronto, ON"
            defaultValue={props.receiptLocality ?? ""}
          />
        </div>
      </div>

      <div className="rounded-xl border border-border p-4">
        <p className="text-sm font-medium">Organization address</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Printed on official receipts, and your province determines whether KindPath bills you GST
          or HST. Without it we have to assume 5% GST.
        </p>
        <div className="mt-3 flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="addressLine1">Street address</Label>
            <Input
              id="addressLine1"
              name="addressLine1"
              placeholder="123 Faith Street"
              autoComplete="address-line1"
              defaultValue={props.addressLine1 ?? ""}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                name="city"
                autoComplete="address-level2"
                defaultValue={props.city ?? ""}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="province">Province</Label>
              <select
                id="province"
                name="province"
                defaultValue={props.province ?? ""}
                className={selectCls}
              >
                <option value="">Select…</option>
                {PROVINCES.map((p) => (
                  <option key={p.code} value={p.code}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="postalCode">Postal code</Label>
              <Input
                id="postalCode"
                name="postalCode"
                placeholder="M5V 2T6"
                autoComplete="postal-code"
                defaultValue={props.postalCode ?? ""}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border p-4">
        <p className="text-sm font-medium">Brand color</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Retints your donation page, campaigns and receipts.
        </p>
        <div className="mt-3 flex max-w-xs flex-col gap-2">
          <Label htmlFor="primaryColor">Brand color (hex)</Label>
          <div className="flex items-center gap-2">
            <Input
              id="primaryColor"
              name="primaryColor"
              placeholder="#4f46e5"
              defaultValue={props.primaryColor ?? ""}
            />
            <span
              aria-hidden
              className="size-9 shrink-0 rounded-lg border border-border"
              style={{ background: props.primaryColor ?? "#4f46e5" }}
            />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border p-4">
        <p className="text-sm font-medium">Receipting policy</p>
        <p className="mt-1 text-xs text-muted-foreground">
          How and when this organization issues receipts. A gift is only ever receipted once —
          annual roll-ups exclude gifts that already have a per-gift receipt.
        </p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="receiptMode">Receipt mode</Label>
            <select
              id="receiptMode"
              name="receiptMode"
              defaultValue={props.receiptMode}
              className={selectCls}
            >
              <option value="per_gift">Per gift — a receipt with every donation</option>
              <option value="annual">Annual — one consolidated receipt per year</option>
              <option value="both">Both — per gift, plus an annual summary</option>
            </select>
            <p className="text-xs text-muted-foreground">
              Annual roll-ups on the Receipts page require &lsquo;annual&rsquo; or &lsquo;both&rsquo;.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="minReceiptAmount">Minimum receipt amount (CAD)</Label>
            <Input
              id="minReceiptAmount"
              name="minReceiptAmount"
              type="number"
              min={0}
              step="0.01"
              defaultValue={String(props.minReceiptAmount ?? 0)}
            />
            <p className="text-xs text-muted-foreground">
              Annual receipts are skipped below this total. 0 issues for any amount.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border p-4">
        <p className="text-sm font-medium">Receipt customization</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Appears on the tax receipts / confirmations donors download (alongside your logo &amp; color).
        </p>
        <div className="mt-3 flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="receiptMessage">Thank-you message</Label>
            <Input
              id="receiptMessage"
              name="receiptMessage"
              placeholder="Thank you for supporting our community."
              defaultValue={props.receiptMessage ?? ""}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="receiptFooter">Footer note</Label>
            <Input
              id="receiptFooter"
              name="receiptFooter"
              placeholder="Questions? Contact office@yourorg.org"
              defaultValue={props.receiptFooter ?? ""}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="receiptPrefix">Receipt number prefix</Label>
            <Input
              id="receiptPrefix"
              name="receiptPrefix"
              placeholder="STM-"
              defaultValue={props.receiptPrefix ?? ""}
            />
            <p className="text-xs text-muted-foreground">
              Optional. Receipts will be numbered like{" "}
              <span className="font-mono">{(props.receiptPrefix ?? "STM-") + "2026-000123"}</span>.
            </p>
          </div>
        </div>
      </div>

      <div>
        <SubmitButton>Save settings</SubmitButton>
      </div>
    </form>
  );
}
