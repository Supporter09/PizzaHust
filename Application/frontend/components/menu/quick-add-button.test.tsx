import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { QuickAddButton } from "@/components/menu/quick-add-button";

const addLine = vi.fn();
vi.mock("@/components/cart-provider", () => ({
  useCart: () => ({ addLine }),
}));

afterEach(() => {
  cleanup();
  addLine.mockReset();
});

describe("QuickAddButton", () => {
  it("adds a no-option item to the cart in one click", async () => {
    addLine.mockResolvedValue(undefined);
    render(<QuickAddButton productId={10} name="Chicken Wings" hasPriceOptions={false} />);

    fireEvent.click(screen.getByRole("button", { name: /add chicken wings to cart/i }));

    await waitFor(() =>
      expect(addLine).toHaveBeenCalledWith({ kind: "item", item_id: 10, quantity: 1 }),
    );
  });

  it("routes an item with options to its detail page instead of adding", () => {
    render(<QuickAddButton productId={2} name="Pepperoni Fire" hasPriceOptions={true} />);

    const link = screen.getByRole("link", { name: /choose options for pepperoni fire/i });
    expect(link.getAttribute("href")).toBe("/menu/2");
    expect(screen.queryByRole("button")).toBeNull();
    expect(addLine).not.toHaveBeenCalled();
  });
});
