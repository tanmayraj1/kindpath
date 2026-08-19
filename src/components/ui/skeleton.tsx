import { cn } from "@/lib/utils";

/**
 * Loading placeholders. Shown via route-level loading.tsx so a navigation is
 * never silent dead air on a slow connection — the layout appears immediately
 * and only the data-dependent regions shimmer.
 *
 * Marked aria-hidden with a single polite live region at the page level: a
 * screen reader should hear "loading", not read out a dozen empty boxes.
 */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-md bg-muted", className)} />;
}

/** Standard page skeleton: a topbar strip, stat tiles, then a table block. */
export function PageSkeleton({
  stats = 4,
  rows = 6,
  label = "Loading",
}: {
  stats?: number;
  rows?: number;
  label?: string;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex h-16 items-center justify-between border-b border-border px-4 sm:px-6">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="size-9 rounded-full" />
      </div>
      <div className="flex flex-col gap-6 p-4 sm:p-6" role="status" aria-live="polite">
        <span className="sr-only">{label}…</span>
        {stats > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: stats }).map((_, i) => (
              <div key={i} className="rounded-xl border border-border bg-card p-5">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="mt-3 h-7 w-28" />
                <Skeleton className="mt-2 h-3 w-16" />
              </div>
            ))}
          </div>
        )}
        <div className="rounded-xl border border-border bg-card p-5">
          <Skeleton className="h-4 w-32" />
          <div className="mt-5 flex flex-col gap-3">
            {Array.from({ length: rows }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="hidden h-4 w-32 sm:block" />
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Skeleton for a settings/detail page: a couple of card-shaped panels with
 * field rows, rather than the stat-tiles-and-table shape of a list page.
 *
 * Matching the real layout matters — a skeleton that doesn't resemble what
 * arrives produces a visible jolt on load, which reads as slower than showing
 * nothing at all.
 */
export function FormSkeleton({
  panels = 2,
  fields = 5,
  label = "Loading",
}: {
  panels?: number;
  fields?: number;
  label?: string;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex h-16 items-center justify-between border-b border-border px-4 sm:px-6">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="size-9 rounded-full" />
      </div>
      <div className="flex flex-col gap-6 p-4 sm:p-6" role="status" aria-live="polite">
        <span className="sr-only">{label}…</span>
        {Array.from({ length: panels }).map((_, p) => (
          <div key={p} className="rounded-xl border border-border bg-card p-5">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="mt-2 h-3 w-64" />
            <div className="mt-6 flex flex-col gap-5">
              {Array.from({ length: fields }).map((_, i) => (
                <div key={i} className="flex flex-col gap-2">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-10 w-full rounded-lg" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
