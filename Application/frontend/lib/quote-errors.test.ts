import { describe, expect, it } from "vitest";

import { ApiClientError } from "@/lib/api/client";
import { isComboNoLongerActive, isSelectionRuleViolation } from "@/lib/quote-errors";

describe("isComboNoLongerActive", () => {
  it("matches a VALIDATION_FAILED quote error with reason combo_not_active", () => {
    const e = new ApiClientError("quote failed", 400, "VALIDATION_FAILED", {
      reason: "combo_not_active",
      combo_id: 9,
    });
    expect(isComboNoLongerActive(e)).toBe(true);
  });

  it("rejects other closed reasons", () => {
    const e = new ApiClientError("quote failed", 400, "VALIDATION_FAILED", {
      reason: "pick_count_mismatch",
    });
    expect(isComboNoLongerActive(e)).toBe(false);
  });

  it("rejects errors without details and non-API errors", () => {
    expect(isComboNoLongerActive(new ApiClientError("boom", 500))).toBe(false);
    expect(isComboNoLongerActive(new Error("boom"))).toBe(false);
  });
});

describe("isSelectionRuleViolation", () => {
  it.each([
    "option_not_available",
    "required_group_missing",
    "single_group_conflict",
    "product_not_in_slot_category",
    "pick_count_mismatch",
    "component_selection_missing",
    "product_mismatch_fixed_component",
  ])("matches closed reason %s", (reason) => {
    const e = new ApiClientError("quote failed", 400, "VALIDATION_FAILED", { reason });
    expect(isSelectionRuleViolation(e)).toBe(true);
  });

  it("rejects combo_not_active (handled separately) and non-API errors", () => {
    const e = new ApiClientError("quote failed", 400, "VALIDATION_FAILED", {
      reason: "combo_not_active",
    });
    expect(isSelectionRuleViolation(e)).toBe(false);
    expect(isSelectionRuleViolation(new Error("boom"))).toBe(false);
  });
});