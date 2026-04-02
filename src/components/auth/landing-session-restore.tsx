"use client";

import { useLayoutEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getCloudBaseAuth } from "@/lib/cloudbase/client";

function hasSessionHintCookie() {
  if (typeof document === "undefined") {
    return false;
  }

  return document.cookie.split("; ").some((item) => item === "tt_auth_hint=1");
}

export function LandingSessionRestore() {
  const router = useRouter();
  const [restoring, setRestoring] = useState(false);

  useLayoutEffect(() => {
    try {
      if (!hasSessionHintCookie()) {
        return;
      }

      const auth = getCloudBaseAuth();

      if (!auth.hasLoginState()) {
        return;
      }

      setRestoring(true);
      router.replace("/auth/restore?to=%2Ftools");
    } catch {
      setRestoring(false);
    }
  }, [router]);

  if (!restoring) {
    return null;
  }

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-50 bg-cream-50"
    >
      <span className="sr-only">正在恢复会话</span>
    </div>
  );
}
