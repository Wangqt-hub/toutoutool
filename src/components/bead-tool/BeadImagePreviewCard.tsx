"use client";

import type { ReactNode } from "react";
import { Image as ImageIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { AutoRefreshImage } from "@/components/ui/AutoRefreshImage";

interface BeadImagePreviewCardProps {
  title: string;
  description: string;
  imageUrl?: string | null;
  onRefreshImageUrl?: () => Promise<string | null | undefined>;
  alt: string;
  badge?: string;
  meta?: string[];
  fit?: "cover" | "contain";
  actions?: ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
}

export function BeadImagePreviewCard({
  title,
  description,
  imageUrl,
  onRefreshImageUrl,
  alt,
  badge,
  meta,
  fit = "cover",
  actions,
  emptyTitle = "等待内容",
  emptyDescription = "完成当前步骤后，这里会显示对应的图片预览。",
}: BeadImagePreviewCardProps) {
  return (
    <Card className="border-white/70 bg-white/84 p-3 shadow-[0_18px_50px_rgba(15,23,42,0.06)] sm:p-4 xl:p-5">
      <div className="space-y-3">
        <div className="space-y-1.5">
          {badge ? (
            <span className="inline-flex rounded-full border border-cream-100 bg-cream-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600">
              {badge}
            </span>
          ) : null}

          <div>
            <h3 className="text-base font-semibold text-slate-900">{title}</h3>
            <p className="mt-1 text-sm leading-6 text-slate-600">{description}</p>
          </div>
        </div>

        {imageUrl ? (
          <div className="overflow-hidden rounded-[24px] border border-cream-100 bg-cream-50/70 p-2.5">
            <div className="overflow-hidden rounded-[18px] bg-white">
              <AutoRefreshImage
                src={imageUrl}
                onRefreshSrc={onRefreshImageUrl}
                alt={alt}
                className={
                  fit === "contain"
                    ? "h-auto max-h-[380px] w-full object-contain"
                    : "h-[220px] w-full object-cover sm:h-[240px]"
                }
              />
            </div>
          </div>
        ) : (
          <div className="flex min-h-[220px] flex-col items-center justify-center rounded-[24px] border border-dashed border-cream-100 bg-cream-50/60 px-4 text-center sm:min-h-[250px]">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-cream-100 text-accent-brown">
              <ImageIcon className="h-5 w-5" />
            </span>
            <p className="mt-3 text-sm font-semibold text-slate-800">{emptyTitle}</p>
            <p className="mt-2 max-w-xs text-xs leading-6 text-slate-500">
              {emptyDescription}
            </p>
          </div>
        )}

        {meta?.length ? (
          <div className="grid gap-1.5 sm:grid-cols-2">
            {meta.map((item) => (
              <div
                key={item}
                className="rounded-2xl border border-cream-100 bg-cream-50/70 px-3 py-2 text-xs text-slate-600"
              >
                {item}
              </div>
            ))}
          </div>
        ) : null}

        {actions}
      </div>
    </Card>
  );
}
