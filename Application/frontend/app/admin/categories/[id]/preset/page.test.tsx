import { Suspense } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import CategoryPresetPage from "./page";

const apiFetch = vi.fn();
vi.mock("@/lib/api/client", () => ({
  apiFetch: (...args: unknown[]) => apiFetch(...args),
  ApiClientError: class extends Error {},
}));

const category = {
  category_id: 3,
  name: "Pizza",
  description: null,
  sort_order: 0,
  is_active: true,
};

const groups = [
  {
    category_id: 3,
    group_id: 11,
    name: "Crust",
    select_type: "single" as const,
    required: true,
    sort_order: 0,
    options: [
      { option_id: 101, group_id: 11, name: "Thin", description: null, price_delta_vnd: 0, sort_order: 0 },
      { option_id: 102, group_id: 11, name: "Thick", description: null, price_delta_vnd: 10000, sort_order: 1 },
    ],
  },
  {
    category_id: 3,
    group_id: 12,
    name: "Toppings",
    select_type: "multi" as const,
    required: false,
    sort_order: 1,
    options: [],
  },
];

// The route hands the page `params` as a Promise (Next 16 App Router); the page
// unwraps it with `use()`, which suspends. Render under a Suspense boundary and
// flush the resolved promise inside `act` so the page (not the fallback) commits.
async function renderPage() {
  await act(async () => {
    render(
      <Suspense fallback={null}>
        <CategoryPresetPage params={Promise.resolve({ id: "3" })} />
      </Suspense>,
    );
  });
}

// Default happy-path: category load + option-groups load.
function mockInitialLoad() {
  apiFetch.mockImplementation((path: string) => {
    if (path === "/admin/categories/3") return Promise.resolve(category);
    if (path === "/admin/categories/3/option-groups") return Promise.resolve(groups);
    return Promise.resolve(undefined);
  });
}

describe("CategoryPresetPage", () => {
  beforeEach(() => {
    apiFetch.mockReset();
  });

  it("loads the category and its option groups, rendering each group with its options", async () => {
    mockInitialLoad();
    await renderPage();

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Pizza preset" })).toBeInTheDocument(),
    );
    expect(apiFetch).toHaveBeenCalledWith("/admin/categories/3/option-groups");

    // Group names rendered as editable inputs.
    expect(screen.getByLabelText("Crust category name")).toHaveValue("Crust");
    expect(screen.getByLabelText("Toppings category name")).toHaveValue("Toppings");
    // Options of the first group rendered.
    expect(screen.getByLabelText("Thin name")).toHaveValue("Thin");
    expect(screen.getByLabelText("Thick name")).toHaveValue("Thick");
  });

  it("renders NO per-option enable switch (preset has no toggle)", async () => {
    mockInitialLoad();
    await renderPage();
    await waitFor(() => expect(screen.getByLabelText("Thin name")).toBeInTheDocument());
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
  });

  it("PATCHes the group when toggling single/multi", async () => {
    mockInitialLoad();
    await renderPage();
    await waitFor(() => expect(screen.getByLabelText("Toppings category name")).toBeInTheDocument());

    // Toppings is multi; switch it to single.
    const radios = screen.getAllByRole("radio", { name: "Single" });
    // second group's "Single" control
    fireEvent.click(radios[1]);

    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith(
        "/admin/option-groups/12",
        expect.objectContaining({ method: "PATCH" }),
      ),
    );
    const call = apiFetch.mock.calls.find(
      (c) => c[0] === "/admin/option-groups/12" && c[1]?.method === "PATCH",
    );
    expect(JSON.parse(call![1].body)).toEqual({ select_type: "single" });
  });

  it("PATCHes the group when toggling Required", async () => {
    mockInitialLoad();
    await renderPage();
    await waitFor(() => expect(screen.getByLabelText("Crust category name")).toBeInTheDocument());

    // Crust is required; uncheck it.
    const requiredBoxes = screen.getAllByLabelText("Required");
    fireEvent.click(requiredBoxes[0]);

    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith(
        "/admin/option-groups/11",
        expect.objectContaining({ method: "PATCH" }),
      ),
    );
    const call = apiFetch.mock.calls.find(
      (c) => c[0] === "/admin/option-groups/11" && c[1]?.method === "PATCH",
    );
    expect(JSON.parse(call![1].body)).toEqual({ required: false });
  });

  it("adds an option via POST to the group", async () => {
    mockInitialLoad();
    await renderPage();
    await waitFor(() => expect(screen.getByLabelText("New option name for Crust")).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText("New option name for Crust"), {
      target: { value: "Stuffed" },
    });
    fireEvent.change(screen.getByLabelText("New option price delta for Crust"), {
      target: { value: "15000" },
    });
    fireEvent.click(screen.getAllByRole("button", { name: "+ Add option" })[0]);

    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith(
        "/admin/option-groups/11/options",
        expect.objectContaining({ method: "POST" }),
      ),
    );
    const call = apiFetch.mock.calls.find(
      (c) => c[0] === "/admin/option-groups/11/options" && c[1]?.method === "POST",
    );
    const body = JSON.parse(call![1].body);
    expect(body.name).toBe("Stuffed");
    expect(body.price_delta_vnd).toBe(15000);
  });

  it("deletes an option via DELETE", async () => {
    mockInitialLoad();
    await renderPage();
    await waitFor(() => expect(screen.getByLabelText("Thin name")).toBeInTheDocument());

    // OptionRow shows a "Delete" button, then "Confirm".
    fireEvent.click(screen.getAllByRole("button", { name: "Delete" })[0]);
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));

    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith(
        "/admin/options/101",
        expect.objectContaining({ method: "DELETE" }),
      ),
    );
  });

  it("'+ Add Category' creates a group with the route's category_id", async () => {
    mockInitialLoad();
    await renderPage();
    await waitFor(() => expect(screen.getByRole("button", { name: "+ Add Category" })).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "+ Add Category" }));
    fireEvent.change(screen.getByLabelText("Category name"), { target: { value: "Sauce" } });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith(
        "/admin/option-groups",
        expect.objectContaining({ method: "POST" }),
      ),
    );
    const call = apiFetch.mock.calls.find(
      (c) => c[0] === "/admin/option-groups" && c[1]?.method === "POST",
    );
    const body = JSON.parse(call![1].body);
    expect(body.category_id).toBe(3);
    expect(body.name).toBe("Sauce");
  });
});
