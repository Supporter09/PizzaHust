// frontend/lib/checkout-redeem.ts

/** The most points the customer can actually apply: limited by both their balance
 *  and the server's 50%-of-subtotal cap (max_redeemable from the quote). */
export function effectiveMaxRedeem(balance: number, maxRedeemable: number): number {
  return Math.max(0, Math.min(balance, maxRedeemable));
}

/** Floor-clamp a user-entered redeem amount to [0, effectiveMaxRedeem]. */
export function clampRedeemPoints(
  raw: number,
  balance: number,
  maxRedeemable: number,
): number {
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  return Math.min(Math.floor(raw), effectiveMaxRedeem(balance, maxRedeemable));
}
