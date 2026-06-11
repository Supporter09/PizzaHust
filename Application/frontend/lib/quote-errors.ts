// Closed-reason detection for POST /api/cart/quote failures (CONTRACTS.md cart notes).

import { ApiClientError } from "@/lib/api/client";

function quoteReason(e: unknown): unknown {
  if (!(e instanceof ApiClientError)) return undefined;
  if (typeof e.details !== "object" || e.details === null) return undefined;
  return (e.details as { reason?: unknown }).reason;
}

export function isComboNoLongerActive(e: unknown): boolean {
  return quoteReason(e) === "combo_not_active";
}

// A8 option-rule + combo structural reasons: the selections no longer satisfy the
// catalog (e.g. admin disabled an option or deactivated a slot product mid-session).
const SELECTION_RULE_REASONS = new Set([
  "option_not_available",
  "required_group_missing",
  "single_group_conflict",
  "product_not_in_slot_category",
  "pick_count_mismatch",
  "component_selection_missing",
  "product_mismatch_fixed_component",
]);

export function isSelectionRuleViolation(e: unknown): boolean {
  const reason = quoteReason(e);
  return typeof reason === "string" && SELECTION_RULE_REASONS.has(reason);
}