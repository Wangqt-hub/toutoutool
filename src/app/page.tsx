import type { Route } from "next";
import { cookies } from "next/headers";
import { LandingSessionRestore } from "@/components/auth/landing-session-restore";
import { SESSION_COOKIE_NAME, SESSION_HINT_COOKIE_NAME } from "@/lib/auth/session";
import { getServerSession } from "@/lib/auth/server";
import { LandingUI } from "@/components/landing-ui";

export default async function LandingPage() {
  const cookieStore = cookies();
  const hasSessionCookie = Boolean(cookieStore.get(SESSION_COOKIE_NAME)?.value);
  const session = hasSessionCookie ? await getServerSession() : null;
  const hasSessionHint =
    cookieStore.get(SESSION_HINT_COOKIE_NAME)?.value === "1";
  const redirectTarget: Route | undefined = session
    ? "/tools"
    : hasSessionHint
      ? "/auth/restore?to=%2Ftools"
      : undefined;

  return (
    <>
      <LandingSessionRestore redirectTo={redirectTarget} />
      <LandingUI />
    </>
  );
}
