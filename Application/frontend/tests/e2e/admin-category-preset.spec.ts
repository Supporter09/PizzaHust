import { test, expect, type Page } from "@playwright/test";

import { E2E_ADMIN_PASSWORD, E2E_ADMIN_PHONE, E2E_API_URL, E2E_BASE_URL } from "./env";

async function loginAsAdmin(page: Page) {
  const res = await page.request.post(`${E2E_API_URL}/api/auth/login`, {
    data: { phone_number: E2E_ADMIN_PHONE, password: E2E_ADMIN_PASSWORD },
  });
  expect(res.ok()).toBeTruthy();
}

test.describe("Category option presets", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("Pizza preset shows seeded groups checked and saves", async ({ page }) => {
    const cats = await (await page.request.get(`${E2E_API_URL}/api/admin/categories`)).json();
    const pizza = cats.find((c: { name: string }) => c.name === "Pizza");
    await page.goto(`${E2E_BASE_URL}/admin/categories/${pizza.category_id}/preset`);
    await expect(page.getByRole("heading", { name: /Pizza preset/ })).toBeVisible();
    // Seed gave Pizza a Size/Crust/Toppings preset.
    await expect(page.getByLabel(/Size/)).toBeChecked();
    await page.getByRole("button", { name: "Save preset" }).click();
    await expect(page.getByText("Saved.")).toBeVisible();
  });

  test("creating a pizza seeds the preset options", async ({ page }) => {
    const cats = await (await page.request.get(`${E2E_API_URL}/api/admin/categories`)).json();
    const pizza = cats.find((c: { name: string }) => c.name === "Pizza");
    const name = `E2E Preset Pizza ${Date.now()}`;
    const created = await page.request.post(`${E2E_API_URL}/api/admin/items`, {
      data: { name, category_id: pizza.category_id, base_price_vnd: 99000, kind: "pizza" },
    });
    expect(created.status()).toBe(201);
    const pid = (await created.json()).product_id;
    try {
      const groups = await (
        await page.request.get(`${E2E_API_URL}/api/admin/items/${pid}/options`)
      ).json();
      const enabled = groups.flatMap(
        (g: { options: { enabled: boolean }[] }) => g.options.filter((o) => o.enabled),
      );
      expect(enabled.length).toBeGreaterThan(0);
    } finally {
      await page.request.delete(`${E2E_API_URL}/api/admin/items/${pid}?hard=true`);
    }
  });
});
