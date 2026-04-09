"use client";

import type { ReactNode } from "react";
import {
  EmojiLoadingCarousel,
  type EmojiLoadingCarouselRenderContext
} from "@/components/mascot/EmojiLoadingCarousel";
import { loadingStoryPresets } from "@/lib/loading-story-presets";

const previewSlides = loadingStoryPresets.general.slides;

function FrostPanel({
  className,
  children
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={[
        "rounded-[1.6rem] border border-white/45 bg-white/28 shadow-[0_22px_60px_rgba(82,45,19,0.08)] backdrop-blur-[10px]",
        className ?? ""
      ].join(" ")}
    >
      {children}
    </div>
  );
}

function renderLoadingLayout({
  activeIndex,
  slideCount,
  activeSlide,
  slides,
  center,
  chrome
}: EmojiLoadingCarouselRenderContext) {
  const progress = `${((activeIndex + 1) / slideCount) * 100}%`;

  return (
    <div className="relative z-10 flex min-h-screen w-full flex-col px-4 py-4 md:px-8 md:py-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-[34rem]">
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-[#8a6044]/70">
            Flexible Loading Layout
          </p>
          <h1 className="mt-3 max-w-[12ch] text-[clamp(2.3rem,5vw,4.6rem)] font-semibold leading-[0.92] tracking-[-0.06em] text-[#4d2a12]">
            中间动画固定，外围控件自由接入
          </h1>
          <p className="mt-4 max-w-[34rem] text-sm leading-7 text-[#6f4a31]/78 md:text-[15px]">
            `EmojiLoadingCarousel` 现在把圆环和表情动画保留在中心，其余信息区、状态区、按钮区、进度区都可以按页面需求自己拼接。
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 lg:justify-end">
          <FrostPanel className="px-4 py-3">
            <div className="flex items-center gap-3 text-[#5b3419]">
              <span
                className="inline-flex h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: activeSlide.accent }}
              />
              <div>
                <p className="text-[0.68rem] uppercase tracking-[0.2em] text-[#8b6348]/72">
                  Active Scene
                </p>
                <p className="text-sm font-medium">{activeSlide.eyebrow}</p>
              </div>
            </div>
          </FrostPanel>

          <FrostPanel className="px-4 py-3">
            <div className="text-[#5b3419]">
              <p className="text-[0.68rem] uppercase tracking-[0.2em] text-[#8b6348]/72">
                Loop Index
              </p>
              <div className="mt-1 flex items-center gap-3">
                <p className="text-lg font-semibold tracking-[-0.05em]">
                  {String(activeIndex + 1).padStart(2, "0")}
                </p>
                <div className="h-5 w-px bg-[#c6ad98]/65" />
                <p className="text-sm text-[#7f5a41]/76">{slideCount} scenes</p>
              </div>
            </div>
          </FrostPanel>

          {chrome ? <div className="hidden md:block">{chrome}</div> : null}
        </div>
      </header>

      <div className="grid flex-1 items-center gap-5 py-6 lg:grid-cols-[minmax(230px,0.88fr)_minmax(0,1.2fr)_minmax(250px,0.96fr)]">
        <aside className="hidden lg:flex lg:flex-col lg:gap-4">
          <FrostPanel className="p-5">
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-[#8b6348]/72">
              Scene Map
            </p>
            <div className="mt-4 grid gap-2.5">
              {slides.map((slide, index) => {
                const isActive = index === activeIndex;

                return (
                  <div
                    key={slide.id}
                    className={[
                      "rounded-2xl border px-3 py-3 transition-colors",
                      isActive
                        ? "border-[#7b5031]/25 bg-white/74"
                        : "border-white/35 bg-white/32"
                    ].join(" ")}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[0.64rem] uppercase tracking-[0.18em] text-[#8c6548]/70">
                          {slide.tag}
                        </p>
                        <p className="mt-1 text-sm font-medium text-[#55311a]">
                          {slide.eyebrow}
                        </p>
                      </div>
                      <span
                        className="inline-flex h-2.5 w-2.5 rounded-full"
                        style={{
                          backgroundColor: isActive ? slide.accent : "rgba(123, 80, 49, 0.18)"
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </FrostPanel>

          <FrostPanel className="p-5">
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-[#8b6348]/72">
              Suggested Slots
            </p>
            <div className="mt-4 flex flex-wrap gap-2.5">
              {["top badge", "counter", "status card", "hint row", "actions"].map((item) => (
                <span
                  key={item}
                  className="rounded-full border border-white/50 bg-white/60 px-3 py-1.5 text-xs uppercase tracking-[0.14em] text-[#6c4630]/75"
                >
                  {item}
                </span>
              ))}
            </div>
          </FrostPanel>
        </aside>

        <div className="flex items-center justify-center py-2 lg:py-0">
          {center}
        </div>

        <aside className="flex flex-col gap-4">
          <FrostPanel className="p-5 md:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-[#8b6348]/72">
                  Live Copy
                </p>
                <h2 className="mt-3 max-w-[14ch] text-[clamp(1.7rem,3vw,2.6rem)] font-semibold leading-[1.02] tracking-[-0.05em] text-[#4d2a12]">
                  {activeSlide.headline}
                </h2>
              </div>
              <span
                className="h-12 w-12 rounded-full border border-white/60"
                style={{
                  background:
                    `radial-gradient(circle, ${activeSlide.accent} 0%, rgba(255,255,255,0.86) 68%)`
                }}
              />
            </div>

            <div className="mt-5 flex flex-wrap gap-2.5">
              <span className="rounded-full bg-[#4d2a12] px-3 py-1.5 text-xs font-medium uppercase tracking-[0.16em] text-white">
                {activeSlide.tag}
              </span>
              <span className="rounded-full border border-[#b98f72]/35 bg-white/65 px-3 py-1.5 text-xs uppercase tracking-[0.14em] text-[#6c4630]/76">
                {activeSlide.status}
              </span>
            </div>

            <p className="mt-5 max-w-[34ch] text-sm leading-7 text-[#6f4a31]/78">
              {activeSlide.body}
            </p>
          </FrostPanel>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            <FrostPanel className="p-5">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-[#8b6348]/72">
                Accent
              </p>
              <div className="mt-4 flex items-center gap-3">
                <span
                  className="h-10 w-10 rounded-2xl border border-white/60"
                  style={{ backgroundColor: activeSlide.accent }}
                />
                <div>
                  <p className="text-sm font-medium text-[#55311a]">Scene tone</p>
                  <p className="text-xs text-[#7f5a41]/76">{activeSlide.accent}</p>
                </div>
              </div>
            </FrostPanel>

            <FrostPanel className="p-5">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-[#8b6348]/72">
                Motion
              </p>
              <p className="mt-4 text-sm leading-6 text-[#6f4a31]/78">
                分层显现后整体擦除，外围信息卡保持稳定，只替换内容。
              </p>
            </FrostPanel>
          </div>
        </aside>
      </div>

      <footer className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <FrostPanel className="w-full max-w-[34rem] p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-[#8b6348]/72">
                Cycle Progress
              </p>
              <p className="mt-1 text-sm text-[#6f4a31]/78">
                这里也可以接入真实加载步骤、接口状态或阶段说明。
              </p>
            </div>
            <p className="text-sm font-medium text-[#55311a]">
              {String(activeIndex + 1).padStart(2, "0")} / {String(slideCount).padStart(2, "0")}
            </p>
          </div>

          <div className="mt-4 h-2 rounded-full bg-white/55">
            <div
              className="h-full rounded-full transition-[width,background-color] duration-500"
              style={{
                width: progress,
                backgroundColor: activeSlide.accent
              }}
            />
          </div>
        </FrostPanel>

        <div className="flex flex-wrap gap-3">
          {["Skip", "Mute Copy", "Compact Mode", "Swap Controls"].map((label) => (
            <button
              key={label}
              type="button"
              className="rounded-full border border-white/50 bg-white/38 px-4 py-2 text-xs font-medium uppercase tracking-[0.15em] text-[#5f3920] backdrop-blur-[8px] transition hover:bg-white/58"
            >
              {label}
            </button>
          ))}
        </div>
      </footer>
    </div>
  );
}

export default function LoadingLabPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#f5ede5]">
      <h1 className="sr-only">Flexible loading layout preview</h1>

      <div
        aria-hidden="true"
        className="absolute inset-0 overflow-hidden"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.98),_rgba(248,240,231,0.82)_34%,_rgba(239,225,209,0.92)_100%)]" />
        <div className="absolute left-[-8%] top-[-8%] h-[28rem] w-[28rem] rounded-full bg-[rgba(255,255,255,0.46)] blur-3xl" />
        <div className="absolute right-[-10%] top-[12%] h-[24rem] w-[24rem] rounded-full bg-[rgba(247,210,187,0.34)] blur-3xl" />
        <div className="absolute bottom-[-12%] left-[18%] h-[22rem] w-[22rem] rounded-full bg-[rgba(228,184,148,0.2)] blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,250,245,0.22),rgba(248,235,222,0.54))] backdrop-blur-[2px]" />
      </div>

      <EmojiLoadingCarousel
        slides={previewSlides}
        autoPlayMs={4600}
        fullScreen
        showChrome
        showText
        className="relative z-10"
        renderLayout={renderLoadingLayout}
      />
    </main>
  );
}
