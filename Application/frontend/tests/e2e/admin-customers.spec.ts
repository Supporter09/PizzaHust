import { test, expect } from "@playwright/test";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";

test.describe("A6 – Admin Customer Accounts", () => {
  test("customers page renders table", async ({ page }) => {
    await page.goto(`${BASE}/admin/customers`);
    await expect(page.getByRole("heading", { name: "Customer Accounts" })).toBeVisible();
    await expect(page.getByPlaceholder(/search/i)).toBeVisible();
  });
});

test.describe("A5 – Monitor Orders", () => {
  test("orders page renders with status filter chips", async ({ page }) => {
    await page.goto(`${BASE}/admin/orders`);
    await expect(page.getByRole("heading", { name: "Monitor Orders" })).toBeVisible();
    await expect(page.getByRole("button", { name: /all/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /dispatch pending/i })).toBeVisible();
  });
});
