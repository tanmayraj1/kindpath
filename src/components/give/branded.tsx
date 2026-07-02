import type { CSSProperties } from "react";
import { hexToHslTriplet } from "@/lib/utils";

/**
 * Wraps public donation content and, when the org has a brand color, overrides
 * the design-token CSS variables so buttons/accents adopt the org's color
 * (white-label). Falls back to the default KindPath palette when unset/invalid.
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
    <div style={style} className={className}>
      {children}
    </div>
  );
}
