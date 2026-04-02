"use client";

import { useEffect, useRef, useState } from "react";
import { Image, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { AutoRefreshImage } from "@/components/ui/AutoRefreshImage";

export interface ImageMetadata {
  width: number;
  height: number;
}

interface ImageUploadStepProps {
  onImageSelect?: (
    imageUrl: string,
    file: File,
    metadata: ImageMetadata
  ) => void;
  onClear?: () => void;
  onError?: (error: string) => void;
  previewUrl?: string | null;
  previewLabel?: string | null;
  onRefreshPreviewUrl?: () => Promise<string | null | undefined>;
  disabled?: boolean;
  allowReplaceWhenPreviewed?: boolean;
}

const MAX_SOURCE_FILE_BYTES = 20 * 1024 * 1024;
const MAX_UPLOAD_FILE_BYTES = 5 * 1024 * 1024;
const MAX_UPLOAD_EDGE = 1280;
const PASSTHROUGH_FILE_BYTES = 1500 * 1024;
const PASSTHROUGH_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function loadImageElement(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("图片加载失败，请重新上传。"));
    image.src = url;
  });
}

async function loadImageMetadata(url: string): Promise<ImageMetadata> {
  const image = await loadImageElement(url);

  return {
    width: image.naturalWidth,
    height: image.naturalHeight,
  };
}

function getNormalizedFileName(fileName: string): string {
  const lastDotIndex = fileName.lastIndexOf(".");

  if (lastDotIndex <= 0) {
    return `${fileName}.jpg`;
  }

  return `${fileName.slice(0, lastDotIndex)}.jpg`;
}

function canvasToJpegBlob(
  canvas: HTMLCanvasElement,
  quality: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("图片压缩失败，请换一张图片再试。"));
          return;
        }

        resolve(blob);
      },
      "image/jpeg",
      quality
    );
  });
}

async function normalizeUploadImage(file: File): Promise<{
  file: File;
  metadata: ImageMetadata;
}> {
  const sourceUrl = URL.createObjectURL(file);

  try {
    const image = await loadImageElement(sourceUrl);
    const metadata = {
      width: image.naturalWidth,
      height: image.naturalHeight,
    };
    const longestEdge = Math.max(metadata.width, metadata.height);
    const canKeepOriginal =
      PASSTHROUGH_TYPES.has(file.type) &&
      file.size <= PASSTHROUGH_FILE_BYTES &&
      longestEdge <= MAX_UPLOAD_EDGE;

    if (canKeepOriginal) {
      return {
        file,
        metadata,
      };
    }

    const scale =
      longestEdge > MAX_UPLOAD_EDGE ? MAX_UPLOAD_EDGE / longestEdge : 1;
    const targetWidth = Math.max(1, Math.round(metadata.width * scale));
    const targetHeight = Math.max(1, Math.round(metadata.height * scale));
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("当前浏览器不支持图片预处理，请更换浏览器后重试。");
    }

    canvas.width = targetWidth;
    canvas.height = targetHeight;
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, targetWidth, targetHeight);
    context.drawImage(image, 0, 0, targetWidth, targetHeight);

    let quality = 0.88;
    let blob = await canvasToJpegBlob(canvas, quality);

    while (blob.size > MAX_UPLOAD_FILE_BYTES && quality > 0.56) {
      quality -= 0.08;
      blob = await canvasToJpegBlob(canvas, quality);
    }

    if (blob.size > MAX_UPLOAD_FILE_BYTES) {
      throw new Error("图片压缩后仍超过 5MB，请换一张更小的图片。");
    }

    return {
      file: new File([blob], getNormalizedFileName(file.name), {
        type: "image/jpeg",
        lastModified: Date.now(),
      }),
      metadata: {
        width: targetWidth,
        height: targetHeight,
      },
    };
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}

