import { describe, expect, it, vi, beforeEach } from "vitest";

import { fetchCombos } from "@/lib/api/combos";
import { apiFetch } from "@/lib/api/client";

vi.mock("@/lib/api/client", async (orig) => ({
  ...(await orig<typeof import("@/lib/api/client")>()),
  apiFetch: vi.fn(),
}));

describe("fetchCombos", () => {
  beforeEach(() => vi.clearAllMocks());

  it("GETs /combos and returns the parsed list", async () => {
    const resp = [
      {
        combo_id: 1,
        name: "Lunch Duo",
        description: "desc",
        combo_price_vnd: 255000,
        target_group: 2,
        items_total_vnd: 295000,
        savings_vnd: 40000,
        items: [
          { product_id: 1, name: "Margherita", quantity: 2, image_url: null, base_price_vnd: 125000 },
        ],
      },
    ];
    (apiFetch as ReturnType<typeof vi.fn>).mockResolvedValue(resp);

    const out = await fetchCombos();

    expect(apiFetch).toHaveBeenCalledWith("/combos");
    expect(out).toEqual(resp);
  });
});