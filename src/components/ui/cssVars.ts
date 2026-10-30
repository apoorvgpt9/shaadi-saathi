// Builds a `style` value of CSS custom properties, which React's CSSProperties type omits.
import type { CSSProperties } from "react";

/** Custom property names start with two dashes: `{ "--i": 1 }`. */
type CustomProperties = Record<`--${string}`, string | number>;

/** Typed stand-in for a `style` object of CSS variables, so no component needs a cast. */
export function cssVars(vars: CustomProperties): CSSProperties {
  return vars;
}
