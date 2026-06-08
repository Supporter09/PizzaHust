import { test, expect, type Page } from "@playwright/test";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
// Auth is the backend's concern, not the frontend origin. The page bundle calls
// the API at NEXT_PUBLIC_API_BASE_URL (:8000); the direct login below must hit the
// same backend origin or it 404s against the Next.js server.
const API_URL = process.env.E2E_API_URL ?? "http://localhost:8000";
const ADMIN_PHONE = process.env.E2E_ADMIN_PHONE ?? "0900000001";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "admin123";

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
  });
});

test.describe("A5 – Monitor Orders", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("orders page renders with status filter chips", async ({ page }) => {
    await page.goto(`${BASE}/admin/orders`);
    await expect(page.getByRole("heading", { name: "Monitor Orders" })).toBeVisible();
    await expect(page.getByRole("button", { name: /all/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /dispatch pending/i })).toBeVisible();
  });
});
