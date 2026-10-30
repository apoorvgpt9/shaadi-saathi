import { describe, expect, it } from "vitest";
import { clientIp } from "@/lib/ai/client-ip";

function requestWith(headers: Record<string, string>) {
  return new Request("http://localhost/api/x", { headers });
}

describe("clientIp", () => {
  it.each([
    [
      "x-real-ip wins over x-forwarded-for",
      { "x-real-ip": "1.1.1.1", "x-forwarded-for": "2.2.2.2" },
      "1.1.1.1",
    ],
    [
      "the first x-forwarded-for entry is used",
      { "x-forwarded-for": " 2.2.2.2 , 3.3.3.3" },
      "2.2.2.2",
    ],
    [
      "an empty x-real-ip falls through",
      { "x-real-ip": "", "x-forwarded-for": "2.2.2.2" },
      "2.2.2.2",
    ],
    ["an empty x-forwarded-for gives unknown", { "x-forwarded-for": " , 3.3.3.3" }, "unknown"],
    ["no headers gives unknown", {}, "unknown"],
  ])("%s", (_name, headers, expected) => {
    expect(clientIp(requestWith(headers))).toBe(expected);
  });
});
