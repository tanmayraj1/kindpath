import { NextResponse, type NextRequest } from "next/server";
import { verifySession } from "@/lib/auth/jwt";
import { PORTAL_HOME, type PrincipalKind } from "@/lib/auth/portals";

const COOKIE = process.env.AUTH_COOKIE ?? "kindpath_session";

// Derived from the single source of truth so a new portal can't be added to one
// and forgotten in the other.
const guarded: { prefix: string; kind: PrincipalKind }[] = (
  Object.entries(PORTAL_HOME) as [PrincipalKind, string][]
).map(([kind, prefix]) => ({ prefix, kind }));

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const rule = guarded.find((g) => pathname.startsWith(g.prefix));
  if (!rule) return NextResponse.next();

  const token = req.cookies.get(COOKIE)?.value;
  const session = token ? await verifySession(token) : null;

  if (!session) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    // Include the query string: without it a filtered list or a paged view comes
    // back as its bare path after sign-in.
    url.searchParams.set("next", pathname + req.nextUrl.search);
    return NextResponse.redirect(url);
  }

  if (session.kind !== rule.kind) {
    // logged in but wrong portal — send to their own
    const url = req.nextUrl.clone();
    url.pathname = PORTAL_HOME[session.kind];
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/dashboard/:path*", "/portal/:path*", "/volunteer/:path*"],
};
