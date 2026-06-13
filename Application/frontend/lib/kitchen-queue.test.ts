import { describe, expect, it } from "vitest";

import { ageMinutes, isUrgent, statusLabel, URGENT_AFTER_MIN } from "@/lib/kitchen-queue";

describe("kitchen-queue helpers", () => {
  const now = new Date("2026-06-13T10:00:00Z");

  it("ageMinutes floors elapsed minutes from createdAt", () => {
    expect(ageMinutes("2026-06-13T09:48:30Z", now)).toBe(11);
    expect(ageMinutes("2026-06-13T10:00:00Z", now)).toBe(0);
  });

  it("isUrgent only flags Received orders older than the threshold", () => {
    const old = "2026-06-13T09:40:00Z"; // 20 min
    const fresh = "2026-06-13T09:58:00Z"; // 2 min
    const exactly = "2026-06-13T09:50:00Z"; // exactly 10 min — boundary
    expect(isUrgent("Received", old, now)).toBe(true);
    expect(isUrgent("Received", fresh, now)).toBe(false);
    expect(isUrgent("Received", exactly, now)).toBe(true);
    expect(isUrgent("Preparing", old, now)).toBe(false);
    expect(isUrgent("ReadyForDispatch", old, now)).toBe(false);
    expect(URGENT_AFTER_MIN).toBe(10);
  });

  it("statusLabel humanizes the status", () => {
    expect(statusLabel("Received")).toBe("Received");
    expect(statusLabel("Preparing")).toBe("Preparing");
    expect(statusLabel("ReadyForDispatch")).toBe("Ready for Dispatch");
  });
});
