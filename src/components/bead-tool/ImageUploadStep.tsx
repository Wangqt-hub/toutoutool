"use client";

import { useEffect, useRef, useState } from "react";
import { Image, X } from "lucide-react";
import { Card } from "@/components/ui/card";

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
  disabled?: boolean;
}

const MAX_SOURCE_FILE_BYTES = 20 * 1024 * 1024;
const MAX_UPLOAD_FILE_BYTES = 5 * 1024 * 1024;
const MAX_UPLOAD_EDGE = 1280;
const PASSTHROUGH_FILE_BYTES = 1500 * 1024;
const PASSTHROUGH_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

function loadImageElement(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("图片加载失败，请重新上传"));
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
          reject(new Error("图片压缩失败，请更换图片后再试"));
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
      throw new Error("当前浏览器不支持图片预处理，请更换浏览器后重试");
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
      throw new Error("图片压缩后仍超过 5MB，请换一张更小的图片");
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
  disabled = false,
}: ImageUploadStepProps) {
  const [internalPreviewUrl, setInternalPreviewUrl] = useState<string | null>(
    null
  );
  const [internalFileName, setInternalFileName] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const displayedPreviewUrl = previewUrl ?? internalPreviewUrl;
  const displayedFileName = previewLabel ?? internalFileName;

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
      onError?.("请上传图片文件（JPG / PNG / WebP / BMP / HEIC）");
      return;
    }

    if (sourceFile.size > MAX_SOURCE_FILE_BYTES) {
      onError?.("图片原文件不能超过 20MB");
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
        error instanceof Error ? error.message : "图片读取失败，请重新上传"
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

  const handleClick = () => {
    if (!disabled) {
      fileInputRef.current?.click();
    }
  };

  return (
    <Card className="space-y-4">
      <div className="space-y-2">
        <label className="text-xs font-medium text-slate-700">
          1. 上传图片
        </label>

        {!displayedPreviewUrl ? (
          <div
            className={`border-2 border-dashed rounded-3xl p-6 flex flex-col items-center justify-center gap-3 bg-cream-50/60 transition-colors ${
              disabled
                ? "border-cream-100 cursor-not-allowed opacity-60"
                : "border-cream-100 cursor-pointer hover:border-accent-brown/50"
            }`}
            onClick={handleClick}
          >
            <div className="w-12 h-12 rounded-full bg-accent-brown/10 flex items-center justify-center">
              <Image className="w-6 h-6 text-accent-brown" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-slate-700">
                点击或拖拽上传图片
              </p>
              <p className="text-xs text-slate-500 mt-1">
                支持 JPG、PNG、WebP、BMP、HEIC，上传前会自动优化
              </p>
            </div>
          </div>
        ) : (
          <div className="relative rounded-3xl border border-cream-100 bg-cream-50/60 p-3">
            <button
              type="button"
              onClick={handleRemove}
              disabled={disabled}
              className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white/90 border border-cream-100 flex items-center justify-center hover:bg-red-50 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="移除图片"
            >
              <X className="w-4 h-4 text-slate-600" />
            </button>

            <div className="flex gap-3">
              <img
                src={displayedPreviewUrl}
                alt="图片预览"
                className="w-24 h-24 object-cover rounded-2xl border border-cream-100"
              />
              <div className="flex-grow flex items-center">
                <div>
                  <p className="text-sm font-medium text-slate-700 truncate max-w-[200px]">
                    {displayedFileName || "当前图片"}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {disabled
                      ? "AI 生成中，暂时不能更换图片"
                      : "点击下方按钮可以重新选择图片"}
                  </p>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleClick}
              disabled={disabled}
              className="text-xs text-accent-brown font-medium hover:underline mt-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              重新选择
            </button>
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

        <p className="text-[11px] text-slate-500">
          建议使用清晰、主体明确的图片；移动端大图会先压缩后再上传，生成会更稳定。
        </p>
      </div>
    </Card>
  );
}
