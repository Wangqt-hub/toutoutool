"use client";

import { useRef, useState } from "react";
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
}

export function ImageUploadStep({
  onImageSelect,
  onClear,
  onError,
}: ImageUploadStepProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadImageMetadata = (url: string) =>
    new Promise<ImageMetadata>((resolve, reject) => {
      const image = new window.Image();
      image.onload = () =>
        resolve({
          width: image.naturalWidth,
          height: image.naturalHeight,
        });
      image.onerror = () => reject(new Error("图片加载失败，请重新上传"));
      image.src = url;
    });

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      onError?.("请上传图片文件（JPG / PNG / WebP）");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      onError?.("图片大小不能超过 5MB");
      return;
    }

    const url = URL.createObjectURL(file);

    try {
      const metadata = await loadImageMetadata(url);

      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }

      setPreviewUrl(url);
      setFileName(file.name);
      onImageSelect?.(url, file, metadata);
    } catch (error) {
      URL.revokeObjectURL(url);
      onError?.(
        error instanceof Error ? error.message : "图片读取失败，请重新上传"
      );
    }
  };

  const handleRemove = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setPreviewUrl(null);
    setFileName("");
    onClear?.();

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <Card className="space-y-4">
      <div className="space-y-2">
        <label className="text-xs font-medium text-slate-700">
          1. 上传图片
        </label>

        {!previewUrl ? (
          <div
            className="border-2 border-dashed border-cream-100 rounded-3xl p-6 flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-accent-brown/50 transition-colors bg-cream-50/60"
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
                支持 JPG、PNG、WebP 格式，最大 5MB
              </p>
            </div>
          </div>
        ) : (
          <div className="relative rounded-3xl border border-cream-100 bg-cream-50/60 p-3">
            <button
              type="button"
              onClick={handleRemove}
              className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white/90 border border-cream-100 flex items-center justify-center hover:bg-red-50 transition-colors"
              aria-label="移除图片"
            >
              <X className="w-4 h-4 text-slate-600" />
            </button>

            <div className="flex gap-3">
              <img
                src={previewUrl}
                alt="图片预览"
                className="w-24 h-24 object-cover rounded-2xl border border-cream-100"
              />
              <div className="flex-grow flex items-center">
                <div>
                  <p className="text-sm font-medium text-slate-700 truncate max-w-[200px]">
                    {fileName}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    点击下方按钮可重新上传
                  </p>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleClick}
              className="text-xs text-accent-brown font-medium hover:underline mt-2"
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
        />

        <p className="text-[11px] text-slate-500">
          建议使用清晰、主体明确的图片，生成的拼豆图纸会更稳定。
        </p>
      </div>
    </Card>
  );
}
