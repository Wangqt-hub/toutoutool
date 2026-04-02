"use client";

import { useLayoutEffect } from "react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { getCloudBaseAuth } from "@/lib/cloudbase/client";
import { normalizePhoneNumber } from "@/lib/auth/phone";

function getSafeRedirect(to: string | null | undefined): Route {
  const fallback = "/tools" as Route;

  if (!to || !to.startsWith("/") || to.startsWith("//") || to.includes("://")) {
    return fallback;
  }

  return to as Route;
}

async function createServerSession(options: {
  accessToken: string;
  phoneNumber?: string | null;
}) {
  const response = await fetch("/api/auth/session", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      accessToken: options.accessToken,
      phone: options.phoneNumber,
    }),
  });

  const payload = (await response.json()) as {
    success: boolean;
    error?: string;
  };

  if (!response.ok || !payload.success) {
    throw new Error(payload.error || "Failed to create session.");
  }
}

export function RestoreSessionScreen({ to }: { to?: string | null }) {
  const router = useRouter();
  const target = getSafeRedirect(to);

  useLayoutEffect(() => {
    let cancelled = false;

    async function restoreSession() {
      try {
        const auth = getCloudBaseAuth();
        const loginState = await auth.getLoginState();

        if (!loginState?.user) {
          throw new Error("No CloudBase login state.");
        }

        const accessInfo = await auth.getAccessToken();

        if (!accessInfo?.accessToken) {
          throw new Error("CloudBase did not return an access token.");
        }

        const user = loginState.user as {
          phone_number?: string;
          phone?: string;
        };
        const currentUser = auth.currentUser as {
          phone_number?: string;
          phone?: string;
        } | null;

        const phoneNumber =
          normalizePhoneNumber(user.phone_number || "") ||
          normalizePhoneNumber(user.phone || "") ||
          normalizePhoneNumber(currentUser?.phone_number || "") ||
          normalizePhoneNumber(currentUser?.phone || "") ||
          null;

        await createServerSession({
          accessToken: accessInfo.accessToken,
          phoneNumber,
        });

        if (!cancelled) {
          router.replace(target);
          router.refresh();
        }
      } catch {
        if (!cancelled) {
          const loginTarget = `/login?from=${encodeURIComponent(target)}`;
          router.replace(loginTarget as Route);
        }
      }
    }

    void restoreSession();

    return () => {
      cancelled = true;
    };
  }, [router, target]);

  return (
    <main aria-busy="true" className="min-h-screen bg-cream-50">
      <span className="sr-only">正在恢复登录状态</span>
    </main>
  );
}
