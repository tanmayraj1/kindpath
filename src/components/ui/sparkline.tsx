import { cn } from "@/lib/utils";

/**
 * Tiny trend line for a stat card.
 *
 * Deliberately axis-free and unlabelled — it answers "which way is this going"
 * at a glance and nothing more, which is the only question a graphic this small
 * can support. Anything that needs a readable value belongs on the reports page
 * with a real axis.
 *
 * A server component drawing itself with CSS, not framer-motion. This renders on
 * the dashboard, and app data must never depend on requestAnimationFrame having
 * run in order to become visible: rAF is paused outright in a background tab, so
 * an rAF-driven `pathLength: 0 → 1` leaves a permanently invisible chart for
 * anyone who opens the dashboard in a tab they haven't switched to yet. The CSS
 * equivalent is `pathLength="1"` plus a dashoffset animation, which also means
 * this ships no JavaScript at all.
 *
 * A flat series — a new organization, or a genuinely quiet quarter — would
 * divide by a zero range and collapse every point onto one edge, so it is pinned
 * to the middle instead: a straight line through the centre, which is the honest
 * picture of "no change".
 */
export function Sparkline({
  data,
  className,
  height = 32,
  strokeWidth = 2,
}: {
  data: number[];
  className?: string;
  height?: number;
  strokeWidth?: number;
}) {
  if (data.length < 2) return null;

  const W = 100;
  const H = height;
  const pad = strokeWidth;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min;

  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * W;
    const y = range === 0 ? H / 2 : pad + (1 - (v - min) / range) * (H - pad * 2);
    return [x, y] as const;
  });

  const line = points
    .map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`)
    .join(" ");
  const area = `${line} L ${W} ${H} L 0 ${H} Z`;
  const last = points[points.length - 1];

  // Stable per-instance id so two sparklines on one page don't share a gradient.
  const uid = `spark-${data.length}-${Math.round(min)}-${Math.round(max)}`;

  return (
    <svg
      aria-hidden
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className={cn("w-full", className)}
      style={{ height }}
    >
      <defs>
        <linearGradient id={`${uid}-f`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="hsl(var(--brand-500))" stopOpacity="0.22" />
          <stop offset="100%" stopColor="hsl(var(--brand-500))" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${uid}-f)`} className="motion-safe:animate-fade-in-up" />
      <path
        d={line}
        fill="none"
        stroke="hsl(var(--brand-600))"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        // Normalises the path's length to 1 so one dasharray draws any geometry.
        pathLength={1}
        strokeDasharray={1}
        // vectorEffect keeps the stroke even: preserveAspectRatio="none" scales
        // x and y differently, which would otherwise squash the line horizontally.
        vectorEffect="non-scaling-stroke"
        className="motion-safe:animate-draw"
      />
      <circle
        cx={last[0]}
        cy={last[1]}
        r={strokeWidth}
        fill="hsl(var(--brand-600))"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
