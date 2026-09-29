"use client";

import { useEffect, useState } from "react";
import { useFormState } from "react-dom";
import { Check, RotateCcw, TriangleAlert } from "lucide-react";
import { saveBrandColor, type BrandColorState } from "@/app/(dashboard)/dashboard/settings/branding-actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/form-alert";
import { SubmitButton } from "@/components/auth/submit-button";
import { BRAND_HEX } from "@/lib/brand";
import { normalizeBrandColor, whiteTextContrast } from "@/lib/brand-color";
import { cn } from "@/lib/utils";

const initial: BrandColorState = {};

/**
 * Colours that read well with white text on a donate button, chosen for the
 * communities KindPath serves. A starting point, not a restriction — any colour
 * can be picked or typed.
 */
const PRESETS: { hex: string; name: string }[] = [
  { hex: BRAND_HEX, name: "KindPath teal" },
  { hex: "#C2410C", name: "Saffron" },
  { hex: "#8A1C32", name: "Maroon" },
  { hex: "#1E4FA3", name: "Royal blue" },
  { hex: "#5B3A8C", name: "Purple" },
  { hex: "#2E6B3F", name: "Green" },
  { hex: "#8C6412", name: "Gold" },
  { hex: "#334155", name: "Slate" },
];

/**
 * Pick the colour donors see on the giving page, receipts and emails.
 *
 * Replaces a bare hex text box whose preview swatch never changed while typing,
 * which gave a charity admin no way to tell whether anything had happened. It
 * saves on its own, independently of the receipt settings.
 */
export function BrandColorPicker({
  orgName,
  primaryColor,
}: {
  orgName: string;
  primaryColor?: string | null;
}) {
  const [state, action] = useFormState(saveBrandColor, initial);
  const saved = normalizeBrandColor(primaryColor ?? "") ?? "";
  const [value, setValue] = useState(saved);

  // After a save, the server's normalised value is the truth.
  useEffect(() => {
    if (state.ok) setValue(state.color ?? "");
  }, [state.ok, state.color]);

  const normalized = normalizeBrandColor(value);
  const effective = normalized ?? (value.trim() === "" ? BRAND_HEX : null);
  const invalid = value.trim() !== "" && !normalized;
  const lowContrast = effective ? whiteTextContrast(effective) < 3 : false;
  const current = state.ok ? (state.color ?? "") : saved;
  const dirty = (normalized ?? (value.trim() === "" ? "" : value)) !== current;

  return (
    <form action={action} className="rounded-xl border border-border p-4">
      <p className="text-sm font-medium">Brand colour</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Used for buttons and accents on your giving page, and on receipts and emails.
      </p>

      <div className="mt-3 flex flex-col gap-3">
        <FormAlert>{state.error}</FormAlert>
        {state.ok && !dirty && <FormAlert variant="success">Brand colour saved.</FormAlert>}
      </div>

      <div className="mt-3 grid gap-5 sm:grid-cols-[1fr_auto]">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Suggested colours">
            {PRESETS.map((p) => {
              const selected = normalized === p.hex;
              return (
                <button
                  key={p.hex}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={p.name}
                  title={p.name}
                  onClick={() => setValue(p.hex)}
                  className={cn(
                    "grid size-9 place-items-center rounded-full border border-black/10 transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    selected && "ring-2 ring-foreground ring-offset-2"
                  )}
                  style={{ background: p.hex }}
                >
                  {selected && <Check className="size-4 text-white" aria-hidden />}
                </button>
              );
            })}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="primaryColor">Or choose any colour</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                aria-label="Colour picker"
                value={(effective ?? BRAND_HEX).toLowerCase()}
                onChange={(e) => setValue(e.target.value.toUpperCase())}
                className="h-11 w-14 shrink-0 cursor-pointer rounded-lg border border-input bg-background p-1"
              />
              <Input
                id="primaryColor"
                name="primaryColor"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={`${BRAND_HEX} (default)`}
                autoComplete="off"
                spellCheck={false}
                aria-invalid={invalid || undefined}
                className="max-w-[11rem] font-mono uppercase"
              />
            </div>
            {invalid && (
              <p className="text-xs text-destructive">
                Enter a 6-digit colour code like #1F7A6D.
              </p>
            )}
            {lowContrast && (
              <p className="flex items-start gap-1.5 text-xs text-warning-foreground">
                <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                This colour is light — white text on your Donate button may be hard to read. A
                darker shade works better.
              </p>
            )}
          </div>
        </div>

        {/* What a donor will see. Mirrors the giving page's button and accents. */}
        <div
          aria-hidden
          className="flex w-full flex-col gap-3 rounded-xl border border-border bg-secondary/40 p-4 sm:w-56"
        >
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Preview
          </span>
          <div className="h-1 w-10 rounded-full" style={{ background: effective ?? BRAND_HEX }} />
          <p className="text-sm font-semibold leading-snug">Give to {orgName}</p>
          <div className="flex gap-1.5">
            {["$25", "$50", "$100"].map((a, i) => (
              <span
                key={a}
                className="rounded-md border px-2 py-1 text-xs font-medium"
                style={
                  i === 1
                    ? { borderColor: effective ?? BRAND_HEX, color: effective ?? BRAND_HEX }
                    : undefined
                }
              >
                {a}
              </span>
            ))}
          </div>
          <span
            className="rounded-lg px-3 py-2 text-center text-sm font-semibold text-white"
            style={{ background: effective ?? BRAND_HEX }}
          >
            Donate $50
          </span>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <SubmitButton size="sm" disabled={invalid || !dirty}>
          Save colour
        </SubmitButton>
        {value.trim() !== "" && (
          <Button type="button" size="sm" variant="ghost" onClick={() => setValue("")}>
            <RotateCcw className="size-4" /> Use KindPath default
          </Button>
        )}
        {dirty && !invalid && (
          <span className="text-xs text-muted-foreground">Unsaved change</span>
        )}
      </div>
    </form>
  );
}
