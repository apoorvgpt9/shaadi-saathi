import type { ComponentProps } from "react";

const VARIANTS = {
  primary: "bg-maroon text-white hover:bg-maroon-deep disabled:bg-sand disabled:text-muted",
  secondary: "border border-line bg-surface text-ink hover:bg-sand disabled:text-muted",
  ghost: "text-muted hover:bg-sand hover:text-ink disabled:opacity-60",
} as const;

interface Props extends ComponentProps<"button"> {
  variant?: keyof typeof VARIANTS;
}

export function Button({ variant = "secondary", className = "", type = "button", ...rest }: Props) {
  return (
    <button
      type={type}
      className={`inline-flex min-h-10 shrink-0 items-center justify-center whitespace-nowrap gap-2 rounded-md px-4 text-sm font-medium transition-[background-color,transform] duration-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:active:scale-100 ${VARIANTS[variant]} ${className}`}
      {...rest}
    />
  );
}
