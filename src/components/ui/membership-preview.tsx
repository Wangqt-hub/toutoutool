"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type SubscriptionTier = "free" | "premium";

export function MembershipPreviewButton() {
  const [open, setOpen] = useState(false);
  const [tier, setTier] = useState<SubscriptionTier>("free");
  const [profileLoaded, setProfileLoaded] = useState(false);

  useEffect(() => {
    if (!open || profileLoaded) {
      return;
    }

    let cancelled = false;

    async function loadProfile() {
      try {
        const response = await fetch("/api/profile");

        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as {
          success: boolean;
          data?: {
            subscriptionTier?: SubscriptionTier;
          };
        };

        if (cancelled) {
          return;
        }

        if (payload.success && payload.data?.subscriptionTier === "premium") {
          setTier("premium");
        }
      } catch {
        // Keep the default preview state if the profile API is unavailable.
      } finally {
        if (!cancelled) {
          setProfileLoaded(true);
        }
      }
    }

    void loadProfile();

    return () => {
      cancelled = true;
    };
  }, [open, profileLoaded]);

  return (
    <div className="relative">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="hidden md:inline-flex"
        onClick={() => setOpen((prev) => !prev)}
      >
        {tier === "premium" ? "VIP用户" : "普通用户"}
      </Button>
      {open && (
        <div className="absolute right-0 mt-2 w-64 rounded-3xl border border-cream-100 bg-white/95 shadow-[0_12px_40px_rgba(0,0,0,0.12)] p-3 text-[11px] text-slate-700 z-20">
          <p className="text-[13.5px] text-slate-500">
            {tier === "premium"
              ? "你已经是VIP了"
              : "当前版本你能使用全部核心功能"}
          </p>
        </div>
      )}
    </div>
  );
}
