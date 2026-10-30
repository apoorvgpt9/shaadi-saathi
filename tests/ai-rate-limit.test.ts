import { describe, expect, it } from "vitest";
import { createRateLimiter } from "@/lib/ai/rate-limit";

function limiterWithClock(options: { limit: number; windowMs: number; maxTracked: number }) {
  const clock = { time: 0 };
  const limiter = createRateLimiter({ ...options, now: () => clock.time });
  return { limiter, clock };
}

describe("createRateLimiter", () => {
  it("allows up to the limit, then blocks", () => {
    const { limiter } = limiterWithClock({ limit: 2, windowMs: 1000, maxTracked: 10 });
    expect(limiter.isLimited("a")).toBe(false);
    expect(limiter.isLimited("a")).toBe(false);
    expect(limiter.isLimited("a")).toBe(true);
  });

  it("tracks each key separately", () => {
    const { limiter } = limiterWithClock({ limit: 1, windowMs: 1000, maxTracked: 10 });
    expect(limiter.isLimited("a")).toBe(false);
    expect(limiter.isLimited("a")).toBe(true);
    expect(limiter.isLimited("b")).toBe(false);
  });

  it("allows requests again once the window has passed", () => {
    const { limiter, clock } = limiterWithClock({ limit: 1, windowMs: 1000, maxTracked: 10 });
    expect(limiter.isLimited("a")).toBe(false);
    clock.time = 999;
    expect(limiter.isLimited("a")).toBe(true);
    clock.time = 1000;
    expect(limiter.isLimited("a")).toBe(false);
  });

  it("does not count rejected requests against the window", () => {
    const { limiter, clock } = limiterWithClock({ limit: 1, windowMs: 1000, maxTracked: 10 });
    expect(limiter.isLimited("a")).toBe(false);
    clock.time = 900;
    expect(limiter.isLimited("a")).toBe(true);
    clock.time = 1000;
    expect(limiter.isLimited("a")).toBe(false);
  });

  it("drops idle keys when too many are tracked, keeping active ones", () => {
    const { limiter, clock } = limiterWithClock({ limit: 1, windowMs: 1000, maxTracked: 2 });
    limiter.isLimited("idle");
    clock.time = 1500;
    limiter.isLimited("active");
    limiter.isLimited("new");
    expect(limiter.isLimited("active")).toBe(true);
    expect(limiter.isLimited("idle")).toBe(false);
  });

  it("clears every counter when all tracked keys are still active", () => {
    const { limiter } = limiterWithClock({ limit: 1, windowMs: 1000, maxTracked: 2 });
    limiter.isLimited("a");
    limiter.isLimited("b");
    limiter.isLimited("c");
    expect(limiter.isLimited("a")).toBe(false);
  });
});
