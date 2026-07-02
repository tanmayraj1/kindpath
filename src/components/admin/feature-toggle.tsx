"use client";

import { useTransition } from "react";
import { RotateCcw, Loader2 } from "lucide-react";
import { setFeatureOverride } from "@/app/admin/actions";
import { cn } from "@/lib/utils";

export function FeatureToggle({
  orgId,
  featureKey,
  label,
  description,
  enabled,
  source,
}: {
  orgId: string;
  featureKey: string;
  label: string;
  description: string;
  enabled: boolean;
  source: "plan" | "granted" | "revoked" | "off";
}) {
  const [pending, start] = useTransition();

  const badge =
    source === "granted"
      ? { text: "Granted", cls: "bg-success/10 text-success" }
      : source === "revoked"
        ? { text: "Revoked", cls: "bg-destructive/10 text-destructive" }
        : source === "plan"
          ? { text: "Included in plan", cls: "bg-brand-50 text-brand-700" }
          : { text: "Not in plan", cls: "bg-secondary text-muted-foreground" };

  const overridden = source === "granted" || source === "revoked";

  return (
    <div className="flex items-center justify-between gap-4 py-4">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium">{label}</p>
          <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", badge.cls)}>
            {badge.text}
          </span>
        </div>
        <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {overridden && (
          <button
            type="button"
            title="Reset to plan default"
            disabled={pending}
            onClick={() => start(() => setFeatureOverride(orgId, featureKey, "reset"))}
            className="grid size-9 place-items-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <RotateCcw className="size-4" />
          </button>
        )}
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          disabled={pending}
          onClick={() =>
            start(() => setFeatureOverride(orgId, featureKey, enabled ? "revoke" : "grant"))
          }
          className={cn(
            "relative h-7 w-12 rounded-full transition-colors disabled:opacity-60",
            enabled ? "bg-success" : "bg-muted"
          )}
        >
          {pending ? (
            <Loader2 className="absolute left-3.5 top-1.5 size-4 animate-spin text-white" />
          ) : (
            <span
              className={cn(
                "absolute top-1 size-5 rounded-full bg-white shadow-sm transition-transform",
                enabled ? "translate-x-6" : "translate-x-1"
              )}
            />
          )}
        </button>
      </div>
    </div>
  );
}
