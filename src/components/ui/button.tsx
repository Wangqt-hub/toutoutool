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
  "inline-flex items-center justify-center font-medium rounded-2xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-accent-brown disabled:opacity-50 disabled:cursor-not-allowed";

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-accent-brown text-cream-50 hover:bg-[#b0936d] ring-offset-cream-50",
  secondary:
    "bg-blush text-slate-800 hover:bg-[#ffd0cb] ring-offset-cream-50",
  ghost:
    "bg-transparent text-accent-brown hover:bg-cream-100 ring-offset-cream-50"
};

const sizeClasses: Record<Size, string> = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2 text-sm",
  lg: "px-6 py-3 text-base"
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

