"use client";

import Image from "next/image";
import { motion } from "framer-motion";

type Variant = "hero" | "figure";

type Props = {
  /** 用途：hero 用于引导页等主视觉（可带装饰）；figure 用于导航/侧栏等，仅宝宝形象、透明背景 */
  variant?: Variant;
  size?: "xs" | "sm" | "md" | "lg";
};

const sizeMap = {
  xs: { class: "w-9 h-9", px: 36 },
  sm: { class: "w-24 h-24", px: 96 },
  md: { class: "w-32 h-32", px: 128 },
  lg: { class: "w-40 h-40", px: 160 },
};

const imagePaths = {
  hero: "/images/mascot/hero.webp",
  figure: "/images/mascot/figure.webp",
} as const;

export function CapybaraHero({ variant = "figure", size = "md" }: Props) {
  const { class: sizeClass, px } = sizeMap[size];
  const src = imagePaths[variant];

  return (
    <motion.div
      className={`relative ${sizeClass}`}
      initial={{ y: 10, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 120 }}
    >
      {variant === "hero" && (
        <>
          <div className="absolute -top-3 -right-3 h-6 w-6 rounded-full bg-blush shadow-sm flex items-center justify-center text-[10px]">
            ❤
          </div>
          <div className="absolute -bottom-2 -left-3 h-6 w-6 rounded-full bg-accent-yellow shadow-sm flex items-center justify-center text-[10px]">
            🦆
          </div>
        </>
      )}
      <Image
        src={src}
        alt="头头"
        fill
        sizes={`(max-width: 768px) ${Math.min(px, 96)}px, ${px}px`}
        className="object-contain drop-shadow-md"
      />
    </motion.div>
  );
}
