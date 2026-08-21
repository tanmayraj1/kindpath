import { cn } from "@/lib/utils";

/**
 * Single-stroke line-art for the donor surfaces.
 *
 * FAITH-NEUTRAL BY RULE. KindPath serves temples, churches and mosques on the
 * same footing, so nothing here may read as belonging to one tradition: no
 * crosses, crescents, om, stars, domes, spires or folded praying hands. The
 * motifs are deliberately universal — open hands, a growing sapling, a winding
 * path, sunrise, a community circle. If a future illustration cannot pass that
 * test, it does not go on a donor page.
 *
 * Drawn rather than downloaded: inline SVG on brand tokens, so each one inherits
 * the surface palette, costs no request, and needs no licence. Every piece is one
 * continuous stroke over a soft organic blob, which is what gives the set its
 * family resemblance.
 *
 * All are decorative and marked aria-hidden. Where one carries meaning the page
 * states it in text — an illustration is never the only place something is said.
 */

type Props = { className?: string };

/** Soft blob behind each motif. Two overlapping organic shapes, sage + peach. */
function Blob() {
  return (
    <g aria-hidden>
      <path
        d="M18 98c-14-26-4-58 24-72 30-15 68-6 82 18 13 23 5 52-18 67-26 17-70 12-88-13z"
        fill="hsl(var(--brand-300))"
        opacity="0.35"
      />
      <path
        d="M96 44c16-6 34 2 40 16 6 15-3 32-18 38-14 5-30-2-36-15-6-14 0-33 14-39z"
        fill="hsl(var(--accent))"
        opacity="0.45"
      />
    </g>
  );
}

const stroke = {
  fill: "none",
  stroke: "hsl(var(--brand-800))",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function Frame({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 180 150"
      className={cn("h-auto w-full", className)}
      role="presentation"
    >
      <Blob />
      {children}
    </svg>
  );
}

/**
 * Cupped hands with a shoot rising between them — giving that grows.
 *
 * Built from arcs rather than a traced outline: a hand drawn as one clever
 * continuous path looks like a paw at 160px, which is the only size this is ever
 * shown at. Two mirrored cups read unmistakably as hands even small.
 */
export function OpenHands({ className }: Props) {
  return (
    <Frame className={className}>
      {/* left cup: palm arc + three finger arcs */}
      <path {...stroke} d="M86 118c-14 0-26-6-32-18-4-9-3-19 2-25" />
      <path {...stroke} d="M56 75c5-4 11-2 14 4M62 68c5-5 12-4 16 2M70 63c5-4 11-3 15 3" />
      {/* right cup, mirrored */}
      <path {...stroke} d="M94 118c14 0 26-6 32-18 4-9 3-19-2-25" />
      <path {...stroke} d="M124 75c-5-4-11-2-14 4M118 68c-5-5-12-4-16 2M110 63c-5-4-11-3-15 3" />
      {/* the two palms meeting */}
      <path {...stroke} d="M86 118h8" />
      {/* shoot rising from the cup */}
      <path {...stroke} d="M90 100V64" />
      <path {...stroke} d="M90 82c-10 0-17-6-18-16 10-2 18 5 18 16z" />
      <path {...stroke} d="M90 72c9 0 15-6 16-14-9-2-16 4-16 14z" />
    </Frame>
  );
}

/** A sapling: one stroke from root to leaf. Growth, not harvest. */
export function Sapling({ className }: Props) {
  return (
    <Frame className={className}>
      <path {...stroke} d="M90 126V58" />
      <path {...stroke} d="M90 92c-18 0-30-11-32-28 18-3 32 8 32 28z" />
      <path {...stroke} d="M90 78c16 0 27-10 29-25-16-3-29 7-29 25z" />
      <path {...stroke} d="M90 64c9 0 16-6 17-15-9-2-17 4-17 15z" />
      <path {...stroke} d="M70 126h40" />
    </Frame>
  );
}

/** A winding path toward the horizon — the product's name, and its arc. */
export function WindingPath({ className }: Props) {
  return (
    <Frame className={className}>
      <path {...stroke} d="M60 128c14-10 34-8 44-20s2-26 12-34 26-4 34-12" />
      <path
        {...stroke}
        strokeDasharray="2 7"
        d="M74 128c14-12 32-10 42-22s0-26 10-34 24-4 32-12"
      />
      <circle {...stroke} cx="150" cy="62" r="4" />
    </Frame>
  );
}

/** Sunrise over a horizon — light rays, no symbol. */
export function Sunrise({ className }: Props) {
  return (
    <Frame className={className}>
      <path {...stroke} d="M46 108h88" />
      <path {...stroke} d="M62 108a28 28 0 0 1 56 0" />
      <path
        {...stroke}
        d="M90 56V44M118 70l8-8M62 70l-8-8M134 96h12M34 96h12"
      />
    </Frame>
  );
}

/** A community circle — five figures, one continuous ring. Nobody at the centre. */
export function CommunityCircle({ className }: Props) {
  const people = [0, 72, 144, 216, 288];
  return (
    <Frame className={className}>
      <circle {...stroke} cx="90" cy="86" r="34" strokeDasharray="3 8" />
      {people.map((deg) => {
        const rad = ((deg - 90) * Math.PI) / 180;
        const cx = 90 + Math.cos(rad) * 34;
        const cy = 86 + Math.sin(rad) * 34;
        return (
          <g key={deg}>
            <circle {...stroke} cx={cx} cy={cy} r="6" />
            <path {...stroke} d={`M${cx - 8} ${cy + 16}a8 9 0 0 1 16 0`} />
          </g>
        );
      })}
    </Frame>
  );
}
