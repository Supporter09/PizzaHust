import { test, expect, type Page } from "@playwright/test";

import { E2E_ADMIN_PASSWORD, E2E_ADMIN_PHONE, E2E_API_URL, E2E_BASE_URL } from "./env";

async function loginAsAdmin(page: Page) {
  const res = await page.request.post(`${E2E_API_URL}/api/auth/login`, {
    data: { phone_number: E2E_ADMIN_PHONE, password: E2E_ADMIN_PASSWORD },
  });
  expect(res.ok(), "admin seed login should succeed").toBeTruthy();
}

test.describe("Admin menu management list", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("admin link is visible in the top nav", async ({ page }) => {
    await page.goto(`${E2E_BASE_URL}/`);
    await expect(page.getByRole("link", { name: "Admin", exact: true })).toBeVisible();
  });

  test("tabs include All plus seeded categories", async ({ page }) => {
    await page.goto(`${E2E_BASE_URL}/admin/items`);
    await expect(page.getByRole("tab", { name: "All" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Pizza" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Side Dishes" })).toBeVisible();
  });

  test("Add New Item navigates to the create page", async ({ page }) => {
    await page.goto(`${E2E_BASE_URL}/admin/items`);
    await page.getByRole("link", { name: "Add New Item" }).click();
    await expect(page).toHaveURL(/\/admin\/items\/new$/);
    await expect(page.getByRole("heading", { name: "Add New Item" })).toBeVisible();
  });

  test("deleting an item hides its row; Show inactive reveals it", async ({ page }) => {
    // Hermetic: create a throwaway product via API, delete it through the UI.
    const cats = await (await page.request.get(`${E2E_API_URL}/api/admin/categories`)).json();
    const pizzaCat = cats.find((c: { name: string }) => c.name === "Pizza");
    const name = `E2E Temp ${Date.now()}`;
    const created = await page.request.post(`${E2E_API_URL}/api/admin/items`, {
      data: { name, category_id: pizzaCat.category_id, base_price_vnd: 1000, kind: "pizza" },
    });
    expect(created.status(), await created.text()).toBe(201);

    await page.goto(`${E2E_BASE_URL}/admin/items`);
    const row = page.getByRole("row", { name: new RegExp(name) });
    await expect(row).toBeVisible();
    await row.getByRole("button", { name: `Delete ${name}` }).click();
    await row.getByRole("button", { name: "Confirm", exact: true }).click();
    await expect(page.getByRole("row", { name: new RegExp(name) })).toHaveCount(0);

    // Reveal inactive and delete forever to clean up.
    await page.getByLabel("Show inactive").check();
    const inactiveRow = page.getByRole("row", { name: new RegExp(name) });
    await expect(inactiveRow).toBeVisible();
    await inactiveRow.getByRole("button", { name: "Delete forever" }).click();
    await expect(inactiveRow.getByRole("button", { name: "Cancel" })).toBeVisible();
    await inactiveRow.getByRole("button", { name: "Delete forever" }).click();
    await expect(page.getByRole("row", { name: new RegExp(name) })).toHaveCount(0);
  });
});
