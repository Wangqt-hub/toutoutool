import {
  ButtonHTMLAttributes,
  forwardRef,
  isValidElement,
  cloneElement
} from "react";
import { clsx } from "clsx";

type Variant = "primary" | "secondary" | "ghost";
type Size = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  asChild?: boolean;
}

const baseClasses =
  "inline-flex items-center justify-center font-bold rounded-full transition-all duration-300 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent-brown/30 disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-0.5 active:translate-y-1 active:scale-95 select-none";

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-accent-brown text-cream-50 hover:bg-accent-deep hover:shadow-cute active:shadow-none border border-transparent",
  secondary:
    "bg-blush text-slate-800 hover:bg-blush-100 hover:shadow-cute active:shadow-none border border-transparent",
  ghost:
    "bg-transparent text-accent-brown hover:bg-cream-100 hover:text-accent-deep"
};

const sizeClasses: Record<Size, string> = {
  sm: "px-4 py-2 text-xs",
  md: "px-5 py-2.5 text-sm",
  lg: "px-8 py-3.5 text-base"
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant = "primary", size = "md", asChild, children, ...props },
    ref
  ) => {
    const mergedClassName = clsx(
      baseClasses,
      variantClasses[variant],
      sizeClasses[size],
      className
    );

    if (asChild && isValidElement(children)) {
      return cloneElement(children as React.ReactElement, {
        className: clsx(mergedClassName, (children.props as any)?.className),
        ...props
      } as any);
    }

    return (
      <button
        ref={ref}
        className={mergedClassName}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";

