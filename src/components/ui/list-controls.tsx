import Link from "next/link";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { pageHref, type Paged } from "@/lib/pagination";
import { cn } from "@/lib/utils";

/**
 * Search box for a list page. A plain GET form, so it works without JavaScript,
 * keeps the query in the URL (shareable, bookmarkable, survives a refresh), and
 * needs no client component.
 */
export function ListSearch({
  action,
  q,
  placeholder = "Search…",
  label = "Search",
}: {
  action: string;
  q: string;
  placeholder?: string;
  label?: string;
}) {
  return (
    <form action={action} method="get" role="search" className="flex w-full max-w-sm gap-2">
      <div className="relative flex-1">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <label htmlFor="list-search" className="sr-only">
          {label}
        </label>
        <input
          id="list-search"
          type="search"
          name="q"
          defaultValue={q}
          placeholder={placeholder}
          className="h-10 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm shadow-xs focus-visible:border-brand-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
        />
      </div>
      <button type="submit" className={buttonVariants({ variant: "outline", size: "sm" })}>
        Search
      </button>
    </form>
  );
}

/**
 * Filter dropdowns for a list page.
 *
 * A plain GET form that submits on change, matching ListSearch: the selection
 * lands in the URL, so it survives a refresh, is shareable, and is readable by
 * the server component without any client state.
 */
export function ListFilters({
  action,
  filters,
  hidden,
}: {
  action: string;
  filters: { name: string; label: string; value: string; options: { value: string; label: string }[] }[];
  /** Other active params (e.g. the search term) to carry through the submit. */
  hidden?: Record<string, string | undefined>;
}) {
  return (
    <form action={action} method="get" className="flex flex-wrap items-end gap-3">
      {Object.entries(hidden ?? {}).map(([k, v]) =>
        v ? <input key={k} type="hidden" name={k} value={v} /> : null
      )}
      {filters.map((f) => (
        <div key={f.name} className="flex flex-col gap-1.5">
          <label htmlFor={`filter-${f.name}`} className="text-xs font-medium text-muted-foreground">
            {f.label}
          </label>
          <select
            id={`filter-${f.name}`}
            name={f.name}
            defaultValue={f.value}
            className="h-10 rounded-lg border border-input bg-background px-3 text-sm shadow-xs focus-visible:border-brand-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
          >
            {f.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      ))}
      <button type="submit" className={buttonVariants({ variant: "outline", size: "sm" })}>
        Apply
      </button>
    </form>
  );
}

/** Previous/next pager with a plain-language position summary. */
export function Pagination<T>({
  basePath,
  data,
  noun = "results",
  extra,
}: {
  basePath: string;
  data: Paged<T>;
  noun?: string;
  /** Page-specific filters to preserve across paging (year, status, …). */
  extra?: Record<string, string | undefined>;
}) {
  if (data.total === 0) return null;

  const from = (data.page - 1) * data.size + 1;
  const to = Math.min(data.page * data.size, data.total);
  const linkCls = buttonVariants({ variant: "outline", size: "sm" });
  const disabledCls = "pointer-events-none opacity-50";

  return (
    <nav
      aria-label="Pagination"
      className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4"
    >
      <p className="text-sm text-muted-foreground" aria-live="polite">
        Showing <strong className="text-foreground">{from}</strong>–
        <strong className="text-foreground">{to}</strong> of{" "}
        <strong className="text-foreground">{data.total}</strong> {noun}
        {data.q && (
          <>
            {" "}
            matching <strong className="text-foreground">“{data.q}”</strong>
          </>
        )}
      </p>
      <div className="flex items-center gap-2">
        <Link
          href={pageHref(basePath, data, { page: data.page - 1 }, extra)}
          aria-disabled={data.page <= 1}
          tabIndex={data.page <= 1 ? -1 : undefined}
          className={cn(linkCls, data.page <= 1 && disabledCls)}
        >
          <ChevronLeft className="size-4" aria-hidden /> Previous
        </Link>
        <span className="text-sm text-muted-foreground">
          Page {data.page} of {data.pageCount}
        </span>
        <Link
          href={pageHref(basePath, data, { page: data.page + 1 }, extra)}
          aria-disabled={data.page >= data.pageCount}
          tabIndex={data.page >= data.pageCount ? -1 : undefined}
          className={cn(linkCls, data.page >= data.pageCount && disabledCls)}
        >
          Next <ChevronRight className="size-4" aria-hidden />
        </Link>
      </div>
    </nav>
  );
}
