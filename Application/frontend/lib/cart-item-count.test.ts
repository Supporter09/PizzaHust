import { describe, expect, it } from "vitest";

import { cartItemCount } from "@/lib/cart-item-count";
import type { CartOut } from "@/lib/cart-types";

function cart(lines: CartOut["lines"]): CartOut {
  return {
    csrf_token: "t",
    lines,
    quote: {
      subtotal_vnd: 0,
      delivery_fee_vnd: 0,
      discount_combo_vnd: 0,
      discount_loyalty_vnd: 0,
      total_vnd: 0,
      loyalty: { balance: 0, max_redeemable: 0, redeemed: 0 },
    },
  };
}

describe("cartItemCount", () => {
  it("sums quantity across all lines including unavailable", () => {
    const c = cart([
      {
        line_id: 1,
        kind: "item",
        name: "A",
        descriptor: null,
        image_url: null,
        note: null,
        quantity: 2,
        unit_price_vnd: 100,
        line_total_vnd: 200,
        unavailable: false,
        payload: {},
        picks: null,
      },
      {
        line_id: 2,
        kind: "item",
        name: "B",
        descriptor: null,
        image_url: null,
        note: null,
        quantity: 3,
        unit_price_vnd: null,
        line_total_vnd: null,
        unavailable: true,
        payload: {},
        picks: null,
      },
    ]);
    expect(cartItemCount(c)).toBe(5);
  });

  it("returns 0 for null cart", () => {
    expect(cartItemCount(null)).toBe(0);
  });
});