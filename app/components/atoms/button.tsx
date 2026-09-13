import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const variants = {
  primary: "border-white/20 bg-primary-500 text-white shadow-button-primary hover:bg-primary-400",
  neutral: "border-neutral-950 bg-neutral-800 text-white shadow-button-neutral hover:bg-neutral-700",
  secondary: "border-white bg-neutral-50 text-neutral-950 shadow-button-secondary hover:bg-white",
} as const;

const sizes = {
  md: "h-[52px] px-6 text-body-md font-semibold",
  sm: "h-10 px-3 text-body-sm font-semibold",
} as const;

type VariantProps = {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
};

type ButtonAsLink = VariantProps &
  AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string;
  };

type ButtonAsButton = VariantProps &
  ButtonHTMLAttributes<HTMLButtonElement> & {
    href?: undefined;
  };

export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  href,
  ...props
}: ButtonAsLink | ButtonAsButton) {
  const classes = cn(
    "inline-flex shrink-0 items-center justify-center overflow-clip whitespace-nowrap rounded-sm border transition-colors disabled:cursor-not-allowed disabled:opacity-50",
    variants[variant],
    sizes[size],
    className,
  );

  if (href) {
    return (
      <a href={href} className={classes} {...(props as AnchorHTMLAttributes<HTMLAnchorElement>)}>
        <span className="px-1">{children}</span>
      </a>
    );
  }

  return (
    <button type="button" className={classes} {...(props as ButtonHTMLAttributes<HTMLButtonElement>)}>
      <span className="px-1">{children}</span>
    </button>
  );
}
