import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import AccountPage from "@/app/account/page";

const { listMyOrders, getLoyaltyMe, authUser } = vi.hoisted(() => ({
  listMyOrders: vi.fn(),
  getLoyaltyMe: vi.fn(),
  authUser: {
    user_id: 1,
    full_name: "John Doe",
    phone_number: "0901234567",
    address: "123 Main St",
    avatar_url: null,
    email: null,
    role: "customer",
  } as Record<string, unknown>,
}));

vi.mock("@/lib/api/orders", async (orig) => ({
  ...(await orig<typeof import("@/lib/api/orders")>()),
  listMyOrders,
}));
vi.mock("@/lib/api/loyalty", async (orig) => ({
  ...(await orig<typeof import("@/lib/api/loyalty")>()),
  getLoyaltyMe,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/components/auth-provider", () => ({ useAuth: () => ({ user: authUser, loading: false }) }));

describe("AccountPage dashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listMyOrders.mockResolvedValue([{ order_code: "PIZZ-A" }, { order_code: "PIZZ-B" }]);
    getLoyaltyMe.mockResolvedValue({ current_points: 150, total_points_earned: 200, redeemable_value_vnd: 150000 });
  });
  afterEach(cleanup);

  it("shows name, total orders, points, and quick-action links", async () => {
    render(<AccountPage />);
    await waitFor(() => {
      expect(screen.getByText("John Doe")).toBeInTheDocument();
      expect(screen.getByText("2")).toBeInTheDocument();
      expect(screen.getByText("150")).toBeInTheDocument();
    });
    expect(screen.getByRole("link", { name: /edit profile/i })).toHaveAttribute("href", "/account/edit");
    expect(screen.getByRole("link", { name: /order history/i })).toHaveAttribute("href", "/account/orders");
    expect(screen.getByRole("link", { name: /loyalty points/i })).toHaveAttribute("href", "/account/loyalty");
  });

  it("hides the email row when email is absent", async () => {
    render(<AccountPage />);
    await waitFor(() => expect(screen.getByText("John Doe")).toBeInTheDocument());
    expect(screen.queryByText(/@/)).not.toBeInTheDocument();
  });
});
