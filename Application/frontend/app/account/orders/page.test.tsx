import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import OrdersPage from "@/app/account/orders/page";
import type { MyOrderSummaryOut } from "@/lib/api/orders";

const { listMyOrders, authUser } = vi.hoisted(() => ({
  listMyOrders: vi.fn(),
  authUser: { user_id: 1, full_name: "Hana" },
}));

vi.mock("@/lib/api/orders", async (orig) => ({
  ...(await orig<typeof import("@/lib/api/orders")>()),
  listMyOrders,
}));

const routerPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPush }),
}));

vi.mock("@/components/cart-provider", () => ({
  useCart: () => ({ refresh: vi.fn() }),
}));

vi.mock("@/components/auth-provider", () => ({
  useAuth: () => ({ user: authUser, loading: false }),
}));

function row(code: string): MyOrderSummaryOut {
  return {
    order_code: code,
    created_at: "2026-04-02T05:00:00Z",
    status: "Delivered",
    total_vnd: 215_000,
    item_summary: ["1× BBQ Chicken (Large)"],
  };
}

describe("OrdersPage", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(cleanup);

  it("renders the empty state when there are no orders", async () => {
    listMyOrders.mockResolvedValue([]);
    render(<OrdersPage />);
    await waitFor(() => {
      expect(screen.getByText(/no orders yet/i)).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /browse menu/i })).toHaveAttribute("href", "/menu");
    });
  });

  it("shows back link above the title per layout", async () => {
    listMyOrders.mockResolvedValue([]);
    render(<OrdersPage />);
    await waitFor(() => expect(screen.getByTestId("orders-back-link")).toBeInTheDocument());
    expect(screen.getByTestId("orders-back-link")).toHaveAttribute("href", "/account");
    expect(screen.getByRole("heading", { name: /order history/i })).toBeInTheDocument();
  });

  it("renders one card per order", async () => {
    listMyOrders.mockResolvedValue([row("PIZZ-A1"), row("PIZZ-A2")]);
    render(<OrdersPage />);
    await waitFor(() => expect(screen.getAllByTestId("order-history-card")).toHaveLength(2));
    expect(listMyOrders).toHaveBeenCalledWith(1, 20);
  });

  it("shows an error when the list request fails", async () => {
    listMyOrders.mockRejectedValue(new Error("network"));
    render(<OrdersPage />);
    await waitFor(() =>
      expect(screen.getByTestId("orders-list-error")).toHaveTextContent(
        /couldn't load your orders/i,
      ),
    );
    expect(screen.queryByTestId("orders-list-loading")).not.toBeInTheDocument();
  });

  it("Load more fetches and appends the next page", async () => {
    listMyOrders.mockImplementation((page: number) => {
      if (page === 1) {
        return Promise.resolve(Array.from({ length: 20 }, (_, i) => row(`PIZZ-P${i}`)));
      }
      if (page === 2) {
        return Promise.resolve([row("PIZZ-LAST")]);
      }
      return Promise.resolve([]);
    });
    render(<OrdersPage />);
    await waitFor(() => expect(screen.getAllByTestId("order-history-card")).toHaveLength(20));
    await waitFor(() => expect(screen.getByTestId("orders-load-more")).toBeInTheDocument());
    fireEvent.click(screen.getByTestId("orders-load-more"));
    await waitFor(() => expect(screen.getAllByTestId("order-history-card")).toHaveLength(21));
    expect(listMyOrders).toHaveBeenLastCalledWith(2, 20);
  });
});