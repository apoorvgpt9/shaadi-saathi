import { describe, expect, it } from "vitest";
import { addDays, daysBetween, formatDate, formatINR, formatLakh } from "@/lib/format";

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
});

describe("date helpers", () => {
  it("adds days across month and leap-year boundaries in UTC", () => {
    expect(addDays("2027-03-01", -14)).toBe("2027-02-15");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("counts whole days between dates", () => {
    expect(daysBetween("2026-10-29", "2027-03-01")).toBe(123);
    expect(daysBetween("2027-03-01", "2026-10-29")).toBe(-123);
  });

  it("formats dates like 15 Feb 2027", () => {
    expect(formatDate("2027-02-15")).toBe("15 Feb 2027");
    expect(formatDate("2026-09-05")).toBe("5 Sep 2026");
  });
});
