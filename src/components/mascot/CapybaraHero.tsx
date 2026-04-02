import Image from "next/image";

type Variant = "hero" | "figure";

type Props = {
  /** 用途：hero 用于引导页等主视觉（可带装饰）；figure 用于导航/侧栏等，仅宝宝形象、透明背景 */
  variant?: Variant;
  size?: "xs" | "sm" | "md" | "lg";
  priority?: boolean;
  className?: string;
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

export function CapybaraHero({
  variant = "figure",
  size = "md",
  priority = false,
  className = "",
}: Props) {
  const { class: sizeClass, px } = sizeMap[size];
  const src = imagePaths[variant];

  return (
    <div className={`relative ${sizeClass} ${className}`.trim()}>
      {variant === "hero" && (
        <>
          <div className="absolute -top-3 -right-3 flex h-6 w-6 items-center justify-center rounded-full bg-blush text-[10px] shadow-sm">
            ❤
          </div>
          <div className="absolute -bottom-2 -left-3 flex h-6 w-6 items-center justify-center rounded-full bg-accent-yellow text-[10px] shadow-sm">
            🦆
          </div>
        </>
      )}
      <Image
        src={src}
        alt="头头"
        fill
        sizes={`(max-width: 768px) ${Math.min(px, 96)}px, ${px}px`}
        priority={priority}
        className="object-contain drop-shadow-md"
      />
    </div>
  );
}
