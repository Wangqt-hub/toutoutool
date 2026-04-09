"use client";

import { useEffect, useState } from "react";
import { EmojiLoadingCarousel } from "@/components/mascot/EmojiLoadingCarousel";
import type { LoadingStorySlide } from "@/lib/loading-story-presets";

interface EmojiLoadingStatusItem {
  label: string;
  value: string;
  done?: boolean;
}

interface EmojiLoadingStageProps {
  slides: LoadingStorySlide[];
  title?: string;
  detail?: string;
  eyebrow?: string;
  statusItems?: EmojiLoadingStatusItem[];
  progressRatio?: number;
  fullScreen?: boolean;
  autoPlayMs?: number;
  showBrand?: boolean;
  className?: string;
}

function getStatusTone(done: boolean) {
  return done
    ? "border-[rgba(110,49,16,0.12)] bg-white/80 text-[#4d2a12]"
    : "border-white/55 bg-white/42 text-[#6d4630]";
}

export function EmojiLoadingStage({
  slides,
  title,
  detail,
  eyebrow,
  statusItems = [],
  progressRatio,
  fullScreen = false,
  autoPlayMs = 4200,
  showBrand = true,
  className
}: EmojiLoadingStageProps) {
  const [animatedProgress, setAnimatedProgress] = useState(0.14);
  const completedCount = statusItems.filter((item) => item.done).length;
  const derivedProgress =
    statusItems.length > 0 ? completedCount / statusItems.length : 0.18;

  useEffect(() => {
    if (progressRatio !== undefined || statusItems.length > 0) {
      return undefined;
    }

    const startedAt = performance.now();
    const timer = window.setInterval(() => {
      const elapsed = performance.now() - startedAt;
      const base = 0.14 + (1 - Math.exp(-elapsed / 1400)) * 0.56;
      const pulse = ((Math.sin(elapsed / 420) + 1) / 2) * 0.045;

      setAnimatedProgress(Math.min(base + pulse, 0.86));
    }, 120);

    return () => {
      window.clearInterval(timer);
    };
  }, [progressRatio, statusItems.length]);

  const progress = Math.max(
    progressRatio ??
      (statusItems.length > 0 ? derivedProgress : animatedProgress),
    0.08
  );

  return (
    <EmojiLoadingCarousel
      slides={slides}
      autoPlayMs={autoPlayMs}
      fullScreen={fullScreen}
      showChrome={false}
      showText={false}
      className={className}
      renderLayout={({ center, activeSlide }) => {
        const displayEyebrow = eyebrow ?? activeSlide.status;
        const displayTitle = title ?? activeSlide.headline;
        const displayDetail = detail ?? activeSlide.body;

        return (
          <div
            className={
              fullScreen
                ? "flex min-h-screen flex-col items-center justify-center px-5 py-8"
                : "flex min-h-[68vh] flex-col items-center justify-center px-4 py-8"
            }
          >
            {showBrand ? (
              <div className="inline-flex items-center rounded-full border border-white/60 bg-white/66 px-4 py-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.24em] text-[#7d563b] shadow-[0_10px_24px_rgba(92,53,24,0.06)]">
                toutoutool
              </div>
            ) : null}

            <div className={showBrand ? "mt-6" : ""}>{center}</div>

            <div className="mt-7 w-full max-w-[34rem] text-center">
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-[#8a6044]/68">
                {displayEyebrow}
              </p>
              <h2 className="mt-3 text-[clamp(1.9rem,4vw,3rem)] font-semibold tracking-[-0.05em] text-[#4d2a12] transition-opacity duration-300">
                {displayTitle}
              </h2>
              <p className="mx-auto mt-3 max-w-[28rem] text-sm leading-7 text-[#6f4a31]/78 transition-opacity duration-300">
                {displayDetail}
              </p>

              <div className="mx-auto mt-5 h-1.5 w-full max-w-[18rem] overflow-hidden rounded-full bg-white/70">
                <div
                  className="h-full rounded-full transition-[width,background-color] duration-300"
                  style={{
                    width: `${progress * 100}%`,
                    backgroundColor: activeSlide.accent
                  }}
                />
              </div>

              {statusItems.length > 0 ? (
                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  {statusItems.map((item) => (
                    <div
                      key={item.label}
                      className={`rounded-[1.25rem] border px-4 py-3 text-left shadow-[0_16px_34px_rgba(92,53,24,0.05)] ${getStatusTone(
                        Boolean(item.done)
                      )}`}
                    >
                      <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-[#8a6044]/70">
                        {item.label}
                      </p>
                      <p className="mt-2 text-sm font-medium">{item.value}</p>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        );
      }}
    />
  );
}
