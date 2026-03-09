"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type SubscriptionTier = "free" | "premium";

type ProfileRow = {
  subscription_tier: SubscriptionTier | null;
};

export function MembershipPreviewButton() {
  const [open, setOpen] = useState(false);
  const [tier, setTier] = useState<SubscriptionTier>("free");

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();

    async function loadProfile() {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("subscription_tier")
          .maybeSingle();

        if (!error && data) {
          const row = data as ProfileRow;
          if (row.subscription_tier === "premium") {
            setTier("premium");
          }
        }
      } catch {
        // 如果表或字段暂未创建，忽略错误，默认 free
      }
    }

    loadProfile();
  }, []);

  return (
    <div className="relative">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="hidden md:inline-flex"
        onClick={() => setOpen((prev) => !prev)}
      >
        {tier === "premium" ? "预览会员 · 已解锁" : "会员预留"}
      </Button>
      {open && (
        <div className="absolute right-0 mt-2 w-64 rounded-3xl border border-cream-100 bg-white/95 shadow-[0_12px_40px_rgba(0,0,0,0.12)] p-3 text-[11px] text-slate-700 z-20">
          <p className="font-semibold mb-1">会员功能预告</p>
          <ul className="space-y-1 mb-2 text-slate-600">
            <li>· 更大的拼豆图纸尺寸与完整色卡支持。</li>
            <li>· 更聪明的 AI 旅行路线优化与备选方案。</li>
            <li>· 优先体验新工具、提前内测资格。</li>
          </ul>
          <p className="text-[10px] text-slate-500">
            目前还在设计阶段，等功能准备好后，会在这里第一时间告诉你。{" "}
            {tier === "premium"
              ? "感谢你提前支持头头工具！"
              : "现在所有基础功能对你都是免费的。"}
          </p>
        </div>
      )}
    </div>
  );
}

