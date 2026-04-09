"use client";

import { useEffect, useRef, useState } from "react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { EmojiLoadingStage } from "@/components/mascot/EmojiLoadingStage";
import type { LoadingStorySlide } from "@/lib/loading-story-presets";

const MIN_OVERLAY_MS = 3000;
const MIN_REDIRECT_DISPLAY_MS = 3000;
const FADE_OUT_MS = 320;

const landingSlides: LoadingStorySlide[] = [
  {
    id: "landing-ready-01",
    eyebrow: "Landing",
    tag: "首页",
    status: "首页资源准备中",
    headline: "首页正在整理中",
    body: "首屏视觉和入口区域正在就位。",
    image: "/loading-lab/emoji-heads/emoji_08.png",
    alt: "平静微笑表情",
    accent: "#F3CDBB",
    accentSoft: "#FFF2EA",
    glow: "rgba(233, 154, 107, 0.22)"
  },
  {
    id: "landing-ready-02",
    eyebrow: "Landing",
    tag: "资源",
    status: "首屏样式加载中",
    headline: "首屏样式正在对齐",
    body: "字体和页面层次确认完成后就会显示完整首页。",
    image: "/loading-lab/emoji-heads/emoji_05.png",
    alt: "专注表情",
    accent: "#C9DDF6",
    accentSoft: "#EFF6FF",
    glow: "rgba(111, 157, 219, 0.2)"
  }
];

const toolEntrySlides: LoadingStorySlide[] = [
  {
    id: "landing-tools-01",
    eyebrow: "Tools",
    tag: "入口",
    status: "检测到有效会话",
    headline: "正在回到工具入口",
    body: "已经确认你的站内身份，马上就会带你回去。",
    image: "/loading-lab/emoji-heads/emoji_01.png",
    alt: "开心表情",
    accent: "#F6D9A9",
    accentSoft: "#FFF7E3",
    glow: "rgba(239, 189, 88, 0.24)"
  },
  {
    id: "landing-tools-02",
    eyebrow: "Tools",
    tag: "页面",
    status: "工具页准备中",
    headline: "工具页正在展开",
    body: "导航和常用入口准备好后就会自动切过去。",
    image: "/loading-lab/emoji-heads/emoji_08.png",
    alt: "平静微笑表情",
    accent: "#F3CDBB",
    accentSoft: "#FFF2EA",
    glow: "rgba(233, 154, 107, 0.22)"
  }
];

const restoreSlides: LoadingStorySlide[] = [
  {
    id: "landing-restore-01",
    eyebrow: "Restore",
    tag: "身份",
    status: "检测到历史登录提示",
    headline: "正在恢复你的会话",
    body: "检测到之前的登录痕迹，马上帮你回到工具页。",
    image: "/loading-lab/emoji-heads/emoji_04.png",
    alt: "思考表情",
    accent: "#D7E6C7",
    accentSoft: "#F5F9EF",
    glow: "rgba(137, 177, 107, 0.22)"
  },
  {
    id: "landing-restore-02",
    eyebrow: "Restore",
    tag: "跳转",
    status: "准备进入会话恢复",
    headline: "正在连接恢复流程",
    body: "恢复页准备好后，会继续同步身份并自动进入工具页。",
    image: "/loading-lab/emoji-heads/emoji_01.png",
    alt: "开心表情",
    accent: "#F6D9A9",
    accentSoft: "#FFF7E3",
    glow: "rgba(239, 189, 88, 0.24)"
  }
];

type LandingSessionRestoreProps = {
  redirectTo?: Route;
};

type RedirectKind = "tools" | "restore" | null;

function getRedirectKind(redirectTo?: Route): RedirectKind {
  if (!redirectTo) {
    return null;
  }

  return redirectTo === "/tools" ? "tools" : "restore";
}

export function LandingSessionRestore({
  redirectTo
}: LandingSessionRestoreProps) {
  const router = useRouter();
  const mountedAtRef = useRef<number | null>(null);
  const [pageLoaded, setPageLoaded] = useState(false);
  const [fontsReady, setFontsReady] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [shouldRender, setShouldRender] = useState(true);
  const redirectKind = getRedirectKind(redirectTo);
  const isRedirecting = redirectKind !== null;

  useEffect(() => {
    mountedAtRef.current = performance.now();
  }, []);

  useEffect(() => {
    if (!redirectTo) {
      return undefined;
    }

    const mountedAt = mountedAtRef.current ?? performance.now();
    const elapsed = performance.now() - mountedAt;
    const waitBeforeRedirect = Math.max(0, MIN_REDIRECT_DISPLAY_MS - elapsed);
    const softRedirectTimer = window.setTimeout(() => {
      router.replace(redirectTo);
    }, waitBeforeRedirect);
    const hardRedirectTimer = window.setTimeout(() => {
      const currentLocation = `${window.location.pathname}${window.location.search}`;

      if (currentLocation !== redirectTo) {
        window.location.replace(redirectTo);
      }
    }, waitBeforeRedirect + 980);

    return () => {
      window.clearTimeout(softRedirectTimer);
      window.clearTimeout(hardRedirectTimer);
    };
  }, [redirectTo, router]);

  useEffect(() => {
    let cancelled = false;

    const markLoaded = () => {
      if (!cancelled) {
        setPageLoaded(true);
      }
    };

    if (document.readyState === "complete") {
      markLoaded();
    } else {
      window.addEventListener("load", markLoaded, { once: true });
    }

    const fontSet = document.fonts;
    if (!fontSet) {
      setFontsReady(true);
    } else {
      void fontSet.ready
        .catch(() => undefined)
        .then(() => {
          if (!cancelled) {
            setFontsReady(true);
          }
        });
    }

    return () => {
      cancelled = true;
      window.removeEventListener("load", markLoaded);
    };
  }, []);

  const homepageReady = pageLoaded && fontsReady;

  useEffect(() => {
    if (isRedirecting) {
      setShouldRender(true);
      setIsVisible(true);
      return undefined;
    }

    if (!homepageReady) {
      setShouldRender(true);
      setIsVisible(true);
      return undefined;
    }

    const mountedAt = mountedAtRef.current ?? performance.now();
    const elapsed = performance.now() - mountedAt;
    const waitBeforeFade = Math.max(0, MIN_OVERLAY_MS - elapsed);
    const fadeTimer = window.setTimeout(() => {
      setIsVisible(false);
    }, waitBeforeFade);
    const removeTimer = window.setTimeout(() => {
      setShouldRender(false);
    }, waitBeforeFade + FADE_OUT_MS);

    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(removeTimer);
    };
  }, [homepageReady, isRedirecting]);

  const slides =
    redirectKind === "tools"
      ? toolEntrySlides
      : redirectKind === "restore"
        ? restoreSlides
        : landingSlides;
  const srLabel =
    redirectKind === "tools"
      ? "正在进入工具页"
      : redirectKind === "restore"
        ? "正在恢复会话"
        : "正在准备首页内容";

  if (!shouldRender) {
    return null;
  }

  return (
    <div
      aria-live="polite"
      className={`fixed inset-0 z-50 transition-opacity duration-300 ${
        isVisible ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
      }`}
    >
      <div className="absolute inset-0 bg-[rgba(247,239,231,0.86)] backdrop-blur-[18px]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.95),_rgba(248,240,231,0.65)_34%,_rgba(236,221,205,0.62)_100%)]" />

      <EmojiLoadingStage
        slides={slides}
        autoPlayMs={4200}
        fullScreen
        className="relative z-10"
      />

      <span className="sr-only">{srLabel}</span>
    </div>
  );
}