export function ImageUploadStep({
  onImageSelect,
  onClear,
  onError,
  previewUrl,
  previewLabel,
  onRefreshPreviewUrl,
  disabled = false,
  allowReplaceWhenPreviewed = true,
}: ImageUploadStepProps) {
  const [internalPreviewUrl, setInternalPreviewUrl] = useState<string | null>(
    null
  );
  const [internalFileName, setInternalFileName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const displayedPreviewUrl = previewUrl ?? internalPreviewUrl;
  const displayedFileName = previewLabel ?? internalFileName;
  const canPickImage =
    !disabled && (!displayedPreviewUrl || allowReplaceWhenPreviewed);

  useEffect(() => {
    return () => {
      if (internalPreviewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(internalPreviewUrl);
      }
    };
  }, [internalPreviewUrl]);

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    if (disabled) {
      return;
    }

    const sourceFile = event.target.files?.[0];

    if (!sourceFile) {
      return;
    }

    if (!sourceFile.type.startsWith("image/")) {
      onError?.("请上传图片文件，例如 JPG、PNG、WebP、BMP 或 HEIC。");
      return;
    }

    if (sourceFile.size > MAX_SOURCE_FILE_BYTES) {
      onError?.("原图不能超过 20MB。");
      return;
    }

    try {
      const normalized = await normalizeUploadImage(sourceFile);
      const objectUrl = URL.createObjectURL(normalized.file);
      const metadata = await loadImageMetadata(objectUrl);

      if (internalPreviewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(internalPreviewUrl);
      }

      setInternalPreviewUrl(objectUrl);
      setInternalFileName(normalized.file.name);
      onImageSelect?.(objectUrl, normalized.file, metadata);
    } catch (error) {
      onError?.(
        error instanceof Error ? error.message : "图片读取失败，请重新上传。"
      );
    } finally {
      event.target.value = "";
    }
  };

  const handleRemove = () => {
    if (disabled) {
      return;
    }

    if (internalPreviewUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(internalPreviewUrl);
    }

    setInternalPreviewUrl(null);
    setInternalFileName("");
    onClear?.();

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <Card className="space-y-4">
      <div className="space-y-2">
        <label className="text-xs font-medium text-slate-700">上传图片</label>

        {!displayedPreviewUrl ? (
          <button
            type="button"
            className={`flex w-full flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed bg-cream-50/60 p-6 text-center transition-colors ${
              disabled
                ? "cursor-not-allowed border-cream-100 opacity-60"
                : "cursor-pointer border-cream-100 hover:border-accent-brown/50"
            }`}
            onClick={() => {
              if (canPickImage) {
                fileInputRef.current?.click();
              }
            }}
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-brown/10">
              <Image className="h-6 w-6 text-accent-brown" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-slate-700">点击上传图片</p>
              <p className="text-xs text-slate-500">支持常见图片格式，系统会自动压缩优化。</p>
            </div>
          </button>
        ) : (
          <div className="relative rounded-3xl border border-cream-100 bg-cream-50/60 p-3">
            <button
              type="button"
              onClick={handleRemove}
              disabled={disabled}
              className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full border border-cream-100 bg-white/90 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="移除图片"
            >
              <X className="h-4 w-4 text-slate-600" />
            </button>

            <div className="flex gap-3">
              <img
                src={displayedPreviewUrl}
                alt="上传图片预览"
                className="h-24 w-24 rounded-2xl border border-cream-100 object-cover"
              />

              <div className="flex flex-1 items-center">
                <div className="space-y-1">
                  <p className="max-w-[220px] truncate text-sm font-medium text-slate-700">
                    {displayedFileName || "当前图片"}
                  </p>
                  <p className="text-xs text-slate-500">
                    {disabled
                      ? "处理中，暂时不能修改。"
                      : allowReplaceWhenPreviewed
                      ? "可以直接重新选择图片。"
                      : "如需更换图片，请先移除当前图片。"}
                  </p>
                </div>
              </div>
            </div>

            {allowReplaceWhenPreviewed ? (
              <button
                type="button"
                onClick={() => {
                  if (canPickImage) {
                    fileInputRef.current?.click();
                  }
                }}
                disabled={disabled}
                className="mt-2 text-xs font-medium text-accent-brown hover:underline disabled:cursor-not-allowed disabled:opacity-50"
              >
                重新选择
              </button>
            ) : null}
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
          disabled={disabled}
        />
      </div>
    </Card>
  );
}
