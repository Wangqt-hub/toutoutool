"use client";

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode
} from "react";
import { clsx } from "clsx";
import styles from "./EmojiLoadingCarousel.module.css";
import type { LoadingStorySlide } from "@/lib/loading-story-presets";
import {
  emojiHeadLayerOrder,
  emojiHeadLayers,
  type EmojiHeadLayerKey
} from "@/lib/emoji-heads-svg";

export interface EmojiLoadingCarouselSlide extends LoadingStorySlide {
  imageKey: EmojiHeadLayerKey;
}

export interface EmojiLoadingCarouselRenderContext {
  activeIndex: number;
  slideCount: number;
  activeSlide: EmojiLoadingCarouselSlide;
  slides: EmojiLoadingCarouselSlide[];
  center: ReactNode;
  chrome: ReactNode | null;
  defaultPanel: ReactNode | null;
}

interface EmojiLoadingCarouselProps {
  slides: LoadingStorySlide[];
  autoPlayMs?: number;
  className?: string;
  fullScreen?: boolean;
  showChrome?: boolean;
  showText?: boolean;
  renderLayout?: (context: EmojiLoadingCarouselRenderContext) => ReactNode;
}

const DEFAULT_AUTOPLAY_MS = 4200;
const emojiVisualSequence = Object.keys(emojiHeadLayers)
  .sort((left, right) => left.localeCompare(right, "en", { numeric: true }))
  .filter((key): key is EmojiHeadLayerKey => key in emojiHeadLayers);
const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

const fallbackSlides: LoadingStorySlide[] = [
  {
    id: "fallback",
    eyebrow: "Fallback",
    tag: "Loading",
    status: "Preparing preview",
    headline: "Loading template is getting ready",
    body: "Fallback content only appears when no slides are provided.",
    image: "/loading-lab/emoji-heads-svg/emoji_01.svg",
    alt: "smiling emoji head",
    accent: "#F6D9A9",
    accentSoft: "#FFF7E3",
    glow: "rgba(239, 189, 88, 0.24)"
  }
];

function resolveSlideVectorKey(source: string): EmojiHeadLayerKey {
  const match = source.match(/(emoji_\d+)/i);
  const key = match?.[1] as EmojiHeadLayerKey | undefined;

  if (key && key in emojiHeadLayers) {
    return key;
  }

  return "emoji_01";
}

