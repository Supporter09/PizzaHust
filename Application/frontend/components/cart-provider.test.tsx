import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

import { AuthProvider } from "@/components/auth-provider";
import { CartProvider, useCart } from "@/components/cart-provider";
import type { CartOut } from "@/lib/cart-types";

const { mockApiFetch, MockApiClientError } = vi.hoisted(() => {
  class MockApiClientError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.name = "ApiClientError";
      this.status = status;
    }
  }
  return { mockApiFetch: vi.fn(), MockApiClientError };
});

vi.mock("@/lib/api/client", () => ({
  apiFetch: mockApiFetch,
  ApiClientError: MockApiClientError,
}));

vi.mock("@/lib/api/cart", () => ({
  getCart: vi.fn(),
  addCartLine: vi.fn(),
  patchCartLine: vi.fn(),
  deleteCartLine: vi.fn(),
  clearCart: vi.fn(),
  quoteCart: vi.fn(),
}));

import {
  addCartLine,
  clearCart,
  deleteCartLine,
  getCart,
  patchCartLine,
} from "@/lib/api/cart";

const emptyQuote: CartOut["quote"] = {
  subtotal_vnd: 0,
  delivery_fee_vnd: 0,
  discount_combo_vnd: 0,
  discount_loyalty_vnd: 0,
  total_vnd: 0,
  loyalty: { balance: 0, max_redeemable: 0, redeemed: 0 },
};

function makeCart(lines: CartOut["lines"]): CartOut {
  return { csrf_token: "csrf", lines, quote: emptyQuote };
}

function wrapper({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <CartProvider>{children}</CartProvider>
    </AuthProvider>
  );
}

describe("CartProvider", () => {
  beforeEach(() => {
    mockApiFetch.mockImplementation(async (path: string) => {
      if (path === "/auth/me") {
        throw new MockApiClientError("unauth", 401);
      }
      throw new Error(`unexpected apiFetch ${path}`);
    });
    vi.mocked(getCart).mockReset();
    vi.mocked(addCartLine).mockReset();
    vi.mocked(patchCartLine).mockReset();
    vi.mocked(deleteCartLine).mockReset();
    vi.mocked(clearCart).mockReset();
  });

  it("loads cart on mount and exposes itemCount", async () => {
    vi.mocked(getCart).mockResolvedValue(
      makeCart([
        {
          line_id: 1,
          kind: "item",
          name: "Pizza",
          descriptor: "Size: M",
          image_url: null,
          note: null,
          quantity: 2,
          unit_price_vnd: 1000,
          line_total_vnd: 2000,
          unavailable: false,
          payload: {},
          picks: null,
        },
      ]),
    );

    const { result } = renderHook(() => useCart(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.itemCount).toBe(2);
  });

  it("addLine replaces cart from API response", async () => {
    const afterAdd = makeCart([
      {
        line_id: 10,
        kind: "item",
        name: "Pizza",
        descriptor: null,
        image_url: null,
        note: "crispy",
        quantity: 1,
        unit_price_vnd: 500,
        line_total_vnd: 500,
        unavailable: false,
        payload: {},
        picks: null,
      },
    ]);
    vi.mocked(getCart).mockResolvedValue(makeCart([]));
    vi.mocked(addCartLine).mockResolvedValue(afterAdd);

    const { result } = renderHook(() => useCart(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await result.current.addLine({
      kind: "item",
      item_id: 1,
      quantity: 1,
      note: "crispy",
    });

    await waitFor(() => expect(result.current.itemCount).toBe(1));
    expect(addCartLine).toHaveBeenCalled();
  });

  it("updateLine and removeLine refresh counts", async () => {
    const initial = makeCart([
      {
        line_id: 5,
        kind: "item",
        name: "Pizza",
        descriptor: null,
        image_url: null,
        note: null,
        quantity: 1,
        unit_price_vnd: 100,
        line_total_vnd: 100,
        unavailable: false,
        payload: {},
        picks: null,
      },
    ]);
    const doubled = makeCart([{ ...initial.lines[0], quantity: 2, line_total_vnd: 200 }]);
    const cleared = makeCart([]);

    vi.mocked(getCart).mockResolvedValue(initial);
    vi.mocked(patchCartLine).mockResolvedValue(doubled);
    vi.mocked(deleteCartLine).mockResolvedValue(cleared);

    const { result } = renderHook(() => useCart(), { wrapper });
    await waitFor(() => expect(result.current.itemCount).toBe(1));

    await result.current.updateLine(5, { quantity: 2 });
    await waitFor(() => expect(result.current.itemCount).toBe(2));

    await result.current.removeLine(5);
    await waitFor(() => expect(result.current.itemCount).toBe(0));
  });

  it("counts unavailable lines in itemCount", async () => {
    vi.mocked(getCart).mockResolvedValue(
      makeCart([
        {
          line_id: 99,
          kind: "item",
          name: "Gone",
          descriptor: null,
          image_url: null,
          note: null,
          quantity: 4,
          unit_price_vnd: null,
          line_total_vnd: null,
          unavailable: true,
          payload: {},
          picks: null,
        },
      ]),
    );

    const { result } = renderHook(() => useCart(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.itemCount).toBe(4);
  });

  it("clear empties the cart", async () => {
    vi.mocked(getCart).mockResolvedValue(
      makeCart([
        {
          line_id: 1,
          kind: "item",
          name: "X",
          descriptor: null,
          image_url: null,
          note: null,
          quantity: 3,
          unit_price_vnd: 1,
          line_total_vnd: 3,
          unavailable: false,
          payload: {},
          picks: null,
        },
      ]),
    );
    vi.mocked(clearCart).mockResolvedValue(makeCart([]));

    const { result } = renderHook(() => useCart(), { wrapper });
    await waitFor(() => expect(result.current.itemCount).toBe(3));

    await result.current.clear();
    await waitFor(() => expect(result.current.itemCount).toBe(0));
  });
});