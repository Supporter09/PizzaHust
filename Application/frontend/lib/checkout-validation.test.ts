import { describe, expect, it } from "vitest";

import { isValidVnPhone } from "./checkout-validation";

describe("isValidVnPhone", () => {
  it("accepts valid 10-digit 09x", () => {
    expect(isValidVnPhone("0912345678")).toBe(true);
  });

  it("rejects 11 digits", () => {
    expect(isValidVnPhone("09123456789")).toBe(false);
  });

  it("rejects leading 02", () => {
    expect(isValidVnPhone("0212345678")).toBe(false);
  });

  it("rejects non-digits", () => {
    expect(isValidVnPhone("09abc45678")).toBe(false);
  });
});