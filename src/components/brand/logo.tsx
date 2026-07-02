import { cn } from "@/lib/utils";

/** KindPath wordmark + glyph. The glyph is a stylized path/heart. */
export function Logo({
  className,
  showText = true,
}: {
  className?: string;
  showText?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span className="grid size-9 place-items-center rounded-xl bg-brand-gradient shadow-brand">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          className="size-5 text-white"
          aria-hidden="true"
        >
          <path
            d="M12 21s-6.5-4.35-9-8.5C1.5 9.5 3 5.5 6.7 5.5c2 0 3.3 1.2 4.3 2.6 1-1.4 2.3-2.6 4.3-2.6 3.7 0 5.2 4 3.7 7C18.5 16.65 12 21 12 21Z"
            fill="currentColor"
          />
          <path
            d="M7 12.5l2.5 2.5L17 9"
            stroke="hsl(var(--brand-700))"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      {showText && (
        <span className="font-display text-xl font-bold tracking-tight text-foreground">
          Kind<span className="text-brand-600">Path</span>
        </span>
      )}
    </span>
  );
}
