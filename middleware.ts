import { NextResponse, type NextRequest } from "next/server";
import { SESSION_HINT_COOKIE_NAME } from "@/lib/auth/session";
import { getRequestSession } from "@/lib/auth/server";

export async function middleware(request: NextRequest) {
  const session = await getRequestSession(request);
  const pathname = request.nextUrl.pathname;
  const isHomeRoute = pathname === "/";
  const isProtectedRoute = pathname.startsWith("/tools");
  const isAuthRoute = pathname === "/login" || pathname === "/register";
  const hasSessionHint = request.cookies.get(SESSION_HINT_COOKIE_NAME)?.value === "1";

  if (isHomeRoute && session) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/tools";
    redirectUrl.search = "";
    return NextResponse.redirect(redirectUrl);
  }

  if (isHomeRoute && !session && hasSessionHint) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/auth/restore";
    redirectUrl.search = "";
    redirectUrl.searchParams.set("to", "/tools");
    return NextResponse.redirect(redirectUrl);
  }

  if (isProtectedRoute && !session) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  if (isAuthRoute && session) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/tools";
    redirectUrl.search = "";
    return NextResponse.redirect(redirectUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/tools/:path*", "/login", "/register"],
};
