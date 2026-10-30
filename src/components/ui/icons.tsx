// Inline SVG icons and the app mark, at one 1.75 stroke. Decorative: pair with visible text.
import type { ReactElement } from "react";

const PATHS = {
  send: "M12 19V5M5 12l7-7 7 7",
  check: "M5 12.5l4.5 4.5L19 7.5",
  alert: "M12 4l9 16H3L12 4zM12 10v4M12 17v.01",
  edit: "M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4",
  retry: "M20 12a8 8 0 1 1-2.6-5.9M20 4v5h-5",
  clock: "M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z",
} as const;

/**
 * One of the app's line icons, sized by `className`. Hidden from assistive tech, so pair it with
 * visible text.
 */
export function Icon({
  name,
  className = "size-4",
}: {
  name: keyof typeof PATHS;
  className?: string;
}): ReactElement {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}

/** Two interlocking rings: the app mark. */
export function Mark({ className = "size-7" }: { className?: string }): ReactElement {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      strokeWidth="2.25"
      aria-hidden="true"
      className={className}
    >
      <circle cx="12.5" cy="16" r="8" stroke="var(--maroon)" />
      <circle cx="19.5" cy="16" r="8" stroke="var(--marigold)" />
    </svg>
  );
}
