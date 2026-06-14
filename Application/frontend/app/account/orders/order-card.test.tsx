import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { OrderCard } from "@/app/account/orders/order-card";
import { ApiClientError } from "@/lib/api/client";
import type { MyOrderDetailOut, MyOrderSummaryOut } from "@/lib/api/orders";
import type { CartOut } from "@/lib/cart-types";

const { getMyOrder, reorder } = vi.hoisted(() => ({
  getMyOrder: vi.fn(),
  reorder: vi.fn(),
}));

vi.mock("@/lib/api/orders", async (orig) => ({
  ...(await orig<typeof import("@/lib/api/orders")>()),
  getMyOrder,
  reorder,
}));

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

const refresh = vi.fn();
vi.mock("@/components/cart-provider", () => ({
  useCart: () => ({ refresh }),
}));

function summary(over: Partial<MyOrderSummaryOut> = {}): MyOrderSummaryOut {
  return {
    order_code: "PIZZ-7K2M9Q",
    created_at: "2026-04-28T10:00:00Z",
    status: "Delivered",
    total_vnd: 277_000,
    item_summary: ["1× Margherita (M)", "1× Family Feast"],
    ...over,
  };
}

const emptyQuote: CartOut["quote"] = {
  subtotal_vnd: 0,
  delivery_fee_vnd: 0,
  discount_combo_vnd: 0,
  discount_loyalty_vnd: 0,
  total_vnd: 0,
  loyalty: { balance: 0, max_redeemable: 0, redeemed: 0 },
};

function detail(over: Partial<MyOrderDetailOut> = {}): MyOrderDetailOut {
  return {
    order_code: "PIZZ-7K2M9Q",
    created_at: "2026-04-28T10:00:00Z",
    status: "Delivered",
    recipient_name: "Alex",
    delivery_address: "12 Hang Bong, Hoan Kiem",
    delivery_note: null,
    promised_at: "2026-04-28T10:45:00Z",
    lines: [
      {
        kind: "item",
        display_name: "Margherita",
        quantity: 1,
        line_total_vnd: 150_000,
        options: ["Size: M"],
        note: null,
        children: [],
      },
    ],
    subtotal_vnd: 250_000,
    delivery_fee_vnd: 27_000,
    savings_vnd: 0,
    total_vnd: 277_000,
    timeline: [{ status: "Received", at: "2026-04-28T10:00:00Z" }],
    ...over,
  };
}

describe("OrderCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    refresh.mockResolvedValue(undefined);
  });

  afterEach(cleanup);

  it("renders summary fields and formatted total", () => {
    render(<OrderCard summary={summary()} />);

    expect(screen.getByTestId("order-history-card")).toHaveAttribute(
      "data-order-code",
      "PIZZ-7K2M9Q",
    );
    expect(screen.getByText(/Order #PIZZ-7K2M9Q/)).toBeInTheDocument();
    expect(screen.getByText("1× Margherita (M)")).toBeInTheDocument();
    expect(screen.getByText("277.000₫")).toBeInTheDocument();
    expect(screen.getByText("Delivered")).toBeInTheDocument();
  });

  it("expands with lazy fetch and caches detail on second open", async () => {
    getMyOrder.mockResolvedValue(detail());
    render(<OrderCard summary={summary()} />);

    fireEvent.click(screen.getByTestId("order-details-toggle"));
    await waitFor(() => expect(screen.getByTestId("order-detail-panel")).toBeInTheDocument());
    expect(getMyOrder).toHaveBeenCalledTimes(1);
    expect(getMyOrder).toHaveBeenCalledWith("PIZZ-7K2M9Q");
    expect(screen.getByText(/Deliver to:/)).toBeInTheDocument();
    expect(screen.getByText("277.000₫", { selector: "dd" })).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("order-details-toggle"));
    expect(screen.queryByTestId("order-detail-panel")).toBeNull();

    fireEvent.click(screen.getByTestId("order-details-toggle"));
    expect(screen.getByTestId("order-detail-panel")).toBeInTheDocument();
    expect(getMyOrder).toHaveBeenCalledTimes(1);
  });

  it("reorder happy path refreshes cart and navigates to /cart", async () => {
    reorder.mockResolvedValue({
      added_count: 2,
      unavailable: [],
      cart: { csrf_token: "t", lines: [], quote: emptyQuote },
    });
    render(<OrderCard summary={summary()} />);

    fireEvent.click(screen.getByTestId("order-reorder"));

    await waitFor(() => expect(reorder).toHaveBeenCalledWith("PIZZ-7K2M9Q"));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    await waitFor(() => expect(push).toHaveBeenCalledWith("/cart"));
    expect(screen.queryByTestId("order-reorder-notice")).toBeNull();
  });

  it("reorder partial unavailable shows banner then navigates", async () => {
    reorder.mockResolvedValue({
      added_count: 1,
      unavailable: [{ description: "1× Garlic Bread", reason: "item_unavailable" }],
      cart: { csrf_token: "t", lines: [], quote: emptyQuote },
    });
    render(<OrderCard summary={summary()} />);

    fireEvent.click(screen.getByTestId("order-reorder"));

    await waitFor(() =>
      expect(screen.getByTestId("order-reorder-notice")).toHaveTextContent(
        /1 item\(s\) couldn't be added/,
      ),
    );
    await waitFor(() => expect(push).toHaveBeenCalledWith("/cart"));
  });

  it("reorder all unavailable does not navigate", async () => {
    reorder.mockResolvedValue({
      added_count: 0,
      unavailable: [
        { description: "1× Garlic Bread", reason: "item_unavailable" },
        { description: "1× BBQ Chicken (L)", reason: "option_changed" },
      ],
      cart: { csrf_token: "t", lines: [], quote: emptyQuote },
    });
    render(<OrderCard summary={summary()} />);

    fireEvent.click(screen.getByTestId("order-reorder"));

    await waitFor(() =>
      expect(screen.getByTestId("order-reorder-notice")).toHaveTextContent(/Nothing could be added/),
    );
    expect(push).not.toHaveBeenCalled();
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });
});