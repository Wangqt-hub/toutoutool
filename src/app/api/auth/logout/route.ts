import { NextResponse } from "next/server";
import { SESSION_HINT_COOKIE_NAME } from "@/lib/auth/session";
import {
  getSessionCookieConfig,
  getSessionCookieName,
} from "@/lib/auth/server";

export async function POST() {
  const response = NextResponse.json({
    success: true,
  });
  const sessionCookieConfig = getSessionCookieConfig();

  response.cookies.set(getSessionCookieName(), "", {
    ...sessionCookieConfig,
    maxAge: 0,
  });

  response.cookies.set(SESSION_HINT_COOKIE_NAME, "", {
    ...sessionCookieConfig,
    httpOnly: false,
    maxAge: 0,
  });

  return response;
}