export function EmojiLoadingCarousel({
  slides,
  autoPlayMs = DEFAULT_AUTOPLAY_MS,
  className,
  fullScreen = false,
  showChrome = true,
  showText = true,
  renderLayout
}: EmojiLoadingCarouselProps) {
  const normalizedSlides = useMemo<EmojiLoadingCarouselSlide[]>(() => {
    const source = slides.length > 0 ? slides : fallbackSlides;

    return source.map((slide) => ({
      ...slide,
      imageKey: resolveSlideVectorKey(slide.image)
    }));
  }, [slides]);

  const [activeIndex, setActiveIndex] = useState(0);
  const [activeVisualIndex, setActiveVisualIndex] = useState(0);
  const [hasRandomizedVisualStart, setHasRandomizedVisualStart] = useState(false);

  useEffect(() => {
    setActiveIndex(0);
  }, [normalizedSlides]);

  useEffect(() => {
    if (normalizedSlides.length < 2) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % normalizedSlides.length);
    }, autoPlayMs);

    return () => window.clearInterval(timer);
  }, [autoPlayMs, normalizedSlides.length]);

  useIsomorphicLayoutEffect(() => {
    if (emojiVisualSequence.length === 0) {
      return undefined;
    }

    setActiveVisualIndex(Math.floor(Math.random() * emojiVisualSequence.length));
    setHasRandomizedVisualStart(true);

    return undefined;
  }, []);

  useEffect(() => {
    if (!hasRandomizedVisualStart || emojiVisualSequence.length < 2) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setActiveVisualIndex(
        (current) => (current + 1) % emojiVisualSequence.length
      );
    }, autoPlayMs);

    return () => window.clearInterval(timer);
  }, [autoPlayMs, hasRandomizedVisualStart]);

  const activeSlide = normalizedSlides[activeIndex];
  const activeVisualKey =
    emojiVisualSequence[activeVisualIndex] ?? activeSlide.imageKey;
  const activeVector = emojiHeadLayers[activeVisualKey];
  const activeLayers = emojiHeadLayerOrder
    .map((layerName) => ({
      layerName,
      shapes: activeVector.layers[layerName]
    }))
    .filter((layer) => layer.shapes.length > 0);
  const layerCount = Math.max(activeLayers.length, 1);
  const introDelay = Math.round(autoPlayMs * 0.08);
  const holdDuration = Math.round(autoPlayMs * 0.16);
  const eraseDuration = Math.round(autoPlayMs * 0.18);
  const revealBudget = Math.max(
    300,
    autoPlayMs - introDelay - holdDuration - eraseDuration
  );
  const layerDuration = Math.max(
    260,
    Math.round(revealBudget / (layerCount + 0.4))
  );
  const layerStride = Math.max(
    180,
    Math.round(layerDuration * 0.72)
  );
  const lastRevealEnd = introDelay + (layerCount - 1) * layerStride + layerDuration;
  const eraseDelay = lastRevealEnd + holdDuration;
  const rootStyle = {
    "--accent": activeSlide.accent,
    "--accent-soft": activeSlide.accentSoft,
    "--glow": activeSlide.glow,
    "--ink": "#6E3110",
    "--cycle-duration": `${autoPlayMs}ms`,
    "--layer-duration": `${layerDuration}ms`,
    "--erase-delay": `${eraseDelay}ms`,
    "--erase-duration": `${eraseDuration}ms`
  } as CSSProperties;
  const chromeNode = showChrome ? (
    <div className={styles.topline}>
      <span className={styles.badge}>
        <span className={styles.dotPulse} />
      </span>
      <span className={styles.counter}>
        {String(activeIndex + 1).padStart(2, "0")} /{" "}
        {String(normalizedSlides.length).padStart(2, "0")}
      </span>
    </div>
  ) : null;
  const stageNode = (
    <div className={styles.stage}>
      <div className={styles.gridGlow} />
      <div className={styles.orbPrimary} />
      <div className={styles.orbSecondary} />
      <div className={styles.ring} />
      <div className={styles.ringSoft} />
      <div className={styles.centerHalo} />
      <div className={styles.sheen} />

      <div className={styles.slideTrack}>
        <div
          key={activeVisualKey}
          className={styles.slide}
        >
          <div className={styles.faceViewport}>
            <div className={styles.faceContent}>
              <svg
                viewBox={activeVector.viewBox}
                className={styles.faceSvg}
                role={showText ? "img" : undefined}
                aria-label={showText ? `加载表情 ${activeVisualIndex + 1}` : undefined}
                aria-hidden={showText ? undefined : true}
              >
                <g className={styles.layerStage}>
                  {activeLayers.map((layer, index) => {
                    const pathStyle = {
                      "--layer-delay": `${introDelay + index * layerStride}ms`
                    } as CSSProperties;

                    return (
                      <g
                        key={`${activeVisualKey}-${layer.layerName}`}
                        className={styles.layerReveal}
                        style={pathStyle}
                      >
                        {layer.shapes.map((shape, shapeIndex) => (
                          <path
                            key={`${activeVisualKey}-${layer.layerName}-${shapeIndex}`}
                            d={shape.d}
                            fillRule={shape.fillRule}
                            className={styles.layerShape}
                          />
                        ))}
                      </g>
                    );
                  })}
                </g>
              </svg>
            </div>
            <span aria-hidden="true" className={styles.eraseMask} />
          </div>
        </div>
      </div>
    </div>
  );
  const centerNode = (
    <div
      className={clsx(
        styles.visualPane,
        styles.visualOnly,
        fullScreen && styles.visualPaneFullScreen
      )}
    >
      {stageNode}
    </div>
  );
  const defaultPanelNode = showText ? (
    <div className={styles.copyPane}>
      <div className={styles.meta}>
        <span className={styles.tag}>{activeSlide.tag}</span>
        <span className={styles.status}>{activeSlide.status}</span>
      </div>

      <div key={activeSlide.id} className={styles.copySwap}>
        <p className={styles.eyebrow}>{activeSlide.eyebrow}</p>
        <h2 className={styles.headline}>{activeSlide.headline}</h2>
        <p className={styles.body}>{activeSlide.body}</p>
      </div>
    </div>
  ) : null;
  const customLayout = renderLayout?.({
    activeIndex,
    slideCount: normalizedSlides.length,
    activeSlide,
    slides: normalizedSlides,
    center: centerNode,
    chrome: chromeNode,
    defaultPanel: defaultPanelNode
  });

  return (
    <section
      className={clsx(
        styles.shell,
        fullScreen && styles.fullScreen,
        renderLayout && styles.freeformShell,
        className
      )}
      style={rootStyle}
      aria-live={showText || renderLayout ? "polite" : undefined}
    >
      {customLayout ?? (
        <>
          <div
            className={clsx(
              styles.visualPane,
              !showText && styles.visualOnly,
              fullScreen && styles.visualPaneFullScreen
            )}
          >
            {chromeNode}
            {stageNode}
          </div>

          {defaultPanelNode}
        </>
      )}
    </section>
  );
}
