/**
 * src/middleware.ts
 *
 * UX-only redirect middleware.
 *
 * SECURITY NOTE: This middleware is a UX convenience gate, NOT a security boundary.
 * It can be bypassed via the CVE-2025-29927 x-middleware-subrequest header forgery.
 * DO NOT rely on this middleware for authorization enforcement.
 *
 * The real security boundary is `requireRole()` in every Server Action and Server
 * Component that accesses protected data. This middleware only improves UX by
 * redirecting unauthenticated browser navigations to /login.
 *
 * Reference: https://nextjs.org/blog/security-nextjs-server-components-actions
 */
import { NextRequest, NextResponse } from "next/server";

/**
 * Protected app route prefixes — all paths under these prefixes require a session.
 * Unauthenticated requests will be redirected to /login.
 */
const APP_ROUTE_PREFIXES = [
  "/dashboard",
  "/books",
  "/members",
  "/catalog",
  "/my-loans",
  "/my-profile",
  "/my-reservations",
];

/**
 * Public paths that should always be accessible without a session.
 */
const PUBLIC_PATHS = ["/login", "/api/auth"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow all API routes and static assets through without checking
  if (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next();
  }

  // Allow public paths through
  for (const publicPath of PUBLIC_PATHS) {
    if (pathname === publicPath || pathname.startsWith(publicPath + "/")) {
      return NextResponse.next();
    }
  }

  // Check if path is an app route that requires authentication
  const isAppRoute = APP_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + "/")
  );

  if (!isAppRoute) {
    return NextResponse.next();
  }

  // Look for the Better Auth session cookie
  // Better Auth uses "better-auth.session_token" as the default cookie name
  const sessionCookie =
    request.cookies.get("better-auth.session_token") ??
    request.cookies.get("__Secure-better-auth.session_token");

  if (!sessionCookie) {
    // UX-only redirect — real auth is enforced server-side in requireRole()
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
