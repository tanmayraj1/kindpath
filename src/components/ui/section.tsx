import * as React from "react";
import { cn } from "@/lib/utils";

/** Vertical rhythm wrapper — uniform section padding across the site. */
export function Section({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLElement>) {
  return (
    <section className={cn("py-20 sm:py-28", className)} {...props}>
      {children}
    </section>
  );
}

/** Centered heading block for sections. */
export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "center",
  className,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  align?: "center" | "left";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4",
        align === "center" ? "mx-auto max-w-2xl text-center items-center" : "max-w-2xl",
        className
      )}
    >
      {eyebrow && (
        <span className="text-sm font-semibold uppercase tracking-wider text-brand-600">
          {eyebrow}
        </span>
      )}
      <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
        {title}
      </h2>
      {description && (
        <p className="text-lg leading-relaxed text-muted-foreground">{description}</p>
      )}
    </div>
  );
}
