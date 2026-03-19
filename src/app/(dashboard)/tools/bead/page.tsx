"use client";

import { ImportModeSelector } from "@/components/bead-tool/ImportModeSelector";

export default function BeadToolPage() {
  return (
    <div className="space-y-6">
      {/* 头部 */}
      <section className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold text-slate-900">拼豆工具</h1>
        <p className="text-sm text-slate-600">
          选择一种方式开始制作你的拼豆图纸吧！
        </p>
      </section>

      {/* 导入模式选择器 */}
      <ImportModeSelector />

      {/* 使用说明 */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">三种导入模式</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-2xl bg-blue-50 p-4 border border-blue-100">
            <h3 className="text-sm font-semibold text-blue-900 mb-2">📸 图片转像素画</h3>
            <p className="text-xs text-blue-700">
              上传喜欢的图片，调整画布大小和颜色数量，自动生成拼豆图纸。适合有明确参考图的情况。
            </p>
          </div>
          
          <div className="rounded-2xl bg-purple-50 p-4 border border-purple-100">
            <h3 className="text-sm font-semibold text-purple-900 mb-2">✨ AI 生成像素画</h3>
            <p className="text-xs text-purple-700">
              使用 AI 将图片转换为独特的像素艺术风格，再制作成拼豆图纸。支持 8 种预设风格和自定义提示词。
            </p>
          </div>
          
          <div className="rounded-2xl bg-green-50 p-4 border border-green-100">
            <h3 className="text-sm font-semibold text-green-900 mb-2">📐 拼豆图纸导入</h3>
            <p className="text-xs text-green-700">
              导入已有的拼豆图纸（图片或纸质），通过网格校准和颜色识别，还原成电子图纸。
            </p>
          </div>
        </div>
      </section>

      {/* 温馨提示 */}
      <section className="rounded-3xl bg-gradient-to-br from-cream-50 to-white border border-cream-100 p-4 space-y-2">
        <h3 className="text-sm font-semibold text-slate-900">💡 新手指南</h3>
        <ul className="space-y-1.5 text-xs text-slate-600">
          <li className="flex items-start gap-2">
            <span className="text-accent-brown mt-0.5">▸</span>
            <span><strong>第一次玩？</strong>推荐从「图片转像素画」开始，使用清晰的方形图片效果最佳</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-accent-brown mt-0.5">▸</span>
            <span><strong>想要特别的效果？</strong>试试「AI 生成」，可以创造独特的像素艺术风格</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-accent-brown mt-0.5">▸</span>
            <span><strong>有现成的图纸？</strong>使用「图纸导入」功能，可以快速还原已有设计</span>
          </li>
        </ul>
      </section>
    </div>
  );
}
