import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import NewItemPage from "./page";

const apiFetch = vi.fn();
vi.mock("@/lib/api/client", () => ({
  apiFetch: (...args: unknown[]) => apiFetch(...args),
  ApiClientError: class extends Error {},
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
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

describe("NewItemPage — preset discoverability link", () => {
  beforeEach(() => {
    apiFetch.mockReset();
    apiFetch.mockResolvedValue(activeCategories);
  });

  it("renders plain helper text when no category is selected", async () => {
    await renderPage();
    // Wait for categories to load so the component is fully settled
    await waitFor(() => screen.getByRole("option", { name: "Pizza" }));
    // The helper text should be present
    expect(screen.getByText(/pizzas get size\/crust\/topping options/i)).toBeInTheDocument();
    // No preset link should exist yet (still on default "Select…")
    expect(screen.queryByRole("link", { name: /preset/i })).not.toBeInTheDocument();
  });

  it("shows a link to the category preset page after selecting a category", async () => {
    await renderPage();
    await waitFor(() => screen.getByRole("option", { name: "Pizza" }));

    fireEvent.change(screen.getByLabelText("Category"), { target: { value: "5" } });

    const link = screen.getByRole("link", { name: /pizza preset/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/admin/categories/5/preset");
  });

  it("updates the preset link when a different category is selected", async () => {
    await renderPage();
    await waitFor(() => screen.getByRole("option", { name: "Sides" }));

    fireEvent.change(screen.getByLabelText("Category"), { target: { value: "7" } });

    const link = screen.getByRole("link", { name: /sides preset/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/admin/categories/7/preset");
  });
});
