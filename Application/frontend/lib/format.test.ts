import { describe, expect, it } from "vitest";

import { formatVnd } from "./format";

describe("formatVnd", () => {
  it("formats zero", () => {
    expect(formatVnd(0)).toBe("0₫");
  });

  it("formats thousands with vi-VN grouping", () => {
    expect(formatVnd(15000)).toBe("15.000₫");
  });

  it("formats large amounts", () => {
    expect(formatVnd(1234567)).toBe("1.234.567₫");
  });
});