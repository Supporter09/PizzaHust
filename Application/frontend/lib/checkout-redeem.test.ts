import { describe, expect, it } from "vitest";

import { clampRedeemPoints, effectiveMaxRedeem } from "@/lib/checkout-redeem";

describe("effectiveMaxRedeem", () => {
  it("is the smaller of balance and the 50% cap", () => {
    expect(effectiveMaxRedeem(150, 40)).toBe(40);
    expect(effectiveMaxRedeem(30, 40)).toBe(30);
  });
  it("never goes negative", () => {
    expect(effectiveMaxRedeem(-5, 40)).toBe(0);
  });
});

describe("clampRedeemPoints", () => {
  it("clamps to the effective max", () => {
    expect(clampRedeemPoints(999, 150, 40)).toBe(40);
  });
  it("floors fractional input", () => {
    expect(clampRedeemPoints(12.9, 150, 40)).toBe(12);
  });
  it("treats junk or non-positive as zero", () => {
    expect(clampRedeemPoints(Number.NaN, 150, 40)).toBe(0);
    expect(clampRedeemPoints(-3, 150, 40)).toBe(0);
  });
});
