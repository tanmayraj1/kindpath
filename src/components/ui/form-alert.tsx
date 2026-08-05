import * as React from "react";
import { AlertCircle, CheckCircle2, Info } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Inline form feedback. Uses role="alert" (aria-live=assertive) so a screen
 * reader announces a validation failure the moment it renders — previously these
 * messages were purely visual and invisible to assistive tech.
 *
 * Success/info use role="status" instead: polite, so they don't interrupt.
 */
type Variant = "error" | "success" | "info";

const styles: Record<Variant, string> = {
  error: "border-destructive/20 bg-destructive/5 text-destructive",
  success: "border-success/20 bg-success/5 text-success",
  info: "border-border bg-muted/50 text-muted-foreground",
};

const icons: Record<Variant, React.ElementType> = {
  error: AlertCircle,
  success: CheckCircle2,
  info: Info,
};

export function FormAlert({
  variant = "error",
  children,
  className,
  id,
}: {
  variant?: Variant;
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  if (!children) return null;
  const Icon = icons[variant];
  return (
    <div
      id={id}
      role={variant === "error" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm",
        styles[variant],
        className
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{children}</span>
    </div>
  );
}
