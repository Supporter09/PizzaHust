import { describe, expect, it } from "vitest";

import { effectiveMaxRedeem, parseRedeemEntry } from "@/lib/checkout-redeem";

describe("effectiveMaxRedeem", () => {
  it("is the smaller of balance and the 50% cap", () => {
    expect(effectiveMaxRedeem(150, 40)).toBe(40);
    expect(effectiveMaxRedeem(30, 40)).toBe(30);
  });
  it("never goes negative", () => {
    expect(effectiveMaxRedeem(-5, 40)).toBe(0);
  });
});

describe("parseRedeemEntry", () => {
  it("accepts a value within the effective max", () => {
    expect(parseRedeemEntry("40", 150, 40)).toEqual({ points: 40, error: null });
    expect(parseRedeemEntry("10", 150, 40)).toEqual({ points: 10, error: null });
  });
  it("floors fractional input", () => {
    expect(parseRedeemEntry("12.9", 150, 40)).toEqual({ points: 12, error: null });
  });
  it("rejects an amount over the 50% cap with an error, not a silent clamp", () => {
    const r = parseRedeemEntry("999", 150, 40);
    expect(r.points).toBe(0);
    expect(r.error).toMatch(/at most 40 points/);
  });
  it("rejects an amount over the balance", () => {
    const r = parseRedeemEntry("100", 30, 40);
    expect(r.points).toBe(0);
    expect(r.error).toMatch(/at most 30 points/);
  });
  it("uses the singular form when the max is exactly one", () => {
    expect(parseRedeemEntry("5", 1, 40).error).toMatch(/at most 1 point\b/);
  });
  it("treats empty, non-positive, or junk input as zero with no error", () => {
    expect(parseRedeemEntry("", 150, 40)).toEqual({ points: 0, error: null });
    expect(parseRedeemEntry("-3", 150, 40)).toEqual({ points: 0, error: null });
    expect(parseRedeemEntry("abc", 150, 40)).toEqual({ points: 0, error: null });
  });
});
