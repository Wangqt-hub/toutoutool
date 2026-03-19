"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { PIXEL_STYLES, type PixelStyle } from "@/lib/bead/pixelStyles";
import { Wand2, Sparkles } from "lucide-react";

interface StyleSelectorProps {
  selectedStyle?: string;
  onStyleSelect?: (styleId: string) => void;
  customPrompt?: string;
  onCustomPromptChange?: (prompt: string) => void;
}

export function StyleSelector({ 
  selectedStyle, 
  onStyleSelect,
  customPrompt,
  onCustomPromptChange 
}: StyleSelectorProps) {
  const [useCustom, setUseCustom] = useState(false);

 return (
    <Card className="space-y-4">
      <div className="space-y-2">
        <label className="text-xs font-medium text-slate-700 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-500" />
          2. 选择像素风格
        </label>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {PIXEL_STYLES.map((style) => (
            <button
              key={style.id}
              type="button"
              onClick={() => {
                setUseCustom(false);
                onStyleSelect?.(style.id);
              }}
             className={`
                p-3 rounded-2xl border-2 transition-all text-left
                ${selectedStyle === style.id && !useCustom
                  ? 'border-purple-500 bg-purple-50 ring-2 ring-purple-200' 
                  : 'border-cream-100 bg-white/70 hover:border-purple-300'}
              `}
            >
              <div className="flex items-center gap-2 mb-2">
                <Wand2 className="w-4 h-4 text-purple-500" />
                <span className="text-xs font-semibold text-slate-900">
                  {style.name}
                </span>
              </div>
              <p className="text-[10px] text-slate-500 line-clamp-2">
                {style.prompt.split(',')[0]}
              </p>
            </button>
          ))}
        </div>

        {/* 自定义提示词 */}
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setUseCustom(!useCustom)}
           className="text-xs text-purple-600 font-medium hover:underline flex items-center gap-1"
          >
            <Sparkles className="w-3 h-3" />
            {useCustom ? '使用预设风格' : '自定义提示词'}
          </button>

          {useCustom && (
            <div className="mt-2 space-y-2">
              <label className="text-xs font-medium text-slate-700">
                自定义 Prompt
              </label>
              <textarea
                value={customPrompt || ''}
                onChange={(e) => onCustomPromptChange?.(e.target.value)}
                placeholder="输入你想要的像素风格描述，例如：pixel art, retro game style, vibrant colors..."
               className="w-full rounded-2xl border border-cream-100 bg-cream-50/60 px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-purple-500 min-h-[80px]"
              />
            </div>
          )}
        </div>

        <p className="text-[11px] text-slate-500">
          💡 AI 会根据选择的风格将你的图片转换为像素艺术效果
        </p>
      </div>
    </Card>
  );
}
