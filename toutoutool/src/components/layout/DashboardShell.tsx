"use client";

import { useState } from "react";
import Link from "next/link";
import { CapybaraHero } from "@/components/mascot/CapybaraHero";
import { LogoutButton } from "@/components/ui/logout-button";
import { MembershipPreviewButton } from "@/components/ui/membership-preview";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen bg-cream-50">
      <header className="border-b border-cream-100 bg-white/70 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link href="/tools" className="flex items-center gap-2">
            <div className="h-9 w-9">
              <CapybaraHero variant="figure" size="xs" />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-semibold text-slate-900">
                头头工具
              </span>
              <span className="text-[10px] text-slate-500">
                把小脑洞变成小工具
              </span>
            </div>
          </Link>

          {/* 桌面端：顶部导航 */}
          <nav className="hidden md:flex items-center gap-2 text-xs md:text-sm">
            <Link
              href="/tools"
              className="rounded-full px-3 py-1 text-slate-700 hover:bg-cream-100"
            >
              工具首页
            </Link>
            <Link
              href="/tools/bead"
              className="rounded-full px-3 py-1 text-slate-700 hover:bg-cream-100"
            >
              拼豆工具
            </Link>
            <Link
              href="/tools/travel"
              className="rounded-full px-3 py-1 text-slate-700 hover:bg-cream-100"
            >
              旅行计划
            </Link>
            <Link
              href="/tools/ideas"
              className="rounded-full px-3 py-1 text-slate-700 hover:bg-cream-100"
            >
              奇思妙想箱
            </Link>
          </nav>

          {/* 右侧操作区：桌面端显示会员+退出，移动端只显示菜单按钮 */}
          <div className="flex items-center gap-2">
            <div className="hidden md:inline-flex">
              <MembershipPreviewButton />
            </div>
            <div className="hidden md:inline-flex">
              <LogoutButton />
            </div>
            <button
              type="button"
              className="md:hidden inline-flex h-9 w-9 items-center justify-center rounded-full border border-cream-100 bg-cream-50/80 text-slate-700"
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

      {/* 移动端：侧边抽屉导航 */}
      {open && (
        <div className="fixed inset-0 z-30 md:hidden">
          <div
            className="absolute inset-0 bg-black/20"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-64 bg-cream-50 border-r border-cream-100 shadow-[0_12px_40px_rgba(0,0,0,0.18)] p-4 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8">
                  <CapybaraHero variant="figure" size="xs" />
                </div>
                <div className="flex flex-col leading-tight">
                  <span className="text-xs font-semibold text-slate-900">
                    头头工具
                  </span>
                  <span className="text-[10px] text-slate-500">
                    小工具抽屉
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="h-7 w-7 inline-flex items-center justify-center rounded-full bg-white/80 border border-cream-100 text-slate-700 text-xs"
                onClick={() => setOpen(false)}
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
                旅行计划
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
      )}

      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}

