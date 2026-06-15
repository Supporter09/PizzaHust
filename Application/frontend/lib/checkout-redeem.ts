/** The most points the customer can actually apply: limited by both their balance
 * and the server's 50%-of-subtotal cap (max_redeemable from the quote). */
export function effectiveMaxRedeem(balance: number, maxRedeemable: number): number {
  return Math.max(0, Math.min(balance, maxRedeemable));
}

export interface RedeemEntry {
  /** Points to apply — 0 when the field is empty or invalid. */
  points: number;
  /** Why the entry was rejected, or null when it is acceptable. */
  error: string | null;
}

/** Validate a user-entered redeem amount against the effective max.
 * Empty / non-positive / junk input means "no redemption" (0 points, no error).
 * An amount above the effective max is rejected with a message — never silently
 * clamped — so the customer is told the limit instead of having their entry quietly
 * changed. The server enforces the same limit as the authoritative backstop. */
export function parseRedeemEntry(
  raw: string,
  balance: number,
  maxRedeemable: number,
): RedeemEntry {
  const max = effectiveMaxRedeem(balance, maxRedeemable);
  const points = Number.parseInt(raw, 10);
  if (!Number.isFinite(points) || points <= 0) {
    return { points: 0, error: null };
  }
  if (points > max) {
    return {
      points: 0,
      error: `You can redeem at most ${max} ${max === 1 ? "point" : "points"} on this order.`,
    };
  }
  return { points, error: null };
}
