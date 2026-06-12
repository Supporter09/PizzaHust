import { describe, expect, it } from "vitest";

import { etaMinutes } from "./eta";

describe("etaMinutes", () => {
  it("returns minutes until promised time", () => {
    const now = new Date("2026-06-12T10:00:00Z");
    expect(etaMinutes("2026-06-12T10:30:00Z", now)).toBe(30);
  });

  it("returns 0 when promised time is in the past", () => {
    const now = new Date("2026-06-12T11:00:00Z");
    expect(etaMinutes("2026-06-12T10:30:00Z", now)).toBe(0);
  });
});