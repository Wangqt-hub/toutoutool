"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { PIXEL_STYLES } from "@/lib/bead/pixelStyles";
import { Wand2, Sparkles } from "lucide-react";

interface StyleSelectorProps {
  selectedStyle?: string;
  onStyleSelect?: (styleId: string) => void;
  customPrompt?: string;
  onCustomPromptChange?: (prompt: string) => void;
  disabled?: boolean;
}

export function StyleSelector({
  selectedStyle,
  onStyleSelect,
  customPrompt,
  onCustomPromptChange,
  disabled = false,
}: StyleSelectorProps) {
  const [useCustom, setUseCustom] = useState(false);

  return (
    <Card className="space-y-4">
      <div className="space-y-2">
        <label className="text-xs font-medium text-slate-700 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-500" />
          2. 选择像素风格
        </label>

        <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-3 sm:gap-3 xl:grid-cols-4">
          {PIXEL_STYLES.map((style) => (
            <button
              key={style.id}
              type="button"
              disabled={disabled}
              onClick={() => {
                setUseCustom(false);
                onStyleSelect?.(style.id);
              }}
              className={`rounded-2xl border-2 p-2.5 text-left transition-all disabled:cursor-not-allowed disabled:opacity-60 sm:p-3 ${
                selectedStyle === style.id && !useCustom
                  ? "border-purple-500 bg-purple-50 ring-2 ring-purple-200"
                  : "border-cream-100 bg-white/70 hover:border-purple-300"
              }`}
            >
              <div className="mb-1.5 flex items-center gap-1.5 sm:mb-2 sm:gap-2">
                <Wand2 className="h-3.5 w-3.5 text-purple-500 sm:h-4 sm:w-4" />
                <span className="text-[11px] font-semibold text-slate-900 sm:text-xs">
                  {style.name}
                </span>
              </div>
              <p className="line-clamp-2 text-[10px] leading-4 text-slate-500 sm:leading-5">
                {style.prompt.split(",")[0]}
              </p>
            </button>
          ))}
        </div>

        <div className="mt-4">
          <button
            type="button"
            disabled={disabled}
            onClick={() => setUseCustom((value) => !value)}
            className="text-xs text-purple-600 font-medium hover:underline flex items-center gap-1 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Sparkles className="w-3 h-3" />
            {useCustom ? "使用预设风格" : "自定义提示词"}
          </button>

          {useCustom && (
            <div className="mt-2 space-y-2">
              <label className="text-xs font-medium text-slate-700">
                自定义 Prompt
              </label>
              <textarea
                value={customPrompt || ""}
                onChange={(event) =>
                  onCustomPromptChange?.(event.target.value)
                }
                disabled={disabled}
                placeholder="输入你想要的像素风格描述，例如：pixel art, retro game style, vibrant colors..."
                className="w-full rounded-2xl border border-cream-100 bg-cream-50/60 px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-purple-500 min-h-[80px] disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>
          )}
        </div>

        <p className="text-[11px] text-slate-500">
          AI 会根据选择的风格把你的图片转换成像素艺术效果。
        </p>
      </div>
    </Card>
  );
}
