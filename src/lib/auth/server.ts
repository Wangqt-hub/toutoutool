import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import {
  SESSION_COOKIE_NAME,
  createSessionToken,
  getSessionCookieOptions,
  type AppSession,
  verifySessionToken,
} from "@/lib/auth/session";

export async function getServerSession(): Promise<AppSession | null> {
  const token = cookies().get(SESSION_COOKIE_NAME)?.value;
  return verifySessionToken(token);
}

export async function getRequestSession(
  request: NextRequest
): Promise<AppSession | null> {
  return verifySessionToken(request.cookies.get(SESSION_COOKIE_NAME)?.value);
}

export async function createSessionCookieValue(session: AppSession) {
  return createSessionToken(session);
}

export function getSessionCookieName() {
  return SESSION_COOKIE_NAME;
}

export function getSessionCookieConfig() {
  return getSessionCookieOptions();
}
