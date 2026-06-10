import { describe, expect, it, vi, beforeEach } from "vitest";

import { quoteCart } from "@/lib/api/cart";
import { ApiClientError, apiFetch } from "@/lib/api/client";

vi.mock("@/lib/api/client", async (orig) => ({
  ...(await orig<typeof import("@/lib/api/client")>()),
  apiFetch: vi.fn(),
}));

describe("quoteCart", () => {
  beforeEach(() => vi.clearAllMocks());

  it("POSTs /cart/quote with a JSON body and returns the parsed quote", async () => {
    const resp = {
      subtotal_vnd: 190000,
      discount_combo_vnd: 0,
      discount_loyalty_vnd: 0,
      delivery_fee_vnd: 0,
      total_vnd: 190000,
      loyalty: { balance: 0, redeemed: 0, max_redeemable: 0 },
    };
    (apiFetch as ReturnType<typeof vi.fn>).mockResolvedValue(resp);

    const body = {
      redeem_points: 0,
      lines: [{ kind: "item" as const, item_id: 1, option_ids: [2, 3], quantity: 1 }],
    };
    const out = await quoteCart(body);

    expect(apiFetch).toHaveBeenCalledWith("/cart/quote", {
      method: "POST",
      body: JSON.stringify(body),
    });
    expect(out).toEqual(resp);
  });

  it("propagates ApiClientError from the wrapper", async () => {
    const err = new ApiClientError("Invalid request.", 400, "VALIDATION_FAILED");
    (apiFetch as ReturnType<typeof vi.fn>).mockRejectedValue(err);

    await expect(
      quoteCart({
        redeem_points: 0,
        lines: [{ kind: "item" as const, item_id: 1, quantity: 1 }],
      }),
    ).rejects.toBe(err);
  });
});