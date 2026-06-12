import { describe, expect, it } from "vitest";

import { sanitizeReturnTo } from "@/lib/sanitize-return-to";

describe("sanitizeReturnTo", () => {
  it("accepts same-origin paths", () => {
    expect(sanitizeReturnTo("/checkout", "/account")).toBe("/checkout");
    expect(sanitizeReturnTo("/track?code=PIZZ-7K2M9Q", "/account")).toBe("/track?code=PIZZ-7K2M9Q");
  });

  it.each([
    "//evil.com",
    "/\\evil.com",
    "https://evil.com",
    "javascript:alert(1)",
    "data:text/html,x",
    "",
    null,
  ])("falls back for %s", (input) => {
    expect(sanitizeReturnTo(input, "/account")).toBe("/account");
  });
});