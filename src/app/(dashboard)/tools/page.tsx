import Link from "next/link";
import { Card } from "@/components/ui/card";

const tools = [
  {
    id: "bead",
    href: "/tools/bead",
    name: "拼豆工具",
    description: "上传图片，根据大小和颜色数量生成拼豆图纸。",
    badge: "像素 · 手作"
  },
  {
    id: "travel",
    href: "/tools/travel",
    name: "旅行计划",
    description: "填写时间、地点和预算，帮你排一个不赶场的旅行。",
    badge: "行程 · 预算"
  },
  {
    id: "ideas",
    href: "/tools/ideas",
    name: "奇思妙想箱",
    description: "把你想要的新工具写给我们，让小脑洞慢慢长大。",
    badge: "反馈 · 灵感"
  }
] as const;

export default function ToolsHomePage() {
  return (
    <div className="space-y-6">
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <h1 className="mb-2 text-2xl font-bold text-slate-900">
            今天想和头头一起做什么？
          </h1>
          <p className="text-sm text-slate-600">
            这里是你的小工具抽屉，后面还会一点点变得更丰富。
          </p>
        </div>
        <div className="self-start rounded-full bg-cream-100 px-3 py-1 text-[11px] text-slate-600 md:self-auto">
          会员预留：后面会解锁更大的拼豆图纸、更聪明的旅行规划等功能。
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {tools.map((tool) => (
          <Link key={tool.id} href={tool.href}>
            <Card className="h-full cursor-pointer bg-white/80 transition-transform hover:-translate-y-0.5 hover:shadow-lg">
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-base font-semibold text-slate-900">
                    {tool.name}
                  </h2>
                  <span className="rounded-full bg-blush px-2 py-0.5 text-[10px] text-slate-700">
                    {tool.badge}
                  </span>
                </div>
                <p className="text-xs leading-relaxed text-slate-600">
                  {tool.description}
                </p>
              </div>
            </Card>
          </Link>
        ))}
      </section>
    </div>
  );
}
