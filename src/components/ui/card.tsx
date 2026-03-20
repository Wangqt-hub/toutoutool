import { HTMLAttributes } from "react";
import { clsx } from "clsx";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx(
        "rounded-3xl bg-cream-50/80 border border-cream-100 shadow-[0_8px_24px_rgba(0,0,0,0.04)] p-4 sm:p-6",
        className
      )}
      {...props}
    />
  );
}

