import { test, expect, type Page } from "@playwright/test";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const API_URL = process.env.E2E_API_URL ?? "http://localhost:8000";
const ADMIN_PHONE = process.env.E2E_ADMIN_PHONE ?? "0900000001";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "admin123";

async function loginAsAdmin(page: Page) {
  const res = await page.request.post(`${API_URL}/api/auth/login`, {
    data: { phone_number: ADMIN_PHONE, password: ADMIN_PASSWORD },
  });
  expect(res.ok(), "admin seed login should succeed against a seeded stack").toBeTruthy();
}

test.describe("A7 - Admin Sales Reports", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("reports page renders dashboard controls and stats", async ({ page }) => {
    await page.goto(`${BASE}/admin/reports`);

    await expect(page.getByRole("heading", { name: "Reports & Analytics" })).toBeVisible();
    await expect(page.getByRole("button", { name: /last 7 days/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /last 30 days/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /custom range/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /refresh/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /export csv/i })).toBeVisible();
    await expect(page.getByText("Total Revenue")).toBeVisible();
    await expect(page.getByText("Active Customers")).toBeVisible();
    await expect(page.getByRole("heading", { name: /daily revenue/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /daily orders/i })).toBeVisible();
  });
});
