"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Puzzle, Plane, Lightbulb, Sparkles } from "lucide-react";
import { CapybaraHero } from "@/components/mascot/CapybaraHero";
import { Button } from "@/components/ui/button";

export function LandingUI() {
  return (
    <main className="relative flex min-h-screen flex-col items-center overflow-hidden bg-cream-50 selection:bg-accent-yellow/50">
      {/* 动态背景 */}
      <div className="absolute inset-0 pointer-events-none">
        <motion.div
          animate={{
            scale: [1, 1.1, 1],
            rotate: [0, 5, -5, 0],
          }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -left-20 top-10 h-96 w-96 rounded-full bg-blush/40 blur-3xl"
        />
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            x: [0, 20, 0],
          }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
          className="absolute right-0 top-1/4 h-[500px] w-[500px] rounded-full bg-accent-mint/30 blur-3xl"
        />
        <motion.div
          animate={{
            scale: [1, 1.15, 1],
            y: [0, -30, 0],
          }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
          className="absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-accent-yellow/40 blur-3xl"
        />
      </div>

      <div className="relative z-10 w-full max-w-5xl px-4 py-12 md:py-20 flex flex-col items-center">
        {/* Hero Section */}
        <section className="flex w-full flex-col items-center gap-10 md:flex-row md:justify-between lg:gap-16">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="flex flex-1 flex-col items-start gap-6 md:gap-8"
          >
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="inline-flex cursor-default items-center gap-2 rounded-full border border-accent-brown/10 bg-white/70 px-4 py-1.5 text-xs font-semibold tracking-wide text-accent-deep shadow-sm backdrop-blur-md"
            >
              <Sparkles className="h-3.5 w-3.5 text-accent-brown" />
              <span>头头工具 · toutoutool</span>
            </motion.div>

            <h1 className="text-[2.75rem] font-black leading-[1.1] tracking-tight text-slate-800 md:text-5xl lg:text-[4rem]">
              <span className="block">把脑袋里的</span>
              <span className="relative mt-2 block">
                <span className="relative z-10 text-accent-brown">小想法</span>
                <span className="absolute -bottom-2 left-0 -z-10 h-4 w-[160px] md:w-[220px] rounded-full bg-accent-yellow/60" />
              </span>
              <span className="mt-2 block">变成顺手的小工具</span>
            </h1>

            <p className="max-w-md text-base leading-relaxed text-slate-600 md:text-lg">
              在这里，我们把灵感收好、把流程变轻。你可以上传图片做拼豆图纸，
              规划旅行，也可以先把脑海里的工具想法放进点子箱。
            </p>

            <div className="flex flex-wrap items-center gap-4">
              <Button asChild size="lg" className="h-12 md:h-14 md:px-8 md:text-lg shadow-cute">
                <Link href="/login">马上体验</Link>
              </Button>
              <Button asChild variant="secondary" size="lg" className="h-12 md:h-14 md:px-8 md:text-lg shadow-sm">
                <Link href="#preview">逛逛小工具</Link>
              </Button>
            </div>
          </motion.div>

          {/* 右侧互动大头头 */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, type: "spring", bounce: 0.4 }}
            className="relative mt-10 flex flex-1 flex-col items-center justify-center md:mt-0"
          >
            <motion.div
              animate={{ y: [-10, 10, -10] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            >
              <CapybaraHero variant="hero" size="lg" priority className="h-56 w-56 md:h-72 md:w-72 drop-shadow-2xl" />
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.5 }}
              className="absolute -bottom-6 md:-bottom-10 rounded-2xl border border-white/60 bg-white/50 px-4 py-2 text-xs font-semibold text-slate-500 shadow-sm backdrop-blur-md"
            >
              今天也慢慢来，但每次都往前一点点。🦆
            </motion.div>
          </motion.div>
        </section>

        {/* 悬浮工具卡片区 */}
        <section
          id="preview"
          className="relative mt-32 w-full max-w-5xl xs:mt-24"
        >
          <div className="absolute right-0 -top-12 z-0 hidden md:block">
             <CapybaraHero variant="figure" size="xs" className="opacity-80" />
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3 md:gap-8">
            <ToolCard
              delay={0.1}
              icon={Puzzle}
              title="拼豆工具"
              desc="上传图片，生成像素化拼豆图纸，把喜欢的角色或照片变成可制作的豆图。"
              colorClass="bg-sky-50"
              iconColor="text-sky-500"
              borderColor="hover:border-sky-200"
              shadowColor="hover:shadow-sky-100"
              href="/tools/bead"
            />
            <ToolCard
              delay={0.2}
              icon={Plane}
              title="旅行规划"
              desc="输入时间、目的地和预算，整理出更轻松的出行安排。"
              colorClass="bg-emerald-50"
              iconColor="text-emerald-500"
              borderColor="hover:border-emerald-200"
              shadowColor="hover:shadow-emerald-100"
              href="/tools/travel"
              yOffset={16}
            />
            <ToolCard
              delay={0.3}
              icon={Lightbulb}
              title="点子箱"
              desc="先把想做的小工具记下来，等合适的时候再把它做出来。"
              colorClass="bg-rose-50"
              iconColor="text-rose-500"
              borderColor="hover:border-rose-200"
              shadowColor="hover:shadow-rose-100"
              href="/tools/ideas"
              yOffset={32}
            />
          </div>
        </section>
      </div>
    </main>
  );
}

function ToolCard({ delay, title, desc, icon: Icon, colorClass, iconColor, borderColor, shadowColor, href, yOffset = 0 }: any) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 + yOffset }}
      whileInView={{ opacity: 1, y: yOffset }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.6, delay, type: "spring" }}
      className={`group relative h-full`}
    >
      <Link href={href}>
        <motion.div
          whileHover={{ y: -8, scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className={`flex h-full cursor-pointer flex-col overflow-hidden rounded-[2rem] border border-white bg-white/70 p-6 shadow-sm backdrop-blur-md transition-all duration-300 ${borderColor} ${shadowColor} hover:shadow-xl`}
        >
          <div className="mb-4 flex items-center justify-between">
            <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${colorClass}`}>
              <Icon className={`h-6 w-6 ${iconColor}`} />
            </div>
            {/* 卡片右上角挂一个小图案或空心圆 */}
            <div className="h-2 w-2 rounded-full border-2 border-slate-200 group-hover:border-accent-brown transition-colors" />
          </div>
          <h2 className="mb-2 text-lg font-bold text-slate-800">{title}</h2>
          <p className="text-sm leading-relaxed text-slate-600">
            {desc}
          </p>
        </motion.div>
      </Link>
    </motion.div>
  );
}
