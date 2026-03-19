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

interface PatternCropperProps {
  imageUrl: string;
  onConfirm: (crop: CropRect) => void;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function PatternCropper({ imageUrl, onConfirm }: PatternCropperProps) {
  const imageRef = useRef<HTMLImageElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const dragState = useRef<{
    handle: DragHandle;
    startX: number;
    startY: number;
    initialCrop: DisplayCropRect;
  } | null>(null);

  const [displaySize, setDisplaySize] = useState({ width: 0, height: 0 });
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });
  const [crop, setCrop] = useState<DisplayCropRect | null>(null);

  useEffect(() => {
    setCrop(null);
  }, [imageUrl]);

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (!dragState.current || !crop) {
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
        const nextX = clamp(initialCrop.x + deltaX, 0, initialCrop.x + initialCrop.width - minSize);
        const nextY = clamp(initialCrop.y + deltaY, 0, initialCrop.y + initialCrop.height - minSize);
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
        const nextY = clamp(initialCrop.y + deltaY, 0, initialCrop.y + initialCrop.height - minSize);
        nextCrop = {
          x: initialCrop.x,
          y: nextY,
          width: nextWidth,
          height: initialCrop.height + (initialCrop.y - nextY),
        };
      } else if (handle === "sw") {
        const nextX = clamp(initialCrop.x + deltaX, 0, initialCrop.x + initialCrop.width - minSize);
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
    };

    const handleMouseUp = () => {
      dragState.current = null;
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [crop, displaySize.height, displaySize.width]);

  const setDefaultCrop = () => {
    const width = displaySize.width * 0.82;
    const height = displaySize.height * 0.82;
    setCrop({
      x: (displaySize.width - width) / 2,
      y: (displaySize.height - height) / 2,
      width,
      height,
    });
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

    const width = rect.width * 0.82;
    const height = rect.height * 0.82;
    setCrop({
      x: (rect.width - width) / 2,
      y: (rect.height - height) / 2,
      width,
      height,
    });
  };

  const startDrag = (handle: DragHandle, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();

    if (!crop) {
      return;
    }

    dragState.current = {
      handle,
      startX: event.clientX,
      startY: event.clientY,
      initialCrop: crop,
    };
  };

  const handleConfirm = () => {
    if (!crop || naturalSize.width === 0 || naturalSize.height === 0) {
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
        <div ref={frameRef} className="relative inline-block max-w-full select-none">
          <img
            ref={imageRef}
            src={imageUrl}
            alt="图纸裁切预览"
            className="block max-w-full h-auto rounded-2xl border border-cream-100"
            onLoad={handleImageLoad}
            draggable={false}
          />

          {crop ? (
            <>
              <div
                className="absolute bg-black/35 pointer-events-none rounded-tl-2xl"
                style={{ left: 0, top: 0, width: displaySize.width, height: crop.y }}
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
                className="absolute border-2 border-green-500 shadow-[0_0_0_9999px_rgba(0,0,0,0)] rounded-xl cursor-move"
                style={{
                  left: crop.x,
                  top: crop.y,
                  width: crop.width,
                  height: crop.height,
                }}
                onMouseDown={(event) => startDrag("move", event)}
              >
                {(["nw", "ne", "sw", "se"] as DragHandle[]).map((handle) => {
                  const positionStyle =
                    handle === "nw"
                      ? { left: -6, top: -6, cursor: "nwse-resize" }
                      : handle === "ne"
                        ? { right: -6, top: -6, cursor: "nesw-resize" }
                        : handle === "sw"
                          ? { left: -6, bottom: -6, cursor: "nesw-resize" }
                          : { right: -6, bottom: -6, cursor: "nwse-resize" };

                  return (
                    <button
                      key={handle}
                      type="button"
                      className="absolute w-3 h-3 rounded-full bg-green-500 border border-white"
                      style={positionStyle}
                      onMouseDown={(event) => startDrag(handle, event)}
                      aria-label={`调整裁切框 ${handle}`}
                    />
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
