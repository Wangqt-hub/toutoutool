import Link from "next/link";
import type { Route } from "next";
import { cookies } from "next/headers";
import { LandingSessionRestore } from "@/components/auth/landing-session-restore";
import { SESSION_COOKIE_NAME, SESSION_HINT_COOKIE_NAME } from "@/lib/auth/session";
import { getServerSession } from "@/lib/auth/server";
import { CapybaraHero } from "@/components/mascot/CapybaraHero";
import { Button } from "@/components/ui/button";

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
      <main className="flex min-h-screen flex-col items-center justify-center px-4 py-10">
        <LandingSessionRestore redirectTo={redirectTarget} />

        <section className="flex w-full max-w-4xl flex-col items-center gap-10 md:flex-row">
          <div className="flex flex-1 flex-col items-start gap-6">
            <div className="inline-flex items-center gap-2 rounded-full bg-cream-100 px-3 py-1 text-xs text-accent-brown shadow-sm">
              <span>头头工具 · toutoutool</span>
            </div>

            <h1 className="text-[2.75rem] font-extrabold leading-[1.08] tracking-tight text-slate-900 md:text-4xl lg:text-5xl">
              <span className="block">把脑袋里的小想法</span>
              <span className="block text-accent-brown">变成顺手的小工具</span>
            </h1>

            <p className="text-sm leading-relaxed text-slate-600 md:text-base">
              在这里，我们把灵感收好、把流程变轻。你可以上传图片做拼豆图纸，
              规划旅行，也可以先把脑海里的工具想法放进点子箱。
            </p>

            <div className="flex flex-wrap items-center gap-4">
              <Button asChild size="lg">
                <Link href="/login">注册 / 登录</Link>
              </Button>
              <Button asChild variant="ghost" size="lg">
                <Link href="#preview">先看看有哪些工具</Link>
              </Button>
            </div>
          </div>

          <div className="flex flex-1 flex-col items-center justify-center">
            <CapybaraHero variant="hero" size="lg" priority />
            <p className="mt-4 text-xs text-slate-500">
              今天也慢慢来，但每次都往前一点点。
            </p>
          </div>
        </section>

        <section
          id="preview"
          className="mt-16 grid w-full max-w-4xl grid-cols-1 gap-4 md:grid-cols-3"
        >
          <div className="rounded-3xl border border-cream-100 bg-white/70 p-4 shadow-sm">
            <h2 className="mb-1 text-sm font-semibold">拼豆工具</h2>
            <p className="text-xs text-slate-600">
              上传图片，生成像素化拼豆图纸，把喜欢的角色或照片变成可制作的豆图。
            </p>
          </div>

          <div className="rounded-3xl border border-cream-100 bg-white/70 p-4 shadow-sm">
            <h2 className="mb-1 text-sm font-semibold">旅行规划</h2>
            <p className="text-xs text-slate-600">
              输入时间、目的地和预算，整理出更轻松的出行安排。
            </p>
          </div>

          <div className="rounded-3xl border border-cream-100 bg-white/70 p-4 shadow-sm">
            <h2 className="mb-1 text-sm font-semibold">点子箱</h2>
            <p className="text-xs text-slate-600">
              先把想做的小工具记下来，等合适的时候再把它做出来。
            </p>
          </div>
        </section>
      </main>
    </>
  );
}
