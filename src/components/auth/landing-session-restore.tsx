"use client";

import { useLayoutEffect, useState } from "react";
import { useRouter } from "next/navigation";

function hasSessionHintCookie() {
  if (typeof document === "undefined") {
    return false;
  }

  return document.cookie.split("; ").some((item) => item === "tt_auth_hint=1");
}

export function LandingSessionRestore() {
  const router = useRouter();
  const [phase, setPhase] = useState<"idle" | "checking" | "restoring">("idle");

  useLayoutEffect(() => {
    let cancelled = false;

    try {
      if (!hasSessionHintCookie()) {
        return;
      }

      setPhase("checking");

      void (async () => {
        try {
          const { getCloudBaseAuth } = await import("@/lib/cloudbase/client");

          if (cancelled) {
            return;
          }

          const auth = getCloudBaseAuth();

          if (!auth.hasLoginState()) {
            setPhase("idle");
            return;
          }

          setPhase("restoring");
          router.replace("/auth/restore?to=%2Ftools");
        } catch {
          if (!cancelled) {
            setPhase("idle");
          }
        }
      })();
    } catch {
      setPhase("idle");
    }

    return () => {
      cancelled = true;
    };
  }, [router]);

  if (phase === "idle") {
    return null;
  }

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none fixed inset-0 z-50 bg-cream-50 transition-opacity duration-300 ${
        phase === "checking" ? "opacity-0" : "opacity-100"
      }`}
    >
      <span className="sr-only">正在恢复会话</span>
    </div>
  );
}
