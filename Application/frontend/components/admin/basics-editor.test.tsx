import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { BasicsEditor } from "./basics-editor";

const apiFetch = vi.fn();
vi.mock("@/lib/api/client", () => ({
  apiFetch: (...args: unknown[]) => apiFetch(...args),
  ApiClientError: class extends Error {},
}));

const item = {
  product_id: 7,
  category_id: 1,
  name: "Margherita Classic",
  base_price_vnd: 125000,
  is_pizza: true,
  is_active: true,
  images: [],
};
const categories = [
  { category_id: 1, name: "Pizza", description: null, sort_order: 0, is_active: true },
  { category_id: 2, name: "Sides", description: null, sort_order: 1, is_active: true },
];

describe("BasicsEditor", () => {
  beforeEach(() => {
    apiFetch.mockReset();
  });

  it("renders the item's current values", () => {
    render(<BasicsEditor item={item} categories={categories} onSaved={() => {}} />);
    expect(screen.getByLabelText("Name")).toHaveValue("Margherita Classic");
    expect(screen.getByLabelText("Price (VND)")).toHaveValue(125000);
    expect(screen.getByLabelText("Active")).toBeChecked();
  });

  it("PATCHes the edited basics on save", async () => {
    apiFetch.mockResolvedValueOnce({ ...item, name: "Margherita" });
    const onSaved = vi.fn();
    render(<BasicsEditor item={item} categories={categories} onSaved={onSaved} />);
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Margherita" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith(
      "/admin/items/7",
      expect.objectContaining({ method: "PATCH" }),
    ));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    const body = JSON.parse(apiFetch.mock.calls[0][1].body);
    expect(body.name).toBe("Margherita");
  });

  it("omits category_id when the category is unchanged (inactive-category safe)", async () => {
    const inactiveCatItem = { ...item, category_id: 9 };
    const cats = [
      { category_id: 9, name: "Retired", description: null, sort_order: 0, is_active: false },
      ...categories,
    ];
    apiFetch.mockResolvedValueOnce({ ...inactiveCatItem });
    render(<BasicsEditor item={inactiveCatItem} categories={cats} onSaved={() => {}} />);
    fireEvent.change(screen.getByLabelText("Price (VND)"), { target: { value: "130000" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(apiFetch).toHaveBeenCalled());
    const body = JSON.parse(apiFetch.mock.calls[0][1].body);
    expect(body).not.toHaveProperty("category_id");
    expect(body.base_price_vnd).toBe(130000);
  });

  it("includes category_id when the category changed", async () => {
    apiFetch.mockResolvedValueOnce({ ...item, category_id: 2 });
    render(<BasicsEditor item={item} categories={categories} onSaved={() => {}} />);
    fireEvent.change(screen.getByLabelText("Category"), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(apiFetch).toHaveBeenCalled());
    const body = JSON.parse(apiFetch.mock.calls[0][1].body);
    expect(body.category_id).toBe(2);
  });
});
