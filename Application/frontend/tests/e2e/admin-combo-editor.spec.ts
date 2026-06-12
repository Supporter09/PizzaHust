import { test, expect, type Page } from "@playwright/test";

import { E2E_ADMIN_PASSWORD, E2E_ADMIN_PHONE, E2E_API_URL, E2E_BASE_URL } from "./env";

async function loginAsAdmin(page: Page) {
  const res = await page.request.post(`${E2E_API_URL}/api/auth/login`, {
    data: { phone_number: E2E_ADMIN_PHONE, password: E2E_ADMIN_PASSWORD },
  });
  expect(res.ok(), "admin seed login should succeed against a seeded stack").toBeTruthy();
}

test.describe("A10 – Admin combo editor", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("combos list shows seeded slot combo with savings badge", async ({ page }) => {
    await page.goto(`${E2E_BASE_URL}/admin/combos`);
    // Cards are no longer one big link; scope by the card heading instead.
    const card = page
      .locator("div.rounded-xl")
      .filter({ has: page.getByRole("heading", { name: "Pick-Any Feast" }) });
    await expect(card).toBeVisible();
    await expect(card).toContainText(/customer's choice/);
    await expect(card.getByRole("link", { name: "Edit" })).toBeVisible();
  });

  test("creates a combo with a choice slot via the picker and deletes it", async ({ page }) => {
    const name = `E2E Slot Combo ${Date.now()}`;
    let comboId: number | null = null;
    try {
      await page.goto(`${E2E_BASE_URL}/admin/combos/new`);
      await page.getByLabel("Combo name").fill(name);
      await page.getByLabel("Combo price").fill("200000");

      await page.getByRole("button", { name: "Add Component" }).click();
      await page.getByRole("button", { name: /Any Pizza — customer's choice/ }).click();
      await page.getByRole("button", { name: "Increase quantity" }).click();

      await page.getByRole("button", { name: "Save Combo" }).click();
      await expect(page).toHaveURL(/\/admin\/combos\/\d+$/);
      comboId = Number(page.url().split("/").pop());

      await expect(page.getByText(/Customer saves/)).toBeVisible();
    } finally {
      if (comboId) {
        await page.request.delete(`${E2E_API_URL}/api/admin/combos/${comboId}`);
      } else {
        const res = await page.request.get(`${E2E_API_URL}/api/admin/combos`);
        if (res.ok()) {
          const all = await res.json();
          const mine = all.find((c: { name: string }) => c.name === name);
          if (mine) await page.request.delete(`${E2E_API_URL}/api/admin/combos/${mine.combo_id}`);
        }
      }
    }
  });
});