"use client";

import { useEffect, useRef, useState } from "react";
import { Crop, RefreshCcw } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { CropRect } from "@/lib/bead/patternImport";

interface DisplayCropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

type DragHandle = "move" | "nw" | "ne" | "sw" | "se";

interface MagnifierState {
  handle: DragHandle;
  focusX: number;
  focusY: number;
  crop: DisplayCropRect;
}

interface PatternCropperProps {
  imageUrl: string;
  onConfirm: (crop: CropRect) => void;
}

const MAGNIFIER_SIZE = 132;
const MAGNIFIER_ZOOM = 3;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function createDefaultCrop(width: number, height: number): DisplayCropRect {
  const cropWidth = width * 0.82;
  const cropHeight = height * 0.82;

  return {
    x: (width - cropWidth) / 2,
    y: (height - cropHeight) / 2,
    width: cropWidth,
    height: cropHeight,
  };
}

function getMagnifierFocusPoint(
  crop: DisplayCropRect,
  handle: DragHandle
): { x: number; y: number } {
  if (handle === "nw") {
    return { x: crop.x, y: crop.y };
  }

  if (handle === "ne") {
    return { x: crop.x + crop.width, y: crop.y };
  }

  if (handle === "sw") {
    return { x: crop.x, y: crop.y + crop.height };
  }

  if (handle === "se") {
    return { x: crop.x + crop.width, y: crop.y + crop.height };
  }

  return {
    x: crop.x + crop.width / 2,
    y: crop.y + crop.height / 2,
  };
}

function shouldShowMagnifierEdge(
  handle: DragHandle,
  edge: "left" | "right" | "top" | "bottom"
): boolean {
  if (handle === "move") {
    return true;
  }

  if (handle === "nw") {
    return edge === "left" || edge === "top";
  }

  if (handle === "ne") {
    return edge === "right" || edge === "top";
  }

  if (handle === "sw") {
    return edge === "left" || edge === "bottom";
  }

  return edge === "right" || edge === "bottom";
}

