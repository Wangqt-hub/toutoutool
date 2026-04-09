"use client";

import { useEffect, useState } from "react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { EmojiLoadingStage } from "@/components/mascot/EmojiLoadingStage";
import { getCloudBaseAuth } from "@/lib/cloudbase/client";
import { normalizePhoneNumber } from "@/lib/auth/phone";
import type { LoadingStorySlide } from "@/lib/loading-story-presets";

type RestorePhase = "checking" | "syncing" | "redirecting";

type RestoreFlowSubscriber = (phase: RestorePhase) => void;

const restoreSubscribers = new Set<RestoreFlowSubscriber>();
let restoreFlowPromise: Promise<Route> | null = null;
let restoreFlowTarget: string | null = null;
let currentRestorePhase: RestorePhase = "checking";

const restoreSlides: LoadingStorySlide[] = [
  {
    id: "restore-checking",
    eyebrow: "Restore",
    tag: "身份",
    status: "读取登录状态",
    headline: "正在确认登录状态",
    body: "先判断是否有可恢复的会话。",
    image: "/loading-lab/emoji-heads/emoji_04.png",
    alt: "思考表情",
    accent: "#D7E6C7",
    accentSoft: "#F5F9EF",
    glow: "rgba(137, 177, 107, 0.22)"
  },
  {
    id: "restore-syncing",
    eyebrow: "Restore",
    tag: "同步",
    status: "同步站内会话",
    headline: "正在同步站内会话",
    body: "把 CloudBase 登录状态换成站内会话。",
    image: "/loading-lab/emoji-heads/emoji_06.png",
    alt: "等待表情",
    accent: "#DDD7F7",
    accentSoft: "#F5F2FF",
    glow: "rgba(152, 141, 227, 0.2)"
  },
  {
    id: "restore-redirecting",
    eyebrow: "Restore",
    tag: "进入",
    status: "准备进入工具页",
    headline: "马上带你回到工具页",
    body: "会话已经接好，正在进入目标页面。",
    image: "/loading-lab/emoji-heads/emoji_01.png",
    alt: "开心表情",
    accent: "#F6D9A9",
    accentSoft: "#FFF7E3",
    glow: "rgba(239, 189, 88, 0.24)"
  }
];

function emitRestorePhase(nextPhase: RestorePhase) {
  currentRestorePhase = nextPhase;
  restoreSubscribers.forEach((subscriber) => subscriber(nextPhase));
}

function subscribeRestorePhase(subscriber: RestoreFlowSubscriber) {
  restoreSubscribers.add(subscriber);
  subscriber(currentRestorePhase);

  return () => {
    restoreSubscribers.delete(subscriber);
  };
}

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
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      accessToken: options.accessToken,
      phone: options.phoneNumber
    })
  });

  const payload = (await response.json()) as {
    success: boolean;
    error?: string;
  };

  if (!response.ok || !payload.success) {
    throw new Error(payload.error || "Failed to create session.");
  }
}

function getLoginRedirect(target: Route) {
  return `/login?from=${encodeURIComponent(target)}` as Route;
}

function ensureRestoreFlow(target: Route) {
  if (restoreFlowPromise && restoreFlowTarget === target) {
    return restoreFlowPromise;
  }

  restoreFlowTarget = target;
  emitRestorePhase("checking");

  const flowPromise = (async () => {
    try {
      const auth = getCloudBaseAuth();
      const loginState = await auth.getLoginState();

      if (!loginState?.user) {
        throw new Error("No CloudBase login state.");
      }

      emitRestorePhase("syncing");
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
        phoneNumber
      });

      emitRestorePhase("redirecting");
      return target;
    } catch {
      emitRestorePhase("redirecting");
      return getLoginRedirect(target);
    }
  })();

  restoreFlowPromise = flowPromise;

  void flowPromise.finally(() => {
    if (restoreFlowPromise === flowPromise) {
      restoreFlowPromise = null;
      restoreFlowTarget = null;
      currentRestorePhase = "checking";
    }
  });

  return flowPromise;
}

export function RestoreSessionScreen({ to }: { to?: string | null }) {
  const router = useRouter();
  const target = getSafeRedirect(to);
  const [phase, setPhase] = useState<RestorePhase>(currentRestorePhase);

  useEffect(() => {
    let cancelled = false;
    const unsubscribe = subscribeRestorePhase((nextPhase) => {
      if (!cancelled) {
        setPhase(nextPhase);
      }
    });

    void ensureRestoreFlow(target).then((nextRoute) => {
      if (!cancelled) {
        router.replace(nextRoute);
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [router, target]);

  const activeSlides =
    phase === "checking"
      ? [restoreSlides[0], restoreSlides[1]]
      : phase === "syncing"
        ? [restoreSlides[1], restoreSlides[2]]
        : [restoreSlides[2]];

  return (
    <main aria-busy="true" className="min-h-screen bg-cream-50">
      <EmojiLoadingStage
        slides={activeSlides}
        fullScreen
      />
      <span className="sr-only">正在恢复登录状态</span>
    </main>
  );
}
