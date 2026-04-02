"use client";

import { useState } from "react";
import { Wand2, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { PIXEL_STYLES } from "@/lib/bead/pixelStyles";

interface StyleSelectorProps {
  selectedStyle?: string;
  onStyleSelect?: (styleId: string) => void;
  customPrompt?: string;
  onCustomPromptChange?: (prompt: string) => void;
  disabled?: boolean;
}

const STYLE_LABEL = "2. \u9009\u62e9\u98ce\u683c";
const CUSTOM_PROMPT_TOGGLE = "\u4f7f\u7528\u81ea\u5b9a\u4e49\u63d0\u793a\u8bcd";
const CUSTOM_PROMPT_COLLAPSE = "\u6536\u8d77\u81ea\u5b9a\u4e49\u63d0\u793a\u8bcd";
const CUSTOM_PROMPT_LABEL = "\u81ea\u5b9a\u4e49\u63d0\u793a\u8bcd";
const CUSTOM_PROMPT_PLACEHOLDER =
  "\u5982\u679c\u4f60\u60f3\u8981\u66f4\u5177\u4f53\u7684\u6548\u679c\uff0c\u53ef\u4ee5\u8865\u5145\u63cf\u8ff0\uff0c\u4f8b\u5982\uff1apixel art, cozy retro game style, soft pastel colors";
const STYLE_HINT =
  "\u9ed8\u8ba4\u4f1a\u4f7f\u7528\u4f60\u9009\u4e2d\u7684\u98ce\u683c\u63d0\u793a\u8bcd\uff0c\u4e5f\u53ef\u4ee5\u5207\u6362\u6210\u4f60\u81ea\u5df1\u7684\u63cf\u8ff0\u3002";

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
        <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
          <Sparkles className="h-4 w-4 text-rose-500" />
          {STYLE_LABEL}
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
                  ? "border-rose-400 bg-rose-50 ring-2 ring-rose-100"
                  : "border-cream-100 bg-white/70 hover:border-rose-200"
              }`}
            >
              <div className="mb-1.5 flex items-center gap-1.5 sm:mb-2 sm:gap-2">
                <Wand2 className="h-3.5 w-3.5 text-rose-500 sm:h-4 sm:w-4" />
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
            className="flex items-center gap-1 text-xs font-medium text-rose-600 hover:underline disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Sparkles className="h-3 w-3" />
            {useCustom ? CUSTOM_PROMPT_COLLAPSE : CUSTOM_PROMPT_TOGGLE}
          </button>

          {useCustom ? (
            <div className="mt-2 space-y-2">
              <label className="text-xs font-medium text-slate-700">
                {CUSTOM_PROMPT_LABEL}
              </label>
              <textarea
                value={customPrompt || ""}
                onChange={(event) =>
                  onCustomPromptChange?.(event.target.value)
                }
                disabled={disabled}
                placeholder={CUSTOM_PROMPT_PLACEHOLDER}
                className="min-h-[80px] w-full rounded-2xl border border-cream-100 bg-cream-50/60 px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-rose-400 disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>
          ) : null}
        </div>

        <p className="text-[11px] text-slate-500">{STYLE_HINT}</p>
      </div>
    </Card>
  );
}
