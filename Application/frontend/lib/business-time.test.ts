import { describe, expect, it } from "vitest";

import { DEFAULT_BUSINESS_TZ, formatInBusinessTz } from "./business-time";

describe("formatInBusinessTz", () => {
  it("renders a UTC instant in the business timezone, not UTC or browser-local", () => {
    // 15:26 UTC is 22:26 in Asia/Ho_Chi_Minh (+07) — the GMT vs GMT+7 case.
    const out = formatInBusinessTz("2026-06-15T15:26:00Z", "Asia/Ho_Chi_Minh", {
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    expect(out).toMatch(/22[:.]26/);
  });

  it("tracks the configured zone (UTC shows the raw wall clock)", () => {
    const out = formatInBusinessTz("2026-06-15T15:26:00Z", "UTC", {
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    expect(out).toMatch(/15[:.]26/);
  });

  it("defaults the business zone to Hanoi", () => {
    expect(DEFAULT_BUSINESS_TZ).toBe("Asia/Ho_Chi_Minh");
  });
});
