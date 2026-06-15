import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import CheckoutPage from "@/app/checkout/page";

const { checkoutQuote, placeOrder } = vi.hoisted(() => ({
  checkoutQuote: vi.fn(),
  placeOrder: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn() }) }));
vi.mock("@/components/auth-provider", () => ({
  useAuth: () => ({
    user: {
      user_id: 1,
      full_name: "John Doe",
      phone_number: "0901234567",
      address: "123 Main St",
      avatar_url: null,
      role: "customer",
    },
  }),
}));
vi.mock("@/components/cart-provider", () => ({
  useCart: () => ({
    cart: {
      lines: [
        {
          line_id: 1,
          quantity: 1,
          name: "Margherita",
          descriptor: null,
          line_total_vnd: 125000,
        },
      ],
    },
    loading: false,
    refresh: vi.fn(),
  }),
}));
vi.mock("@/lib/api/config", () => ({
  getDeliveryConfig: () => Promise.resolve({ service_area: ["Ba Dinh"] }),
}));
vi.mock("@/lib/api/cart", () => ({ checkoutQuote }));
vi.mock("@/lib/api/orders", () => ({ placeOrder }));

describe("CheckoutPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    checkoutQuote.mockResolvedValue({
      subtotal_vnd: 125000,
      discount_combo_vnd: 0,
      discount_loyalty_vnd: 40000,
      delivery_fee_vnd: 22000,
      total_vnd: 107000,
      loyalty: { balance: 120, redeemed: 40, max_redeemable: 40 },
    });
    placeOrder.mockResolvedValue({ order_code: "PIZZ-TEST01", total_vnd: 107000, status: "Received", promised_at: "2026-06-15T00:00:00Z" });
  });

  afterEach(cleanup);

  it("quotes and submits with redeemed loyalty points", async () => {
    render(<CheckoutPage />);

    await waitFor(() => expect(screen.getByLabelText(/points to redeem/i)).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText(/ward/i), { target: { value: "Ba Dinh" } });
    fireEvent.change(screen.getByLabelText(/street address/i), { target: { value: "1 Pho Hue" } });
    fireEvent.change(screen.getByLabelText(/points to redeem/i), { target: { value: "40" } });
    fireEvent.click(screen.getByRole("button", { name: /apply/i }));

    await waitFor(() =>
      expect(checkoutQuote).toHaveBeenLastCalledWith(
        expect.objectContaining({
          address: { administrative_unit: "Ba Dinh", street: "1 Pho Hue" },
          redeem_points: 40,
        }),
      ),
    );
    await waitFor(() => expect(screen.getByRole("button", { name: /place order/i })).toBeEnabled());

    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: "John Doe" } });
    fireEvent.change(screen.getByLabelText(/phone number/i), { target: { value: "0901234567" } });
    fireEvent.click(screen.getByRole("button", { name: /place order/i }));

    await waitFor(() =>
      expect(placeOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          redeem_points: 40,
          recipient_name: "John Doe",
        }),
      ),
    );
  });
});
