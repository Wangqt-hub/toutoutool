"use client";

import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Image, Wand2, FileImage } from "lucide-react";

export type ImportMode = 'image' | 'ai' | 'pattern';

const MODES = [
  {
   id: 'image',
    title: '图片转像素画',
    description: '上传喜欢的图片，调整参数后自动生成拼豆图纸',
    icon: Image,
   color: 'bg-blue-50 text-blue-600',
    features: ['支持 JPG/PNG/WebP', '自定义画布尺寸', '智能颜色匹配']
  },
  {
   id: 'ai',
    title: 'AI 生成像素画',
    description: '使用 AI 将图片转换为像素风格，再制作成拼豆图纸',
    icon: Wand2,
   color: 'bg-purple-50 text-purple-600',
    features: ['多种像素风格', 'AI 智能转换', '高质量输出']
  },
  {
   id: 'pattern',
    title: '拼豆图纸导入',
    description: '导入已有的拼豆图纸，自动识别网格和颜色',
    icon: FileImage,
   color: 'bg-green-50 text-green-600',
    features: ['手动网格校准', '智能颜色识别', '支持色号 OCR']
  }
];

interface ImportModeSelectorProps {
  onModeSelect?: (mode: ImportMode) => void;
}

export function ImportModeSelector({ onModeSelect }: ImportModeSelectorProps) {
  const router = useRouter();

  const handleSelect = (modeId: ImportMode) => {
    if (onModeSelect) {
      onModeSelect(modeId);
    } else {
      // 导航到三个独立的导入模式页面
      const routes: Record<ImportMode, string> = {
        image: '/tools/bead/import-image',  // 图片上传独立页面
        ai: '/tools/bead/import-ai',        // AI 生成独立页面
        pattern: '/tools/bead/import-pattern'  // 图纸导入独立页面
      };
      router.push(routes[modeId] as any);
    }
  };

 return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {MODES.map((mode) => {
        const Icon = mode.icon;
         
         return (
           <Card
             key={mode.id}
            className="flex flex-col p-4 hover:shadow-lg transition-shadow cursor-pointer border-2 hover:border-accent-brown/30"
             onClick={() => handleSelect(mode.id as ImportMode)}
           >
            <div className={`w-12 h-12 rounded-2xl ${mode.color} flex items-center justify-center mb-3`}>
              <Icon className="w-6 h-6" />
            </div>
            
            <h3 className="text-base font-semibold text-slate-900 mb-1">
               {mode.title}
             </h3>
             
            <p className="text-xs text-slate-600 mb-3 flex-grow">
               {mode.description}
             </p>
             
            <ul className="space-y-1 mb-4">
               {mode.features.map((feature, idx) => (
                <li key={idx} className="text-[11px] text-slate-500 flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-accent-brown" />
                   {feature}
                 </li>
               ))}
             </ul>
             
            <Button
               type="button"
               size="sm"
              className="w-full mt-auto"
             >
               开始使用
             </Button>
           </Card>
         );
       })}
      </div>

      {/* 使用说明 */}
      <Card className="p-4 bg-gradient-to-br from-cream-50 to-white">
        <h3 className="text-sm font-semibold text-slate-900 mb-2">
          💡 使用提示
        </h3>
        <ul className="space-y-1.5 text-xs text-slate-600">
          <li className="flex items-start gap-2">
            <span className="text-accent-brown mt-0.5">▸</span>
            <span><strong>图片转像素画</strong>适合有明确参考图的情况，建议使用清晰的方形图片</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-accent-brown mt-0.5">▸</span>
            <span><strong>AI 生成</strong>可以创造独特的像素艺术风格，适合想要特别效果的你</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-accent-brown mt-0.5">▸</span>
            <span><strong>图纸导入</strong>可以还原纸质图纸或他人分享的电子图纸</span>
          </li>
        </ul>
      </Card>
    </div>
  );
}
