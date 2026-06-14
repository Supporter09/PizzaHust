import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import SettingsPage from "./page";

const apiFetch = vi.fn();
vi.mock("@/lib/api/client", () => ({
  apiFetch: (...args: unknown[]) => apiFetch(...args),
  ApiClientError: class extends Error {},
}));

const settings = {
  timezone: "Asia/Ho_Chi_Minh",
  loyalty_accrual_rate: 10000,
  loyalty_redeem_value_vnd: 1000,
  loyalty_max_redeem_pct: 0.5,
};
const wardFees = {
  wards: [
    { ward: "Ba Dinh", fee_vnd: 15000 },
    { ward: "Hoan Kiem", fee_vnd: 20000 },
  ],
};

function mockMount() {
  apiFetch.mockImplementation((path: string) =>
    path.includes("ward-fees")
      ? Promise.resolve(wardFees)
      : Promise.resolve(settings),
  );
}

describe("Admin SettingsPage", () => {
  beforeEach(() => {
    apiFetch.mockReset();
  });

  it("loads both endpoints on mount and renders current values", async () => {
    mockMount();
    render(<SettingsPage />);

    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith("/admin/settings"));
    expect(apiFetch).toHaveBeenCalledWith("/admin/settings/ward-fees");

    await waitFor(() =>
      expect(screen.getByLabelText("Timezone")).toHaveValue("Asia/Ho_Chi_Minh"),
    );
    expect(screen.getByLabelText("Loyalty accrual rate")).toHaveValue(10000);
    expect(screen.getByLabelText("Redeem value (VND per point)")).toHaveValue(1000);
    expect(screen.getByLabelText("Max redeem percent")).toHaveValue(0.5);

    expect(screen.getByDisplayValue("Ba Dinh")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Hoan Kiem")).toBeInTheDocument();
  });

  it("PUTs edited loyalty settings on save", async () => {
    mockMount();
    render(<SettingsPage />);
    await waitFor(() =>
      expect(screen.getByLabelText("Timezone")).toHaveValue("Asia/Ho_Chi_Minh"),
    );

    apiFetch.mockResolvedValueOnce({ ...settings, loyalty_accrual_rate: 12000 });
    fireEvent.change(screen.getByLabelText("Loyalty accrual rate"), {
      target: { value: "12000" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save settings" }));

    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith(
        "/admin/settings",
        expect.objectContaining({ method: "PUT" }),
      ),
    );
    const call = apiFetch.mock.calls.find(
      (c) => c[0] === "/admin/settings" && c[1]?.method === "PUT",
    );
    const body = JSON.parse(call![1].body);
    expect(body.loyalty_accrual_rate).toBe(12000);
    expect(body.timezone).toBe("Asia/Ho_Chi_Minh");
  });

  it("PUTs edited ward fee on save", async () => {
    mockMount();
    render(<SettingsPage />);
    await waitFor(() => expect(screen.getByDisplayValue("Ba Dinh")).toBeInTheDocument());

    apiFetch.mockResolvedValueOnce({
      wards: [
        { ward: "Ba Dinh", fee_vnd: 18000 },
        { ward: "Hoan Kiem", fee_vnd: 20000 },
      ],
    });
    fireEvent.change(screen.getByLabelText("Fee for Ba Dinh"), {
      target: { value: "18000" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save delivery fees" }));

    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith(
        "/admin/settings/ward-fees",
        expect.objectContaining({ method: "PUT" }),
      ),
    );
    const call = apiFetch.mock.calls.find(
      (c) => c[0] === "/admin/settings/ward-fees" && c[1]?.method === "PUT",
    );
    const body = JSON.parse(call![1].body);
    expect(body.wards).toContainEqual({ ward: "Ba Dinh", fee_vnd: 18000 });
  });

  it("adds and removes ward rows, and includes a new ward on save", async () => {
    mockMount();
    render(<SettingsPage />);
    await waitFor(() => expect(screen.getByDisplayValue("Ba Dinh")).toBeInTheDocument());

    const list = screen.getByRole("list", { name: "Ward delivery fees" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(2);

    // Remove the second existing row.
    fireEvent.click(within(list).getAllByRole("button", { name: /remove/i })[1]);
    expect(within(list).getAllByRole("listitem")).toHaveLength(1);

    // Add a fresh blank row.
    fireEvent.click(screen.getByRole("button", { name: "Add ward" }));
    const rows = within(list).getAllByRole("listitem");
    expect(rows).toHaveLength(2);

    const newRow = rows[1];
    fireEvent.change(within(newRow).getByLabelText(/ward name/i), {
      target: { value: "Dong Da" },
    });
    fireEvent.change(within(newRow).getByLabelText(/fee/i), {
      target: { value: "25000" },
    });

    apiFetch.mockResolvedValueOnce({
      wards: [
        { ward: "Ba Dinh", fee_vnd: 15000 },
        { ward: "Dong Da", fee_vnd: 25000 },
      ],
    });
    fireEvent.click(screen.getByRole("button", { name: "Save delivery fees" }));

    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith(
        "/admin/settings/ward-fees",
        expect.objectContaining({ method: "PUT" }),
      ),
    );
    const call = apiFetch.mock.calls.find(
      (c) => c[0] === "/admin/settings/ward-fees" && c[1]?.method === "PUT",
    );
    const body = JSON.parse(call![1].body);
    expect(body.wards).toContainEqual({ ward: "Dong Da", fee_vnd: 25000 });
    expect(body.wards).not.toContainEqual(
      expect.objectContaining({ ward: "Hoan Kiem" }),
    );
  });
});
