"use client";

import { useEffect, useState } from "react";
import { Grid3X3 } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { GridGeometry } from "@/lib/bead/patternImport";

interface PatternGridOverlayPreviewProps {
  imageUrl: string;
  geometry: GridGeometry | null;
  rowCount: number;
  colCount: number;
}

interface PreviewData {
  dataUrl: string;
  width: number;
  height: number;
}

export function PatternGridOverlayPreview({
  imageUrl,
  geometry,
  rowCount,
  colCount,
}: PatternGridOverlayPreviewProps) {
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!imageUrl || !geometry) {
      setPreviewData(null);
      return () => {
        cancelled = true;
      };
    }

    const image = new Image();
    image.onload = () => {
      if (cancelled) {
        return;
      }

      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");

      if (!context) {
        setPreviewData(null);
        return;
      }

      const previewWidth = Math.max(1, Math.round(geometry.bounds.width));
      const previewHeight = Math.max(1, Math.round(geometry.bounds.height));

      canvas.width = previewWidth;
      canvas.height = previewHeight;
      context.drawImage(
        image,
        geometry.bounds.x,
        geometry.bounds.y,
        geometry.bounds.width,
        geometry.bounds.height,
        0,
        0,
        previewWidth,
        previewHeight
      );

      setPreviewData({
        dataUrl: canvas.toDataURL("image/png"),
        width: previewWidth,
        height: previewHeight,
      });
    };

    image.onerror = () => {
      if (!cancelled) {
        setPreviewData(null);
      }
    };

    image.src = imageUrl;

    return () => {
      cancelled = true;
    };
  }, [
    geometry,
    imageUrl,
  ]);

  if (!imageUrl || !geometry) {
    return null;
  }

  return (
    <Card className="space-y-4 border-white/75 bg-white/92">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-700">
            <Grid3X3 className="h-4 w-4 text-emerald-500" />
            <span>裁切预览</span>
          </div>
          <p className="text-[11px] text-slate-500">
            当前行列会直接叠加在识别区域上，方便核对网格边界。
          </p>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-slate-500">
          <span className="rounded-full border border-cream-100 bg-cream-50 px-3 py-1">
            {rowCount} 行
          </span>
          <span className="rounded-full border border-cream-100 bg-cream-50 px-3 py-1">
            {colCount} 列
          </span>
        </div>
      </div>

      <div className="rounded-[26px] border border-cream-100 bg-cream-50/65 p-2.5">
        <div className="relative inline-block max-w-full bg-white">
          {previewData ? (
            <img
              src={previewData.dataUrl}
              alt="裁切后的图纸预览"
              className="block h-auto max-w-full"
              draggable={false}
            />
          ) : (
            <div
              className="rounded-2xl bg-cream-50/70"
              style={{
                width: Math.max(160, Math.round(geometry.bounds.width)),
                height: Math.max(120, Math.round(geometry.bounds.height)),
              }}
            />
          )}

          {previewData ? (
            <svg
              className="pointer-events-none absolute inset-0 h-full w-full"
              viewBox={`0 0 ${previewData.width} ${previewData.height}`}
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <rect
                x={0}
                y={0}
                width={previewData.width}
                height={previewData.height}
                fill="none"
                stroke="rgba(0, 0, 0, 0.92)"
                strokeWidth="4"
                vectorEffect="non-scaling-stroke"
              />

              {geometry.verticalLines.map((position, index) => (
                <line
                  key={`v-${index}-${position}`}
                  x1={position - geometry.bounds.x}
                  y1={0}
                  x2={position - geometry.bounds.x}
                  y2={previewData.height}
                  stroke="rgba(0, 0, 0, 0.96)"
                  strokeWidth={
                    index === 0 || index === geometry.verticalLines.length - 1
                      ? 3.4
                      : 2.4
                  }
                  vectorEffect="non-scaling-stroke"
                />
              ))}

              {geometry.horizontalLines.map((position, index) => (
                <line
                  key={`h-${index}-${position}`}
                  x1={0}
                  y1={position - geometry.bounds.y}
                  x2={previewData.width}
                  y2={position - geometry.bounds.y}
                  stroke="rgba(0, 0, 0, 0.96)"
                  strokeWidth={
                    index === 0 || index === geometry.horizontalLines.length - 1
                      ? 3.4
                      : 2.4
                  }
                  vectorEffect="non-scaling-stroke"
                />
              ))}
            </svg>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