export function PatternCropper({ imageUrl, onConfirm }: PatternCropperProps) {
  const imageRef = useRef<HTMLImageElement | null>(null);
  const dragState = useRef<{
    handle: DragHandle;
    pointerId: number;
    startX: number;
    startY: number;
    initialCrop: DisplayCropRect;
  } | null>(null);

  const [displaySize, setDisplaySize] = useState({ width: 0, height: 0 });
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });
  const [crop, setCrop] = useState<DisplayCropRect | null>(null);
  const [magnifier, setMagnifier] = useState<MagnifierState | null>(null);

  const updateMagnifier = (nextCrop: DisplayCropRect, handle: DragHandle) => {
    const focus = getMagnifierFocusPoint(nextCrop, handle);

    setMagnifier({
      handle,
      focusX: focus.x,
      focusY: focus.y,
      crop: nextCrop,
    });
  };

  useEffect(() => {
    setCrop(null);
    setMagnifier(null);
    dragState.current = null;
  }, [imageUrl]);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      if (!dragState.current) {
        return;
      }

      if (event.pointerId !== dragState.current.pointerId) {
        return;
      }

      const minSize = 40;
      const { handle, startX, startY, initialCrop } = dragState.current;
      const deltaX = event.clientX - startX;
      const deltaY = event.clientY - startY;
      let nextCrop = { ...initialCrop };

      if (handle === "move") {
        nextCrop.x = clamp(
          initialCrop.x + deltaX,
          0,
          displaySize.width - initialCrop.width
        );
        nextCrop.y = clamp(
          initialCrop.y + deltaY,
          0,
          displaySize.height - initialCrop.height
        );
      } else if (handle === "nw") {
        const nextX = clamp(
          initialCrop.x + deltaX,
          0,
          initialCrop.x + initialCrop.width - minSize
        );
        const nextY = clamp(
          initialCrop.y + deltaY,
          0,
          initialCrop.y + initialCrop.height - minSize
        );
        nextCrop = {
          x: nextX,
          y: nextY,
          width: initialCrop.width + (initialCrop.x - nextX),
          height: initialCrop.height + (initialCrop.y - nextY),
        };
      } else if (handle === "ne") {
        const nextWidth = clamp(
          initialCrop.width + deltaX,
          minSize,
          displaySize.width - initialCrop.x
        );
        const nextY = clamp(
          initialCrop.y + deltaY,
          0,
          initialCrop.y + initialCrop.height - minSize
        );
        nextCrop = {
          x: initialCrop.x,
          y: nextY,
          width: nextWidth,
          height: initialCrop.height + (initialCrop.y - nextY),
        };
      } else if (handle === "sw") {
        const nextX = clamp(
          initialCrop.x + deltaX,
          0,
          initialCrop.x + initialCrop.width - minSize
        );
        const nextHeight = clamp(
          initialCrop.height + deltaY,
          minSize,
          displaySize.height - initialCrop.y
        );
        nextCrop = {
          x: nextX,
          y: initialCrop.y,
          width: initialCrop.width + (initialCrop.x - nextX),
          height: nextHeight,
        };
      } else if (handle === "se") {
        nextCrop = {
          x: initialCrop.x,
          y: initialCrop.y,
          width: clamp(
            initialCrop.width + deltaX,
            minSize,
            displaySize.width - initialCrop.x
          ),
          height: clamp(
            initialCrop.height + deltaY,
            minSize,
            displaySize.height - initialCrop.y
          ),
        };
      }

      setCrop(nextCrop);
      updateMagnifier(nextCrop, handle);
    };

    const stopDrag = (event?: PointerEvent) => {
      if (
        event &&
        dragState.current &&
        event.pointerId !== dragState.current.pointerId
      ) {
        return;
      }

      dragState.current = null;
      setMagnifier(null);
    };

    window.addEventListener("pointermove", handlePointerMove, {
      passive: false,
    });
    window.addEventListener("pointerup", stopDrag);
    window.addEventListener("pointercancel", stopDrag);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopDrag);
      window.removeEventListener("pointercancel", stopDrag);
    };
  }, [displaySize.height, displaySize.width]);

  const setDefaultCrop = () => {
    if (displaySize.width === 0 || displaySize.height === 0) {
      return;
    }

    setCrop(createDefaultCrop(displaySize.width, displaySize.height));
  };

  const handleImageLoad = () => {
    if (!imageRef.current) {
      return;
    }

    const rect = imageRef.current.getBoundingClientRect();
    setDisplaySize({ width: rect.width, height: rect.height });
    setNaturalSize({
      width: imageRef.current.naturalWidth,
      height: imageRef.current.naturalHeight,
    });
    setCrop(createDefaultCrop(rect.width, rect.height));
  };

  const startDrag = (
    handle: DragHandle,
    event: React.PointerEvent<HTMLElement>
  ) => {
    event.preventDefault();
    event.stopPropagation();

    if (!crop) {
      return;
    }

    dragState.current = {
      handle,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      initialCrop: crop,
    };
    updateMagnifier(crop, handle);
  };

  const handleLabel =
    magnifier?.handle === "move"
      ? "移动裁切框"
      : magnifier?.handle === "nw"
      ? "调整左上角"
      : magnifier?.handle === "ne"
      ? "调整右上角"
      : magnifier?.handle === "sw"
      ? "调整左下角"
      : magnifier?.handle === "se"
      ? "调整右下角"
      : "";

  const magnifierStyle =
    magnifier && naturalSize.width > 0 && naturalSize.height > 0 && displaySize.width > 0 && displaySize.height > 0
      ? {
          backgroundImage: `url("${imageUrl}")`,
          backgroundRepeat: "no-repeat",
          backgroundSize: `${naturalSize.width * MAGNIFIER_ZOOM}px ${
            naturalSize.height * MAGNIFIER_ZOOM
          }px`,
          backgroundPosition: `${
            MAGNIFIER_SIZE / 2 -
            (magnifier.focusX * (naturalSize.width / displaySize.width)) * MAGNIFIER_ZOOM
          }px ${
            MAGNIFIER_SIZE / 2 -
            (magnifier.focusY * (naturalSize.height / displaySize.height)) * MAGNIFIER_ZOOM
          }px`,
        }
      : undefined;

  const magnifierEdgePositions =
    magnifier && naturalSize.width > 0 && naturalSize.height > 0 && displaySize.width > 0 && displaySize.height > 0
      ? (() => {
          const scaleX =
            (naturalSize.width / displaySize.width) * MAGNIFIER_ZOOM;
          const scaleY =
            (naturalSize.height / displaySize.height) * MAGNIFIER_ZOOM;

          return {
            left: MAGNIFIER_SIZE / 2 + (magnifier.crop.x - magnifier.focusX) * scaleX,
            right:
              MAGNIFIER_SIZE / 2 +
              (magnifier.crop.x + magnifier.crop.width - magnifier.focusX) * scaleX,
            top: MAGNIFIER_SIZE / 2 + (magnifier.crop.y - magnifier.focusY) * scaleY,
            bottom:
              MAGNIFIER_SIZE / 2 +
              (magnifier.crop.y + magnifier.crop.height - magnifier.focusY) * scaleY,
          };
        })()
      : null;

  const handleConfirm = () => {
    if (
      !crop ||
      naturalSize.width === 0 ||
      naturalSize.height === 0 ||
      displaySize.width === 0 ||
      displaySize.height === 0
    ) {
      return;
    }

    const scaleX = naturalSize.width / displaySize.width;
    const scaleY = naturalSize.height / displaySize.height;

    onConfirm({
      x: Math.round(crop.x * scaleX),
      y: Math.round(crop.y * scaleY),
      width: Math.round(crop.width * scaleX),
      height: Math.round(crop.height * scaleY),
    });
  };

  return (
    <Card className="space-y-4">
      <div className="space-y-2">
        <label className="text-xs font-medium text-slate-700 flex items-center gap-2">
          <Crop className="w-4 h-4 text-green-500" />
          2. 裁切目标像素格区域
        </label>

        <p className="text-[11px] text-slate-500">
          尽量只框住中间的像素格区域，不要带底部色卡图例。行列编号和外框可以少量保留，后续会继续自动识别。
        </p>
      </div>

      <div className="rounded-3xl border border-cream-100 bg-cream-50/60 p-3">
        <div
          className="relative inline-block max-w-full select-none touch-none"
          style={{
            touchAction: "none",
            userSelect: "none",
            WebkitUserSelect: "none",
            WebkitTouchCallout: "none",
          }}
          onContextMenu={(event) => event.preventDefault()}
        >
          <img
            ref={imageRef}
            src={imageUrl}
            alt="图纸裁切预览"
            className="block max-w-full h-auto rounded-2xl border border-cream-100"
            onLoad={handleImageLoad}
            onContextMenu={(event) => event.preventDefault()}
            onDragStart={(event) => event.preventDefault()}
            draggable={false}
            style={{
              userSelect: "none",
              WebkitUserSelect: "none",
              WebkitTouchCallout: "none",
            }}
          />

          {magnifier && magnifierStyle ? (
            <div className="pointer-events-none absolute right-3 top-3 z-20 w-[148px] rounded-[22px] border border-slate-200 bg-white p-2 shadow-[0_16px_34px_rgba(15,23,42,0.18)] sm:w-[152px]">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  放大镜
                </span>
                <span className="truncate text-[10px] text-slate-500">
                  {handleLabel}
                </span>
              </div>

              <div
                className="relative overflow-hidden rounded-[16px] border border-cream-100 bg-white"
                style={{
                  width: MAGNIFIER_SIZE,
                  height: MAGNIFIER_SIZE,
                  ...magnifierStyle,
                }}
              >
                {magnifierEdgePositions &&
                shouldShowMagnifierEdge(magnifier.handle, "left") ? (
                  <div
                    className="absolute inset-y-0 w-[2px] bg-emerald-500/95 shadow-[0_0_0_1px_rgba(255,255,255,0.86)]"
                    style={{
                      left: magnifierEdgePositions.left - 1,
                    }}
                  />
                ) : null}
                {magnifierEdgePositions &&
                shouldShowMagnifierEdge(magnifier.handle, "right") ? (
                  <div
                    className="absolute inset-y-0 w-[2px] bg-emerald-500/95 shadow-[0_0_0_1px_rgba(255,255,255,0.86)]"
                    style={{
                      left: magnifierEdgePositions.right - 1,
                    }}
                  />
                ) : null}
                {magnifierEdgePositions &&
                shouldShowMagnifierEdge(magnifier.handle, "top") ? (
                  <div
                    className="absolute inset-x-0 h-[2px] bg-emerald-500/95 shadow-[0_0_0_1px_rgba(255,255,255,0.86)]"
                    style={{
                      top: magnifierEdgePositions.top - 1,
                    }}
                  />
                ) : null}
                {magnifierEdgePositions &&
                shouldShowMagnifierEdge(magnifier.handle, "bottom") ? (
                  <div
                    className="absolute inset-x-0 h-[2px] bg-emerald-500/95 shadow-[0_0_0_1px_rgba(255,255,255,0.86)]"
                    style={{
                      top: magnifierEdgePositions.bottom - 1,
                    }}
                  />
                ) : null}
                <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-white/85 shadow-[0_0_0_1px_rgba(15,23,42,0.16)]" />
                <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-white/85 shadow-[0_0_0_1px_rgba(15,23,42,0.16)]" />
                <div className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white bg-green-500/90 shadow-sm" />
              </div>
            </div>
          ) : null}

          {crop ? (
            <>
              <div
                className="absolute bg-black/35 pointer-events-none rounded-tl-2xl"
                style={{
                  left: 0,
                  top: 0,
                  width: displaySize.width,
                  height: crop.y,
                }}
              />
              <div
                className="absolute bg-black/35 pointer-events-none"
                style={{
                  left: 0,
                  top: crop.y,
                  width: crop.x,
                  height: crop.height,
                }}
              />
              <div
                className="absolute bg-black/35 pointer-events-none"
                style={{
                  left: crop.x + crop.width,
                  top: crop.y,
                  width: displaySize.width - crop.x - crop.width,
                  height: crop.height,
                }}
              />
              <div
                className="absolute bg-black/35 pointer-events-none rounded-br-2xl"
                style={{
                  left: 0,
                  top: crop.y + crop.height,
                  width: displaySize.width,
                  height: displaySize.height - crop.y - crop.height,
                }}
              />

              <div
                className="absolute border-2 border-green-500 shadow-[0_0_0_9999px_rgba(0,0,0,0)] rounded-xl cursor-move touch-none"
                style={{
                  left: crop.x,
                  top: crop.y,
                  width: crop.width,
                  height: crop.height,
                  touchAction: "none",
                }}
                onPointerDown={(event) => startDrag("move", event)}
              >
                {(["nw", "ne", "sw", "se"] as DragHandle[]).map((handle) => {
                  const positionStyle =
                    handle === "nw"
                      ? { left: -12, top: -12, cursor: "nwse-resize" }
                      : handle === "ne"
                      ? { right: -12, top: -12, cursor: "nesw-resize" }
                      : handle === "sw"
                      ? { left: -12, bottom: -12, cursor: "nesw-resize" }
                      : { right: -12, bottom: -12, cursor: "nwse-resize" };

                  return (
                    <button
                      key={handle}
                      type="button"
                      className="absolute w-6 h-6 rounded-full bg-white/0 touch-none"
                      style={{
                        ...positionStyle,
                        touchAction: "none",
                      }}
                      onPointerDown={(event) => startDrag(handle, event)}
                      aria-label={`调整裁切框 ${handle}`}
                    >
                      <span className="absolute inset-[5px] rounded-full bg-green-500 border border-white" />
                    </button>
                  );
                })}
              </div>
            </>
          ) : null}
        </div>
      </div>

      <div className="flex gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={setDefaultCrop}>
          <RefreshCcw className="w-4 h-4 mr-1" />
          重置裁切框
        </Button>
        <Button type="button" variant="primary" size="sm" onClick={handleConfirm}>
          确认裁切
        </Button>
      </div>
    </Card>
  );
}
