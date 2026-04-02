"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CapybaraHero } from "@/components/mascot/CapybaraHero";

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
    <div className="space-y-6">
      <section className="flex flex-col gap-4 md:flex-row md:items-center">
        <div className="flex-1 space-y-2">
          <h1 className="text-2xl font-bold text-slate-900">奇思妙想箱</h1>
          <p className="text-sm text-slate-600">
            想要什么工具、功能或者小能力，都可以先记在这里。我们会按价值和实现成本整理优先级。
          </p>
        </div>

        <div className="flex items-start gap-3 sm:items-center">
          <CapybaraHero variant="figure" size="sm" />
          <p className="max-w-[160px] text-[11px] text-slate-500">
            头头会定期翻看这个箱子，把值得做的想法慢慢变成真的工具。
          </p>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 items-start lg:grid-cols-3">
        <Card className="space-y-4 lg:col-span-2">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700">
                你想要什么样的小工具？（必填）
              </label>
              <textarea
                value={content}
                onChange={(event) => setContent(event.target.value)}
                rows={5}
                placeholder="可以写清楚它想解决什么问题、希望怎么用，像给朋友发消息一样描述就行。"
                className="w-full resize-none rounded-2xl border border-cream-100 bg-cream-50/60 px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-accent-brown"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700">
                  联系方式（选填）
                </label>
                <input
                  type="text"
                  value={contact}
                  onChange={(event) => setContact(event.target.value)}
                  placeholder="邮箱 / 微信 / Discord / 其他方便联系的方式"
                  className="w-full rounded-2xl border border-cream-100 bg-cream-50/60 px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-accent-brown"
                />
                <p className="text-[11px] text-slate-500">
                  只在需要进一步了解需求或邀请试用时联系你。
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-700">
                  是否同意被联系
                </label>
                <button
                  type="button"
                  onClick={() => setAllowContact((previous) => !previous)}
                  className={`inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-xs transition-colors ${
                    allowContact
                      ? "border-accent-brown bg-accent-brown text-cream-50"
                      : "border-cream-100 bg-cream-50/60 text-slate-700 hover:bg-cream-100"
                  }`}
                >
                  <span
                    className={`h-3 w-3 rounded-full border ${
                      allowContact ? "bg-cream-50" : "bg-transparent"
                    }`}
                  />
                  {allowContact
                    ? "同意，必要时可以联系我"
                    : "暂时不希望被联系"}
                </button>
              </div>
            </div>

            {error ? (
              <p className="rounded-2xl bg-red-50 px-3 py-2 text-xs text-red-500">
                {error}
              </p>
            ) : null}

            {message ? (
              <p className="rounded-2xl bg-green-50 px-3 py-2 text-xs text-green-600">
                {message}
              </p>
            ) : null}

            <Button
              type="submit"
              size="lg"
              className="mt-2 w-full"
              disabled={loading}
            >
              {loading ? "提交中..." : "提交到奇思妙想箱"}
            </Button>
          </form>
        </Card>

        <Card className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-900">头头的小承诺</h2>
          <ul className="space-y-2 text-[11px] text-slate-600">
            <li>· 每一条想法都会被认真阅读，不会直接被丢进黑箱。</li>
            <li>· 相似需求会汇总整理，优先做共性价值更高的功能。</li>
            <li>· 联系方式只用于产品改进相关沟通，不用于营销推送。</li>
            <li>· 现在想法还不完整也没关系，后面随时可以再补充。</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
