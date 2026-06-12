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

test.describe("A5 - Monitor Orders", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("orders page renders with status filter chips", async ({ page }) => {
    await page.goto(`${BASE}/admin/orders`);

    await expect(page.getByRole("heading", { name: "Monitor Orders" })).toBeVisible();
    await expect(page.getByRole("button", { name: /all/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /dispatch pending/i })).toBeVisible();
  });

  test("orders page defaults to today and opens the detail dialog", async ({ page }) => {
    await page.goto(`${BASE}/admin/orders`);

    const today = await page.evaluate(() => {
      const current = new Date();
      const year = current.getFullYear();
      const month = `${current.getMonth() + 1}`.padStart(2, "0");
      const day = `${current.getDate()}`.padStart(2, "0");
      return `${year}-${month}-${day}`;
    });

    await expect(page.getByLabel("From date")).toHaveValue(today);
    await expect(page.getByLabel("To date")).toHaveValue(today);

    // Exact match: the dispatch-failed banner can render a "Review" button.
    await page.locator("tbody").getByRole("button", { name: "View", exact: true }).first().click();

    await expect(page.getByRole("dialog")).toBeVisible();
    // Exact match: a transient "Loading order detail…" element also exists.
    await expect(page.getByText("Order Detail", { exact: true })).toBeVisible();
    await expect(page.getByText(/timeline & notes/i)).toBeVisible();

    // Keyboard a11y: dialog focuses Close on open and closes on Escape.
    await expect(page.getByRole("button", { name: "Close" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });
});
