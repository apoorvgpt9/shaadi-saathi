import { axe } from "vitest-axe";
import { expect, vi } from "vitest";
import type { ApiFailure } from "@/lib/api";
import { TODAY } from "../plan-fixtures";

/** Fixes only `Date`, so user-event and promises keep running on real timers. */
export function freezeToday() {
  vi.useFakeTimers({ toFake: ["Date"] });
  const [y = 0, m = 1, d = 1] = TODAY.split("-").map(Number);
  vi.setSystemTime(new Date(y, m - 1, d, 12));
}

/**
 * The rendered state has no axe violations. `region` is off because a lone component has no page landmarks, and
 * `color-contrast` because jsdom has no layout or canvas to measure it with.
 */
export async function expectAccessible(container: Element) {
  const results = await axe(container, { rules: { region: { enabled: false }, "color-contrast": { enabled: false } } });
  expect(results.violations).toEqual([]);
}

export const ok = <T,>(data: T) => ({ ok: true as const, data });
export const failed = (code: ApiFailure["code"], message = "") => ({ ok: false as const, error: { code, message } });
