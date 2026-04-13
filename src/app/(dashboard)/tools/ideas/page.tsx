"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CapybaraHero } from "@/components/mascot/CapybaraHero";
import { motion } from "framer-motion";
import { Send, MailOpen, HeartHandshake } from "lucide-react";
async function readApiResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as {
    success: boolean;
    data?: T;
    error?: string;
  };

  if (!response.ok || !payload.success) {
    throw new Error(payload.error || "请求失败。");
  }

  return payload.data as T;
}

export default function IdeaBoxPage() {
  const [content, setContent] = useState("");
  const [contact, setContact] = useState("");
  const [allowContact, setAllowContact] = useState(true);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    if (!content.trim()) {
      setError("先简单写一下你想要的小工具吧。");
      return;
    }

    setLoading(true);

    try {
      await readApiResponse(
        await fetch("/api/idea-box", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            content: content.trim(),
            contact: contact.trim() || null,
            allow_contact: allowContact,
          }),
        })
      );

      setContent("");
      setContact("");
      setAllowContact(true);
      setMessage("已经收到这条点子，后续我们会认真评估。");
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "提交时出错，请稍后再试。"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-[calc(100vh-8rem)] w-full max-w-4xl max-w-5xl overflow-hidden px-2 sm:px-6 md:min-h-[calc(100vh-10rem)] py-4">
      {/* 沉浸式信纸背景修饰 */}
      <div className="absolute inset-x-0 -top-40 -z-10 h-80 rounded-full bg-accent-yellow/30 blur-3xl" />
      <div className="absolute -left-20 top-20 -z-10 h-64 w-64 rounded-full bg-blush/40 blur-3xl md:left-20" />

      <section className="relative z-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between px-2">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-orange-200/50 bg-orange-50/80 px-3 py-1.5 text-xs font-bold tracking-widest text-orange-600 shadow-sm backdrop-blur-md">
            <MailOpen className="h-3.5 w-3.5" />
            IDEA BOX
          </div>
          <h1 className="text-3xl font-black tracking-tight text-slate-800 md:text-4xl">奇思妙想箱</h1>
          <p className="max-w-md text-sm leading-relaxed text-slate-600">
            想要什么工具、小能力，都可以先记在这里。我们会按价值和实现成本整理优先级。
          </p>
        </div>

        <motion.div 
          animate={{ y: [0, -8, 0], rotate: [0, 2, -1, 0] }} 
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          className="hidden md:block h-32 w-32"
        >
          <CapybaraHero variant="hero" size="lg" className="drop-shadow-xl h-full w-full object-contain" />
        </motion.div>
      </section>

      <div className="relative z-10 mt-8 grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* 信纸表单区 */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="lg:col-span-8"
        >
          <div className="relative overflow-hidden rounded-[2.5rem] border-4 border-white bg-[#FFFDF8] p-1 shadow-cute sm:p-2">
            {/* 信封边缘条纹效果 */}
            <div className="absolute left-0 top-0 h-2 w-full bg-[repeating-linear-gradient(45deg,#E04F5F,#E04F5F_10px,transparent_10px,transparent_20px,#3B82F6_20px,#3B82F6_30px,transparent_30px,transparent_40px)] opacity-60" />
            
            <form onSubmit={handleSubmit} className="relative mt-2 rounded-[2rem] bg-orange-50/30 p-5 sm:p-8">
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-black text-slate-800 flex items-center gap-2">
                    写下你的愿望清单 ✏️
                  </label>
                  <textarea
                    value={content}
                    onChange={(event) => setContent(event.target.value)}
                    rows={6}
                    placeholder="可以写清楚想解决什么问题、希望怎么用，像给朋友发消息一样描述就行~"
                    className="w-full resize-none rounded-[1.5rem] border-2 border-orange-100 bg-white/70 px-5 py-4 text-sm leading-relaxed text-slate-700 shadow-inner outline-none transition-colors focus:border-orange-300 focus:bg-white"
                  />
                </div>

                <div className="rounded-[1.5rem] border border-orange-100/50 bg-white/50 p-5 shadow-sm">
                  <h3 className="mb-4 text-xs font-bold uppercase tracking-widest text-slate-400">Return Address (选填)</h3>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-slate-600">怎么联系你</label>
                      <input
                        type="text"
                        value={contact}
                        onChange={(event) => setContact(event.target.value)}
                        placeholder="邮箱 / 微信 / Discord..."
                        className="w-full rounded-2xl border border-orange-100 bg-white px-4 py-2.5 text-sm outline-none transition-colors focus:border-orange-300"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-slate-600">沟通意愿</label>
                      <button
                        type="button"
                        onClick={() => setAllowContact((previous) => !previous)}
                        className={`flex w-full items-center justify-between rounded-2xl border px-4 py-2.5 text-xs transition-colors ${
                          allowContact
                            ? "border-orange-400 bg-orange-500 text-white font-bold shadow-md"
                            : "border-orange-100 bg-white text-slate-500 hover:bg-orange-50"
                        }`}
                      >
                        {allowContact ? "愿意详细聊聊 💬" : "暂时不必打扰 🤫"}
                        <span className={`h-4 w-4 rounded-full border-2 ${allowContact ? "border-white bg-white/20" : "border-slate-300 bg-transparent"}`} />
                      </button>
                    </div>
                  </div>
                </div>

                <motion.div layout>
                  {error && (
                    <motion.p initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-600 shadow-inner">
                      {error}
                    </motion.p>
                  )}
                  {message && (
                    <motion.p initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-600 shadow-inner">
                      {message}
                    </motion.p>
                  )}
                </motion.div>

                <div className="flex justify-end pt-2">
                  <motion.div whileHover={{ scale: 1.05, rotate: -2 }} whileTap={{ scale: 0.95 }}>
                    <Button
                      type="submit"
                      size="lg"
                      className="h-14 rounded-full bg-slate-900 px-8 text-base font-bold text-white shadow-xl hover:bg-slate-800"
                      disabled={loading}
                    >
                      {loading ? "正在投递..." : "投递到信箱"}
                      <Send className="ml-2 h-4 w-4" />
                    </Button>
                  </motion.div>
                </div>
              </div>
            </form>
          </div>
        </motion.div>

        {/* 侧边小贴士区 */}
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="lg:col-span-4"
        >
          <div className="sticky top-6 relative overflow-hidden rounded-[2.5rem] bg-gradient-to-b from-sky-50 to-white px-6 py-8 shadow-sm">
            <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-sky-100/50 blur-2xl" />
            
            <div className="relative z-10 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white shadow-sm">
                <HeartHandshake className="h-5 w-5 text-sky-500" />
              </div>
              <h2 className="text-lg font-black text-slate-800">头头的小承诺</h2>
            </div>
            
            <ul className="mt-6 flex flex-col gap-4 text-sm font-medium text-slate-600">
              <li className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-100 text-[10px] text-sky-600">1</span>
                每一条想法都会被认真阅读，不会丢进黑箱。
              </li>
              <li className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-100 text-[10px] text-sky-600">2</span>
                相似需求会汇总整理，优先做共性价值更高的功能。
              </li>
              <li className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-100 text-[10px] text-sky-600">3</span>
                联系方式只用于产品改进相关的真诚沟通，绝不推送营销信息。
              </li>
            </ul>

            <div className="mt-8 flex justify-center md:hidden">
               <CapybaraHero variant="figure" size="sm" />
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
