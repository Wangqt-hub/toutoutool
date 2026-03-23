import { HTMLAttributes } from "react";
import { clsx } from "clsx";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx(
        "rounded-3xl border border-cream-100 bg-cream-50/80 p-3 sm:p-5 shadow-[0_8px_24px_rgba(0,0,0,0.04)]",
        className
      )}
      {...props}
    />
  );
}

