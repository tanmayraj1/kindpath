import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Status pills. Soft fills, no outline — a border on a tinted pill reads as a
 * second, competing shape at this size. Variant names are unchanged so every
 * existing call site keeps working; only the surface treatment moved.
 */
const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        brand: "border-transparent bg-brand-50 text-brand-700",
        neutral: "border-border bg-secondary text-secondary-foreground",
        success: "border-transparent bg-success/12 text-success",
        warning: "border-transparent bg-warning/18 text-warning-foreground",
        destructive: "border-transparent bg-destructive/10 text-destructive",
        outline: "border-border text-muted-foreground",
      },
    },
    defaultVariants: { variant: "brand" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
