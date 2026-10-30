// The app's one button, with its visual variants.
import type { ComponentProps, ReactElement } from "react";

const VARIANTS = {
  primary: "bg-maroon text-white hover:bg-maroon-deep disabled:bg-sand disabled:text-muted",
  secondary: "border border-line bg-surface text-ink hover:bg-sand disabled:text-muted",
  ghost: "text-muted hover:bg-sand hover:text-ink disabled:opacity-60",
} as const;

interface Props extends ComponentProps<"button"> {
  /** Visual weight: primary for the one main action, ghost for quiet ones. Defaults to secondary. */
  variant?: keyof typeof VARIANTS;
}

/** A button that defaults to type="button", so it never submits a form by accident. Extra classes append to its own. */
export function Button({ variant = "secondary", className = "", type = "button", ...rest }: Props): ReactElement {
  return (
    <button
      type={type}
      className={`inline-flex min-h-10 shrink-0 items-center justify-center whitespace-nowrap gap-2 rounded-md px-4 text-sm font-medium transition-[background-color,transform] duration-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:active:scale-100 ${VARIANTS[variant]} ${className}`}
      {...rest}
    />
  );
}
