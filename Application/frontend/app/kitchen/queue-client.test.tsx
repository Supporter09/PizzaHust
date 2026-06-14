import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { QueueClient } from "@/app/kitchen/queue-client";
import { ApiClientError } from "@/lib/api/client";
import type { KitchenTicket } from "@/lib/api/kitchen";

const { listKitchenOrders, acceptKitchenOrder, markKitchenOrderReady } = vi.hoisted(() => ({
  listKitchenOrders: vi.fn(),
  acceptKitchenOrder: vi.fn(),
  markKitchenOrderReady: vi.fn(),
}));

vi.mock("@/lib/api/kitchen", async (orig) => ({
  ...(await orig<typeof import("@/lib/api/kitchen")>()),
  listKitchenOrders,
  acceptKitchenOrder,
  markKitchenOrderReady,
}));

function ticket(over: Partial<KitchenTicket> = {}): KitchenTicket {
  return {
    order_id: 1,
    order_code: "PIZZ-AAA111",
    status: "Received",
    created_at: new Date().toISOString(),
    promised_at: new Date(Date.now() + 1.2e6).toISOString(),
    priority_score: 0,
    delivery_note: null,
    items: [{ display_name: "Margherita", quantity: 1, options: [], note: null, children: [] }],
    ...over,
  };
}

describe("QueueClient — K2 accept", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    acceptKitchenOrder.mockResolvedValue(undefined);
  });

  // vitest is configured without `globals`, so @testing-library/react's
  // auto-cleanup (which registers via a global `afterEach`) never fires.
  // These tests query the shared document.body by role/testid, so unmount
  // explicitly to keep them isolated.
  afterEach(cleanup);

  it("shows Accept Order on a Received card and calls the mutator on click", async () => {
    listKitchenOrders.mockResolvedValue([ticket({ status: "Received" })]);
    render(<QueueClient />);

    const btn = await screen.findByRole("button", { name: /accept order/i });
    fireEvent.click(btn);

    expect(acceptKitchenOrder).toHaveBeenCalledWith(1);
    await waitFor(() => expect(listKitchenOrders).toHaveBeenCalledTimes(2)); // initial + post-action refresh
  });

  it("does not render Accept Order on a Preparing card", async () => {
    listKitchenOrders.mockResolvedValue([ticket({ status: "Preparing" })]);
    render(<QueueClient />);
    await screen.findByTestId("kitchen-ticket");
    expect(screen.queryByRole("button", { name: /accept order/i })).toBeNull();
  });

  it("on a 409 (stale) swallows the error and reconciles via refetch", async () => {
    listKitchenOrders.mockResolvedValue([ticket({ status: "Received" })]);
    acceptKitchenOrder.mockRejectedValue(new ApiClientError("conflict", 409));
    render(<QueueClient />);

    fireEvent.click(await screen.findByRole("button", { name: /accept order/i }));

    await waitFor(() => expect(listKitchenOrders).toHaveBeenCalledTimes(2)); // initial + reconcile
    expect(screen.queryByTestId("kitchen-action-error")).toBeNull();
  });

  it("on a 5xx/network failure shows an inline per-card error and does NOT refetch", async () => {
    listKitchenOrders.mockResolvedValue([ticket({ status: "Received" })]);
    acceptKitchenOrder.mockRejectedValue(new ApiClientError("boom", 500));
    render(<QueueClient />);

    fireEvent.click(await screen.findByRole("button", { name: /accept order/i }));

    expect(await screen.findByTestId("kitchen-action-error")).toBeTruthy();
    expect(listKitchenOrders).toHaveBeenCalledTimes(1); // card left in place, no reconcile
  });
});

describe("QueueClient — K3 mark ready", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(cleanup);

  it("shows Mark Ready on a Preparing card and calls the mutator", async () => {
    listKitchenOrders.mockResolvedValue([ticket({ status: "Preparing" })]);
    markKitchenOrderReady.mockResolvedValue({ status: "ReadyForDispatch" });
    render(<QueueClient />);

    const btn = await screen.findByRole("button", { name: /mark ready for dispatch/i });
    fireEvent.click(btn);

    expect(markKitchenOrderReady).toHaveBeenCalledWith(1);
    await waitFor(() => expect(listKitchenOrders).toHaveBeenCalledTimes(2));
  });

  it("surfaces a queue-level deferred notice that survives the card leaving the queue", async () => {
    // After DispatchPending the order is excluded from the queue, so the post-action
    // refetch returns []. A card-local notice would unmount with the card; the
    // queue-level notice must persist.
    listKitchenOrders.mockResolvedValueOnce([ticket({ status: "Preparing" })]).mockResolvedValue([]);
    markKitchenOrderReady.mockResolvedValue({ status: "DispatchPending" });
    render(<QueueClient />);

    fireEvent.click(await screen.findByRole("button", { name: /mark ready for dispatch/i }));

    expect(await screen.findByTestId("kitchen-dispatch-deferred")).toBeTruthy();
    await waitFor(() => expect(screen.queryByTestId("kitchen-ticket")).toBeNull()); // card dropped out
    expect(screen.getByTestId("kitchen-dispatch-deferred")).toBeTruthy(); // notice persists
  });

  it("on a 5xx/network failure shows an inline per-card error and leaves the card", async () => {
    listKitchenOrders.mockResolvedValue([ticket({ status: "Preparing" })]);
    markKitchenOrderReady.mockRejectedValue(new ApiClientError("boom", 500));
    render(<QueueClient />);

    fireEvent.click(await screen.findByRole("button", { name: /mark ready for dispatch/i }));

    expect(await screen.findByTestId("kitchen-action-error")).toBeTruthy();
    expect(listKitchenOrders).toHaveBeenCalledTimes(1); // no reconcile on 5xx
  });

  it("does not render Mark Ready on a ReadyForDispatch card (K4 deferred)", async () => {
    listKitchenOrders.mockResolvedValue([ticket({ status: "ReadyForDispatch", delivery_note: "ring twice" })]);
    render(<QueueClient />);
    await screen.findByTestId("kitchen-ticket");
    expect(screen.queryByRole("button", { name: /mark ready for dispatch/i })).toBeNull();
  });
});
