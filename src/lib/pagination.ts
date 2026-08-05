/**
 * Shared pagination + search parsing for list pages.
 *
 * Every list in the app previously loaded its entire table — `listDonors` pulled
 * every donor AND every one of their donations and summed in JavaScript, which
 * stops working somewhere around a few thousand donors and takes the page down
 * with it. These helpers keep the query bounded and the URL shareable.
 */

export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;

export type PageParams = { page: number; size: number; q: string; skip: number };

export function parsePageParams(
  searchParams: { page?: string; q?: string; size?: string } | undefined,
  defaultSize = DEFAULT_PAGE_SIZE
): PageParams {
  const rawPage = Number(searchParams?.page ?? 1);
  const page = Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1;

  const rawSize = Number(searchParams?.size ?? defaultSize);
  const size =
    Number.isFinite(rawSize) && rawSize >= 1 ? Math.min(Math.floor(rawSize), MAX_PAGE_SIZE) : defaultSize;

  // Trim and cap the search term: it goes into a `contains` filter, and an
  // unbounded string is a cheap way to make Postgres work hard for nothing.
  const q = (searchParams?.q ?? "").trim().slice(0, 100);

  return { page, size, q, skip: (page - 1) * size };
}

export type Paged<T> = {
  rows: T[];
  total: number;
  page: number;
  size: number;
  pageCount: number;
  q: string;
};

export function paged<T>(rows: T[], total: number, p: PageParams): Paged<T> {
  return {
    rows,
    total,
    page: p.page,
    size: p.size,
    pageCount: Math.max(1, Math.ceil(total / p.size)),
    q: p.q,
  };
}

/** Build a URL preserving existing query params while changing some of them. */
export function pageHref(
  basePath: string,
  current: { q?: string; size?: number },
  next: { page?: number; q?: string }
): string {
  const params = new URLSearchParams();
  const q = next.q !== undefined ? next.q : current.q;
  if (q) params.set("q", q);
  if (next.page && next.page > 1) params.set("page", String(next.page));
  if (current.size && current.size !== DEFAULT_PAGE_SIZE) params.set("size", String(current.size));
  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}
