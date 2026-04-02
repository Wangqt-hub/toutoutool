"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CapybaraHero } from "@/components/mascot/CapybaraHero";
import { LogoutButton } from "@/components/ui/logout-button";
import { MembershipPreviewButton } from "@/components/ui/membership-preview";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const headerRef = useRef<HTMLElement | null>(null);
  const [headerHeight, setHeaderHeight] = useState(76);
  const isFullscreenWorkspace = pathname?.startsWith("/tools/bead/bead-mode");
  const MIN_HEADER_HEIGHT = 64;

  const updateHeaderHeight = useCallback(() => {
    const element = headerRef.current;

    if (!element) {
      return;
    }

    const measuredHeight = Math.ceil(element.getBoundingClientRect().height);
    const nextHeight =
      measuredHeight >= MIN_HEADER_HEIGHT
        ? measuredHeight
        : Math.max(headerHeight, MIN_HEADER_HEIGHT);

    document.documentElement.style.setProperty(
      "--dashboard-header-height",
      `${nextHeight}px`
    );
    setHeaderHeight((previous) =>
      previous === nextHeight ? previous : nextHeight
    );
  }, [headerHeight]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!isFullscreenWorkspace) {
      return;
    }

    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;

    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";

    return () => {
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overflow = previousBodyOverflow;
    };
  }, [isFullscreenWorkspace]);

  useEffect(() => {
    const value = open ? "true" : "false";
    document.documentElement.dataset.dashboardDrawerOpen = value;
    document.body.dataset.dashboardDrawerOpen = value;

    return () => {
      delete document.documentElement.dataset.dashboardDrawerOpen;
      delete document.body.dataset.dashboardDrawerOpen;
    };
  }, [open]);

  useLayoutEffect(() => {
    updateHeaderHeight();
    const rafId = window.requestAnimationFrame(updateHeaderHeight);

    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, [pathname, updateHeaderHeight]);

  useEffect(() => {
    const element = headerRef.current;

    if (!element) {
      return;
    }

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateHeaderHeight);

      return () => {
        window.removeEventListener("resize", updateHeaderHeight);
      };
    }

    const observer = new ResizeObserver(updateHeaderHeight);
    observer.observe(element);

    return () => {
      document.documentElement.style.removeProperty("--dashboard-header-height");
      observer.disconnect();
    };
  }, [updateHeaderHeight]);

  return (
    <div
      className={`bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.94),rgba(255,247,237,0.92)_36%,rgba(255,251,235,0.88)_100%)] ${
        isFullscreenWorkspace ? "h-[100dvh] overflow-hidden" : "min-h-screen"
      }`}
    >
      <header
        ref={headerRef}
        data-dashboard-header="true"
        className="fixed left-0 right-0 top-0 z-50 border-b border-slate-200 bg-white"
      >
        <div className="mx-auto flex max-w-[1680px] items-center justify-between px-2.5 py-3 sm:px-4 lg:px-8">
          <Link href="/tools" className="flex items-center gap-2">
            <div className="h-9 w-9">
              <CapybaraHero variant="figure" size="xs" />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-semibold text-slate-900">头头工具</span>
              <span className="text-[10px] text-slate-500">
                把小脑洞变成小工具
              </span>
            </div>
          </Link>

          <nav className="hidden items-center gap-2 text-xs md:flex md:text-sm">
            <Link
              href="/tools"
              className="rounded-full px-3 py-1 text-slate-700 transition-colors hover:bg-cream-100"
            >
              工具首页
            </Link>
            <Link
              href="/tools/bead"
              className="rounded-full px-3 py-1 text-slate-700 transition-colors hover:bg-cream-100"
            >
              拼豆工具
            </Link>
            <Link
              href="/tools/travel"
              className="rounded-full px-3 py-1 text-slate-700 transition-colors hover:bg-cream-100"
            >
              旅行规划
            </Link>
            <Link
              href="/tools/ideas"
              className="rounded-full px-3 py-1 text-slate-700 transition-colors hover:bg-cream-100"
            >
              奇思妙想箱
            </Link>
          </nav>

          <div className="flex items-center gap-2">
            <div className="hidden md:inline-flex">
              <MembershipPreviewButton />
            </div>
            <div className="hidden md:inline-flex">
              <LogoutButton />
            </div>
            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm md:hidden"
              onClick={() => setOpen((prev) => !prev)}
              aria-label="打开导航"
            >
              <span className="sr-only">打开导航</span>
              <div className="flex flex-col gap-1">
                <span className="h-0.5 w-4 rounded-full bg-slate-700" />
                <span className="h-0.5 w-4 rounded-full bg-slate-700" />
                <span className="h-0.5 w-4 rounded-full bg-slate-700" />
              </div>
            </button>
          </div>
        </div>
      </header>

      {open ? (
        <div className="fixed inset-0 z-50 overscroll-contain md:hidden">
          <div
            className="absolute inset-0 bg-slate-950/72"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute inset-y-0 right-0 flex w-[78vw] max-w-64 flex-col gap-4 overflow-y-auto border-l border-slate-200 bg-white p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[-18px_0_50px_rgba(0,0,0,0.18)]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8">
                  <CapybaraHero variant="figure" size="xs" />
                </div>
                <div className="flex flex-col leading-tight">
                  <span className="text-xs font-semibold text-slate-900">头头工具</span>
                  <span className="text-[10px] text-slate-500">移动端导航</span>
                </div>
              </div>
              <button
                type="button"
                className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-xs text-slate-700"
                onClick={() => setOpen(false)}
                aria-label="关闭导航"
              >
                ×
              </button>
            </div>

            <nav className="flex flex-col gap-1 text-xs">
              <Link
                href="/tools"
                className="rounded-2xl px-3 py-2 text-slate-700 hover:bg-cream-100"
                onClick={() => setOpen(false)}
              >
                工具首页
              </Link>
              <Link
                href="/tools/bead"
                className="rounded-2xl px-3 py-2 text-slate-700 hover:bg-cream-100"
                onClick={() => setOpen(false)}
              >
                拼豆工具
              </Link>
              <Link
                href="/tools/travel"
                className="rounded-2xl px-3 py-2 text-slate-700 hover:bg-cream-100"
                onClick={() => setOpen(false)}
              >
                旅行规划
              </Link>
              <Link
                href="/tools/ideas"
                className="rounded-2xl px-3 py-2 text-slate-700 hover:bg-cream-100"
                onClick={() => setOpen(false)}
              >
                奇思妙想箱
              </Link>
            </nav>

            <div className="mt-auto flex flex-col gap-2">
              <MembershipPreviewButton />
              <LogoutButton />
            </div>
          </aside>
        </div>
      ) : null}

      <main
        className={
          isFullscreenWorkspace
            ? "h-[calc(100dvh-var(--dashboard-header-height,76px))] overflow-hidden"
            : "mx-auto max-w-[1680px] px-2.5 py-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-4 sm:py-5 lg:px-8 lg:py-7"
        }
        style={
          isFullscreenWorkspace
            ? {
                marginTop: `${headerHeight}px`,
              }
            : {
                paddingTop: `${headerHeight + 16}px`,
              }
        }
      >
        {isFullscreenWorkspace ? (
          <div className="h-full overflow-hidden">{children}</div>
        ) : (
          children
        )}
      </main>
    </div>
  );
}
