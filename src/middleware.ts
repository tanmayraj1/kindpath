import { NextResponse, type NextRequest } from "next/server";
import { verifySession } from "@/lib/auth/jwt";

const COOKIE = process.env.AUTH_COOKIE ?? "kindpath_session";

// path prefix -> required principal kind
const guarded: { prefix: string; kind: "platform" | "org" | "donor" | "volunteer" }[] = [
  { prefix: "/admin", kind: "platform" },
  { prefix: "/dashboard", kind: "org" },
  { prefix: "/portal", kind: "donor" },
  { prefix: "/volunteer", kind: "volunteer" },
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const rule = guarded.find((g) => pathname.startsWith(g.prefix));
  if (!rule) return NextResponse.next();

  const token = req.cookies.get(COOKIE)?.value;
  const session = token ? await verifySession(token) : null;

  if (!session) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (session.kind !== rule.kind) {
    // logged in but wrong portal — send to their own
    const home =
      session.kind === "platform"
        ? "/admin"
        : session.kind === "org"
          ? "/dashboard"
          : session.kind === "volunteer"
            ? "/volunteer"
            : "/portal";
    const url = req.nextUrl.clone();
    url.pathname = home;
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/dashboard/:path*", "/portal/:path*", "/volunteer/:path*"],
};
