"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Puzzle, Plane, Lightbulb } from "lucide-react";
import { CapybaraHero } from "@/components/mascot/CapybaraHero";

const tools = [
  {
    id: "bead",
    href: "/tools/bead",
    name: "拼豆工具",
    description: "上传图片，生成拼豆图纸。",
    badge: "像素 · 手作",
    icon: Puzzle,
    colorClass: "bg-sky-50 outline-sky-200",
    iconColor: "text-sky-500",
    tilt: -2,
    yOffset: 0,
    zIndex: 10,
  },
  {
    id: "travel",
    href: "/tools/travel",
    name: "旅行计划",
    description: "填时间地点，秒出旅行安排。",
    badge: "行程 · 预算",
    icon: Plane,
    colorClass: "bg-emerald-50 outline-emerald-200",
    iconColor: "text-emerald-500",
    tilt: 3,
    yOffset: 20,
    zIndex: 20,
  },
  {
    id: "ideas",
    href: "/tools/ideas",
    name: "奇思妙想箱",
    description: "把你想要的新工具写给头头。",
    badge: "反馈 · 灵感",
    icon: Lightbulb,
    colorClass: "bg-rose-50 outline-rose-200",
    iconColor: "text-rose-500",
    tilt: -1,
    yOffset: 40,
    zIndex: 30,
  }
];

export default function ToolsHomePage() {
  return (
    <div className="relative min-h-[calc(100vh-6rem)] w-full max-w-5xl overflow-hidden px-2 sm:px-6">
      <section className="relative z-40 mb-10 flex flex-col justify-between gap-6 md:flex-row md:items-end">
        <div className="flex items-center gap-4">
          <div className="hidden h-16 w-16 md:block">
            <CapybaraHero variant="figure" size="sm" className="drop-shadow-sm" />
          </div>
          <div>
            <h1 className="mb-2 text-3xl font-black tracking-tight text-slate-800">
              今天想和头头一起做什么？
            </h1>
            <p className="text-sm font-medium text-slate-500">
              这里是你的小工具抽屉，随便拿出去玩吧。
            </p>
          </div>
        </div>
        <div className="self-start rounded-full bg-white/70 px-4 py-1.5 text-[11px] font-bold tracking-widest text-accent-brown shadow-sm backdrop-blur-md md:self-auto border border-accent-brown/20">
          会员预留：敬请期待
        </div>
      </section>

      {/* 桌面端：散落的绘图板；手机端：叠放的卡片堆 */}
      <section className="relative mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 md:mt-24 md:flex md:justify-center md:gap-0 lg:ml-10">
        {tools.map((tool, index) => {
          const Icon = tool.icon;
          return (
            <motion.div
              key={tool.id}
              initial={{ opacity: 0, y: 50, rotate: 0 }}
              animate={{ opacity: 1, y: 0, rotate: tool.tilt }}
              transition={{ delay: index * 0.15, type: "spring", bounce: 0.4 }}
              className={`md:absolute md:w-[320px] transition-all`}
              style={{ 
                zIndex: tool.zIndex, 
                left: `calc(50% - 160px + ${(index - 1) * 300}px)`,
                top: `${tool.yOffset}px` 
              }}
            >
              <Link href={tool.href as any} className="block group">
                <motion.div
                  whileHover={{ 
                    scale: 1.05, 
                    rotate: 0, 
                    zIndex: 50,
                    y: -15
                  }}
                  whileTap={{ scale: 0.95 }}
                  className={`relative flex h-48 cursor-pointer flex-col justify-between rounded-[2rem] border-2 border-white bg-white/85 p-6 shadow-cute backdrop-blur-xl outline outline-4 outline-transparent transition-all hover:${tool.colorClass} hover:shadow-cute-hover`}
                >
                  <div className="flex items-start justify-between">
                    <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${tool.colorClass} shadow-inner`}>
                      <Icon className={`h-7 w-7 ${tool.iconColor}`} />
                    </div>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-bold text-slate-500 shadow-inner group-hover:bg-white transition-colors">
                      {tool.badge}
                    </span>
                  </div>

                  <div>
                    <h2 className="mb-1.5 text-xl font-bold tracking-tight text-slate-800">
                      {tool.name}
                    </h2>
                    <p className="text-xs font-semibold leading-relaxed text-slate-500">
                      {tool.description}
                    </p>
                  </div>
                  
                  {/* 可爱的小夹子或者胶带来装饰卡片（纯CSS） */}
                  <div className="absolute -top-3 left-1/2 h-6 w-12 -translate-x-1/2 rounded bg-white/50 backdrop-blur-md shadow-sm rotate-2"></div>
                </motion.div>
              </Link>
            </motion.div>
          );
        })}
      </section>
    </div>
  );
}
