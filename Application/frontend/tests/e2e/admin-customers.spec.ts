import { test, expect, type Page } from "@playwright/test";

import {
  E2E_ADMIN_PASSWORD,
  E2E_ADMIN_PHONE,
  E2E_API_URL,
  E2E_BASE_URL,
} from "./env";

const BASE = E2E_BASE_URL;
const API_URL = E2E_API_URL;
const ADMIN_PHONE = E2E_ADMIN_PHONE;
const ADMIN_PASSWORD = E2E_ADMIN_PASSWORD;

async function loginAsAdmin(page: Page) {
  // Authenticate via the API; the cookie is shared with the page context.
  const res = await page.request.post(`${API_URL}/api/auth/login`, {
    data: { phone_number: ADMIN_PHONE, password: ADMIN_PASSWORD },
  });
  expect(res.ok(), "admin seed login should succeed against a seeded stack").toBeTruthy();
}

test.describe("Admin auth guard", () => {
  test("unauthenticated access redirects to login", async ({ page }) => {
    await page.goto(`${BASE}/admin/customers`);
    await expect(page).toHaveURL(/\/login/);
  });
});
test.describe("A6 – Admin Customer Accounts", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("customers page renders table", async ({ page }) => {
    await page.goto(`${BASE}/admin/customers`);
    await expect(page.getByRole("heading", { name: "Customer Accounts" })).toBeVisible();
    await expect(page.getByPlaceholder(/search/i)).toBeVisible();
    await expect(page.getByText("Error: HTTP 404")).toHaveCount(0);
    await expect(page.getByText("No customers found")).toHaveCount(0);
  });
});
