import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The dashboard's signature card. One kit, used by every dashboard — org,
 * charity and platform admin — so the three read as one product rather than
 * three apps that happen to share a login.
 *
 * `hero` paints the card in the surface's hero fill — lime in a dashboard,
 * peach in the donor portal, brand on marketing. It reads a token rather than a
 * literal so the highlight can never carry the wrong surface's accent: lime is
 * the dashboard's colour and has no business on a donor page.
 *
 * EXACTLY ONE card per row should set it: the point
 * of the treatment is that the eye lands on the number that matters most before
 * reading anything, and a second lime card destroys that in the only way that
 * matters. It is a boolean rather than a colour prop for the same reason —
 * there is nothing to choose.
 *
 * The corner arrow is a link, not decoration, and it is only rendered when
 * `href` is given: an affordance that looks clickable and isn't is worse than no
 * affordance. Its accessible name carries the metric, so a screen-reader user
 * hears "Raised this month, view details" rather than five identical "link,
 * arrow up right" in a row.
 */
export function StatCard({
  label,
  value,
  icon: Icon,
  caption,
  href,
  hero,
  badge,
  children,
  className,
  style,
}: {
  label: string;
  value: React.ReactNode;
  icon: LucideIcon;
  caption?: string;
  href?: string;
  hero?: boolean;
  /** Small pill beside the value — a delta, a goal percentage, a count. */
  badge?: { text: string; tone?: "accent" | "success" | "destructive" };
  /** Optional slot under the caption, e.g. a sparkline. */
  children?: React.ReactNode;
  className?: string;
  /** Carries the stagger's animation-delay from the call site. */
  style?: React.CSSProperties;
}) {
  const badgeTone = {
    accent: "bg-accent/40 text-foreground",
    success: "bg-success/12 text-success",
    destructive: "bg-destructive/10 text-destructive",
  }[badge?.tone ?? "accent"];

  return (
    <div
      className={cn(
        "relative flex min-w-0 flex-col gap-3 rounded-card p-5 shadow-soft transition-shadow",
        hero ? "bg-hero text-hero-foreground" : "bg-card text-card-foreground",
        className
      )}
      style={style}
    >
      <div className="flex items-start justify-between gap-3">
        <span
          className={cn(
            "grid size-10 shrink-0 place-items-center rounded-full",
            hero ? "bg-hero-foreground/10 text-hero-foreground" : "bg-brand-50 text-brand-600"
          )}
        >
          <Icon className="size-[18px] stroke-[1.5]" aria-hidden />
        </span>
        {href && (
          <Link
            href={href}
            aria-label={`${label}, view details`}
            className={cn(
              "grid size-9 shrink-0 place-items-center rounded-full border transition-colors",
              hero
                ? "border-hero-foreground/25 text-hero-foreground hover:bg-hero-foreground/10"
                : "border-border text-foreground hover:bg-secondary"
            )}
          >
            <ArrowUpRight className="size-4 stroke-[1.5]" aria-hidden />
          </Link>
        )}
      </div>

      <div className="flex flex-wrap items-baseline gap-2">
        <p className="tnum font-display text-3xl font-bold tracking-tight">{value}</p>
        {badge && (
          <span
            className={cn(
              "tnum rounded-full px-2 py-0.5 text-xs font-semibold",
              hero ? "bg-hero-foreground/10 text-hero-foreground" : badgeTone
            )}
          >
            {badge.text}
          </span>
        )}
      </div>

      <div>
        <p className={cn("text-sm font-medium", hero ? "text-hero-foreground/80" : "text-muted-foreground")}>
          {label}
        </p>
        {caption && (
          <p className={cn("mt-0.5 text-xs", hero ? "text-hero-foreground/60" : "text-muted-foreground")}>
            {caption}
          </p>
        )}
      </div>

      {children && <div className="mt-auto pt-1">{children}</div>}
    </div>
  );
}
