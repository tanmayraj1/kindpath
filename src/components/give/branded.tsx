import type { CSSProperties } from "react";
import { hexToHslTriplet } from "@/lib/utils";
import { cn } from "@/lib/utils";

/**
 * Wraps public donation content and, when the org has a brand color, overrides
 * the design-token CSS variables so buttons/accents adopt the org's color
 * (white-label). Falls back to the default KindPath palette when unset/invalid.
 *
 * Also carries the donor surface scope, which is why the public giving pages need
 * no layout of their own: every route that renders through here (/give, /kiosk,
 * /join, /c, /e) picks up the cream-and-sage palette from one place. The org's
 * own colour is applied as an inline style, so it still wins over the scope —
 * white-labelling is unaffected by the reskin.
 */
export function Branded({
  color,
  children,
  className,
}: {
  color?: string | null;
  children: React.ReactNode;
  className?: string;
}) {
  const triplet = color ? hexToHslTriplet(color) : null;
  const style = triplet
    ? ({
        "--primary": triplet,
        "--ring": triplet,
        "--brand-600": triplet,
        "--brand-700": triplet,
        "--accent": triplet,
      } as CSSProperties)
    : undefined;

  return (
    <div style={style} className={cn("surface-donor", className)}>
      {children}
    </div>
  );
}
