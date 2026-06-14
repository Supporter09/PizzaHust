import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import NewItemPage from "./page";

const apiFetch = vi.fn();
vi.mock("@/lib/api/client", () => ({
  apiFetch: (...args: unknown[]) => apiFetch(...args),
  ApiClientError: class extends Error {},
}));

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

vi.mock("@/components/admin/Breadcrumb", () => ({
  default: () => null,
}));

const activeCategories = [
  { category_id: 5, name: "Pizza", description: null, sort_order: 0, is_active: true },
  { category_id: 7, name: "Sides", description: null, sort_order: 1, is_active: true },
];

async function renderPage() {
  await act(async () => {
    render(<NewItemPage />);
  });
}

describe("NewItemPage", () => {
  beforeEach(() => {
    apiFetch.mockReset();
    push.mockReset();
    apiFetch.mockResolvedValue(activeCategories);
  });

  it("loads categories and renders the form fields", async () => {
    await renderPage();
    await waitFor(() => screen.getByRole("option", { name: "Pizza" }));

    expect(screen.getByLabelText("Name")).toBeInTheDocument();
    expect(screen.getByLabelText("Category")).toBeInTheDocument();
    expect(screen.getByLabelText("Price (VND)")).toBeInTheDocument();
    // The Pizza/Side type toggle is gone — an item's nature is its category.
    expect(screen.queryByRole("radiogroup", { name: /dish type/i })).not.toBeInTheDocument();
  });

  it("creates an item without a type field", async () => {
    apiFetch
      .mockReset()
      .mockResolvedValueOnce(activeCategories) // GET /admin/categories
      .mockResolvedValueOnce({ product_id: 42 }); // POST /admin/items

    await renderPage();
    await waitFor(() => screen.getByRole("option", { name: "Pizza" }));

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Margherita" } });
    fireEvent.change(screen.getByLabelText("Category"), { target: { value: "5" } });
    fireEvent.change(screen.getByLabelText("Price (VND)"), { target: { value: "120000" } });

    await act(async () => {
      fireEvent.submit(screen.getByRole("button", { name: /create item/i }).closest("form")!);
    });

    const createCall = apiFetch.mock.calls.find(([url]) => url === "/admin/items");
    expect(createCall).toBeTruthy();
    const body = JSON.parse((createCall![1] as { body: string }).body);
    expect(body).toEqual({ name: "Margherita", category_id: 5, base_price_vnd: 120000 });
    expect(body).not.toHaveProperty("kind");
    expect(push).toHaveBeenCalledWith("/admin/items/42");
  });
});
