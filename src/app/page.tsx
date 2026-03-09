import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CapybaraHero } from "@/components/mascot/CapybaraHero";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default async function LandingPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { session }
  } = await supabase.auth.getSession();

  if (session) {
    redirect("/tools");
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <section className="max-w-4xl w-full flex flex-col md:flex-row items-center gap-10">
        <div className="flex-1 flex flex-col items-start gap-6">
          <div className="inline-flex items-center gap-2 rounded-full bg-cream-100 px-3 py-1 text-xs text-accent-brown shadow-sm">
            <span>✨ 头头工具 · toutoutool</span>
            <span className="text-[10px] bg-blush px-2 py-0.5 rounded-full">
              小工具集合站
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-extrabold leading-tight text-slate-900">
            把脑袋里的
            <span className="text-accent-brown"> 小想法 </span>
            变成
            <span className="text-accent-brown"> 小工具</span>
          </h1>
          <p className="text-sm md:text-base text-slate-600 leading-relaxed">
            在这里，头头陪你一起捣鼓灵感。
            上传图片做拼豆、规划一场轻松旅行，或者把还没实现的点子丢进奇思妙想箱，等它发芽。
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <Button asChild size="lg">
              <Link href="/login">注册 / 登录</Link>
            </Button>
            <Button asChild variant="ghost" size="lg">
              <Link href="#preview">先看看有哪些小工具</Link>
            </Button>
          </div>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center">
          <CapybaraHero variant="hero" size="lg" />
          <p className="mt-4 text-xs text-slate-500">
            “今天也要慢慢来，但一定要往前走一步。” – 头头
          </p>
        </div>
      </section>

      <section
        id="preview"
        className="mt-16 w-full max-w-4xl grid grid-cols-1 md:grid-cols-3 gap-4"
      >
        <div className="rounded-3xl bg-white/70 p-4 shadow-sm border border-cream-100">
          <h2 className="font-semibold text-sm mb-1">拼豆工具</h2>
          <p className="text-xs text-slate-600">
            上传图片，一键生成像素化拼豆图纸，让喜欢的角色变成真实的小豆豆。
          </p>
        </div>
        <div className="rounded-3xl bg-white/70 p-4 shadow-sm border border-cream-100">
          <h2 className="font-semibold text-sm mb-1">旅行计划</h2>
          <p className="text-xs text-slate-600">
            输入时间、地点和预算，自动排出轻松不赶场的旅程安排。
          </p>
        </div>
        <div className="rounded-3xl bg-white/70 p-4 shadow-sm border border-cream-100">
          <h2 className="font-semibold text-sm mb-1">奇思妙想箱</h2>
          <p className="text-xs text-slate-600">
            把你想要的工具写下来，悄悄塞进箱子，后续版本里说不定就长出来了。
          </p>
        </div>
      </section>
    </main>
  );
}

