"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { EmojiLoadingStage } from "@/components/mascot/EmojiLoadingStage";
import {
  toolsEntryLoadingSlides,
  TOOLS_ENTRY_AUTOPLAY_MS,
  TOOLS_ENTRY_FADE_MS,
  TOOLS_ENTRY_MIN_DISPLAY_MS
} from "@/components/mascot/tools-entry-loading";

export function ToolsHomeEntryGate({
  children
}: {
  children: ReactNode;
}) {
  const mountedAtRef = useRef<number | null>(null);
  const [isVisible, setIsVisible] = useState(true);
  const [shouldRender, setShouldRender] = useState(true);

  useEffect(() => {
    mountedAtRef.current = performance.now();
  }, []);

  useEffect(() => {
    const mountedAt = mountedAtRef.current ?? performance.now();
    const elapsed = performance.now() - mountedAt;
    const waitBeforeFade = Math.max(0, TOOLS_ENTRY_MIN_DISPLAY_MS - elapsed);
    const fadeTimer = window.setTimeout(() => {
      setIsVisible(false);
    }, waitBeforeFade);
    const removeTimer = window.setTimeout(() => {
      setShouldRender(false);
    }, waitBeforeFade + TOOLS_ENTRY_FADE_MS);

    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(removeTimer);
    };
  }, []);

  return (
    <>
      {children}

      {shouldRender ? (
        <div
          aria-live="polite"
          className={`fixed inset-0 z-50 bg-cream-50 transition-opacity duration-200 ${
            isVisible ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
          }`}
        >
          <EmojiLoadingStage
            slides={toolsEntryLoadingSlides}
            autoPlayMs={TOOLS_ENTRY_AUTOPLAY_MS}
            fullScreen
            showBrand={false}
            className="relative z-10"
          />
        </div>
      ) : null}
    </>
  );
}
