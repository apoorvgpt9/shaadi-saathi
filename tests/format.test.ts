import { describe, expect, it } from "vitest";
import { addDays, formatDate, formatINR, formatLakh } from "@/lib/format";

describe("formatINR", () => {
  it("groups digits the Indian way", () => {
    expect(formatINR(800_000)).toBe("₹8,00,000");
    expect(formatINR(1_250_000)).toBe("₹12,50,000");
    expect(formatINR(0)).toBe("₹0");
  });
});

describe("formatLakh", () => {
  it("abbreviates to lakh and crore, trimming a zero decimal", () => {
    expect(formatLakh(800_000)).toBe("₹8L");
    expect(formatLakh(958_000)).toBe("₹9.6L");
    expect(formatLakh(12_000_000)).toBe("₹1.2Cr");
    expect(formatLakh(75_000)).toBe("₹75,000");
  });

  it("moves up a unit when rounding reaches it", () => {
    expect(formatLakh(9_995_000)).toBe("₹1Cr");
    expect(formatLakh(9_994_999)).toBe("₹99.9L");
    expect(formatLakh(99_999)).toBe("₹99,999");
    expect(formatLakh(10_000_000)).toBe("₹1Cr");
    expect(formatLakh(100_000)).toBe("₹1L");
  });
});

describe("date helpers", () => {
  it("adds days across month and leap-year boundaries in UTC", () => {
    expect(addDays("2027-03-01", -14)).toBe("2027-02-15");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("formats dates like 15 Feb 2027", () => {
    expect(formatDate("2027-02-15")).toBe("15 Feb 2027");
    expect(formatDate("2026-09-05")).toBe("5 Sep 2026");
  });
});
