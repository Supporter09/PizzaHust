import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import LoyaltyPage from "@/app/account/loyalty/page";

const { getLoyaltyMe, getLoyaltyHistory, getLoyaltyConfig } = vi.hoisted(() => ({
  getLoyaltyMe: vi.fn(),
  getLoyaltyHistory: vi.fn(),
  getLoyaltyConfig: vi.fn(),
}));

vi.mock("@/lib/api/loyalty", () => ({ getLoyaltyMe, getLoyaltyHistory, getLoyaltyConfig }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/components/auth-provider", () => ({
  useAuth: () => ({ user: { user_id: 1, full_name: "John" }, loading: false }),
}));

describe("LoyaltyPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getLoyaltyMe.mockResolvedValue({
      current_points: 150,
      pending_points: 20,
      total_points_earned: 200,
      redeemable_value_vnd: 150000,
    });
    getLoyaltyConfig.mockResolvedValue({ accrual_rate: 10000, redeem_value_vnd: 1000, max_redeem_pct: 0.5 });
  });
  afterEach(cleanup);

  it("renders balance and earn history", async () => {
    getLoyaltyHistory.mockResolvedValue([
      { label: "Order PIZZ-AAAAAA", date: "2026-04-03T00:00:00Z", points_delta: 51, kind: "earn" },
    ]);
    render(<LoyaltyPage />);
    await waitFor(() => {
      expect(screen.getByText("150")).toBeInTheDocument();
      expect(screen.getByText(/pending reservations/i)).toBeInTheDocument();
      expect(screen.getByText("Order PIZZ-AAAAAA")).toBeInTheDocument();
      expect(screen.getByText(/\+51/)).toBeInTheDocument();
    });
  });

  it("shows an empty state when there is no history", async () => {
    getLoyaltyHistory.mockResolvedValue([]);
    render(<LoyaltyPage />);
    await waitFor(() => expect(screen.getByText(/no points activity yet/i)).toBeInTheDocument());
  });
});
