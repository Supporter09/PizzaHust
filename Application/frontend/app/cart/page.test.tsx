import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import CartPage from "@/app/cart/page";
import type { CartOut } from "@/lib/cart-types";
import { REORDER_NOTICE_KEY } from "@/lib/reorder-flash";

const state = vi.hoisted(() => ({ cart: null as CartOut | null }));

vi.mock("@/components/cart-provider", () => ({
  useCart: () => ({
    cart: state.cart,
    loading: false,
    updateLine: vi.fn(),
    removeLine: vi.fn(),
  }),
}));

const quote: CartOut["quote"] = {
  subtotal_vnd: 150_000,
  delivery_fee_vnd: 0,
  discount_combo_vnd: 0,
  discount_loyalty_vnd: 0,
  total_vnd: 150_000,
  loyalty: { balance: 0, max_redeemable: 0, redeemed: 0 },
};

function nonEmptyCart(): CartOut {
  return {
    csrf_token: "t",
    quote,
    lines: [
      {
        line_id: 1,
        kind: "item",
        quantity: 1,
        note: null,
        payload: { kind: "item", item_id: 1, option_ids: [] },
        name: "Margherita",
        image_url: null,
        descriptor: null,
        picks: null,
        unit_price_vnd: 150_000,
        line_total_vnd: 150_000,
        unavailable: false,
      },
    ],
  };
}

describe("CartPage reorder notice", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    state.cart = nonEmptyCart();
  });
  afterEach(cleanup);

  it("shows the carried notice once, then lets the user dismiss it", () => {
    window.sessionStorage.setItem(
      REORDER_NOTICE_KEY,
      "1 item(s) couldn't be added — 1× Garlic Bread",
    );
    render(<CartPage />);

    expect(screen.getByTestId("cart-reorder-notice")).toHaveTextContent(/couldn't be added/);
    // Consumed from storage so a later reload won't resurrect it.
    expect(window.sessionStorage.getItem(REORDER_NOTICE_KEY)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /dismiss notice/i }));
    expect(screen.queryByTestId("cart-reorder-notice")).toBeNull();
  });

  it("renders no notice when none was stashed", () => {
    render(<CartPage />);
    expect(screen.queryByTestId("cart-reorder-notice")).toBeNull();
  });
});

describe("CartPage option descriptor", () => {
  afterEach(cleanup);

  it("renders each option group on its own line", () => {
    const cart = nonEmptyCart();
    cart.lines[0].descriptor = "Size: S · Crust: cheese-stuffed · Toppings: Chicken";
    state.cart = cart;
    render(<CartPage />);

    // Each "Group: value" must be a separate node, not one " · "-joined line.
    expect(screen.getByText("Size: S")).toBeTruthy();
    expect(screen.getByText("Crust: cheese-stuffed")).toBeTruthy();
    expect(screen.getByText("Toppings: Chicken")).toBeTruthy();
    expect(screen.queryByText(/Size: S · Crust/)).toBeNull();
  });
});
