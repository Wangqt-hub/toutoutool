"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { CapybaraHero } from "@/components/mascot/CapybaraHero";

export default function IdeaBoxPage() {
  const [content, setContent] = useState("");
  const [contact, setContact] = useState("");
  const [allowContact, setAllowContact] = useState(true);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);

    if (!content.trim()) {
      setError("先简单写一写你想要的工具吧。");
      return;
    }

    setLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { user }
      } = await supabase.auth.getUser();

      if (!user) {
        setError("登录状态已失效，请重新登录后再提交。");
        setLoading(false);
        return;
      }

      const { error: insertError } = await supabase.from("idea_box").insert({
        user_id: user.id,
        content: content.trim(),
        contact: contact.trim() || null,
        allow_contact: allowContact
      });

      if (insertError) {
        setError(insertError.message);
        setLoading(false);
        return;
      }

      setContent("");
      setContact("");
      setAllowContact(true);
      setMessage("已悄悄塞进奇思妙想箱，头头会认真看的！");
    } catch {
      setError("提交时出错，请稍后再试。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-col md:flex-row md:items-center gap-4">
        <div className="flex-1 space-y-2">
          <h1 className="text-2xl font-bold text-slate-900">奇思妙想箱</h1>
          <p className="text-sm text-slate-600">
            有什么想实现的小工具、功能或者脑洞，都可以写在这里。也许下一个上线的，就是你的点子。
          </p>
        </div>
        <div className="flex items-center gap-3">
          <CapybaraHero variant="figure" size="sm" />
          <p className="text-[11px] text-slate-500 max-w-[160px]">
            头头会定期翻看这个箱子，挑选适合的灵感慢慢做出来。
          </p>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        <Card className="lg:col-span-2 space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700">
                你想要什么样的小工具？（必填）
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={5}
                placeholder="可以简单描述你希望它解决什么问题、长什么样、怎么用… 不用写得很正式，当做给朋友发消息就好。"
                className="w-full resize-none rounded-2xl border border-cream-100 bg-cream-50/60 px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-accent-brown"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700">
                  联系方式（选填）
                </label>
                <input
                  type="text"
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  placeholder="邮箱 / 微信 / Discord / 其他方便的方式"
                  className="w-full rounded-2xl border border-cream-100 bg-cream-50/60 px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-accent-brown"
                />
                <p className="text-[11px] text-slate-500">
                  仅在需要进一步了解需求或征求试用反馈时才会联系你。
                </p>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-700">
                  是否同意被联系
                </label>
                <button
                  type="button"
                  onClick={() => setAllowContact((prev) => !prev)}
                  className={`inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-xs transition-colors ${
                    allowContact
                      ? "bg-accent-brown text-cream-50 border-accent-brown"
                      : "bg-cream-50/60 text-slate-700 border-cream-100 hover:bg-cream-100"
                  }`}
                >
                  <span
                    className={`h-3 w-3 rounded-full border ${
                      allowContact ? "bg-cream-50" : "bg-transparent"
                    }`}
                  />
                  {allowContact ? "同意，如有需要可以联系我" : "暂时不希望被联系"}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-xs text-red-500 bg-red-50 rounded-2xl px-3 py-2">
                {error}
              </p>
            )}
            {message && (
              <p className="text-xs text-green-600 bg-green-50 rounded-2xl px-3 py-2">
                {message}
              </p>
            )}

            <Button
              type="submit"
              size="lg"
              className="w-full mt-2"
              disabled={loading}
            >
              {loading ? "投递中…" : "投递到奇思妙想箱"}
            </Button>
          </form>
        </Card>

        <Card className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-900">
            头头的小小承诺
          </h2>
          <ul className="space-y-2 text-[11px] text-slate-600">
            <li>
              · 每一条想法都会被认真阅读，不会被机器直接过滤掉。
            </li>
            <li>
              ·
              如果有多个用户提出类似需求，会优先考虑做成正式功能，并在产品更新说明里致谢。
            </li>
            <li>
              · 你写下的内容只会用于改进头头工具，不会对外公开或用作广告推送。
            </li>
            <li>· 现在不想写太多也没关系，想到再回来补充就好。</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}

