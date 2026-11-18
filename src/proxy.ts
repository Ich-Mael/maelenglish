import { NextResponse, type NextRequest } from "next/server";
import { baseCookie, SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/auth/cookies";

/**
 * Optimistic checks only (no database): private areas redirect to the login
 * page when there is no session cookie, and the cookie's lifetime slides with
 * activity. The real check is `getCurrentUser()` in the Data Access Layer.
 */
const PRIVATE = ["/compte", "/admin", "/mes-cours", "/apprendre"];

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE)?.value;

  if (!token && PRIVATE.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    const url = new URL("/connexion", request.url);
    url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }

  const res = NextResponse.next();
  if (token && request.method === "GET") {
    res.cookies.set(SESSION_COOKIE, token, { ...baseCookie, maxAge: SESSION_MAX_AGE });
  }
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|images/|icon.png|favicon.ico|robots.txt|sitemap.xml).*)"],
};
