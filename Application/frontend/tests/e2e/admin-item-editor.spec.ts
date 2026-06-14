import { test, expect, type Page } from "@playwright/test";

import { E2E_ADMIN_PASSWORD, E2E_ADMIN_PHONE, E2E_API_URL, E2E_BASE_URL } from "./env";

type PizzaTarget = { product_id: number; name: string; category_id: number };

async function loginAsAdmin(page: Page) {
  const res = await page.request.post(`${E2E_API_URL}/api/auth/login`, {
    data: { phone_number: E2E_ADMIN_PHONE, password: E2E_ADMIN_PASSWORD },
  });
  expect(res.ok(), "admin seed login should succeed against a seeded stack").toBeTruthy();
}

// Resolve a real, active, seeded Pizza dish from the API instead of hardcoding a
// name. Active is required: the customer menu and the admin list (default
// active=true filter) only surface active dishes, and prior runs can soft-delete
// individual seed dishes. The `A9 …`/`E2E …` prefixes are test debris — skip them.
async function activePizza(page: Page): Promise<PizzaTarget> {
  const catRes = await page.request.get(`${E2E_API_URL}/api/admin/categories`);
  expect(catRes.ok()).toBeTruthy();
  const categories: { category_id: number; name: string }[] = await catRes.json();
  const pizzaCat = categories.find((c) => c.name === "Pizza");
  expect(pizzaCat, "seed should have a Pizza category").toBeTruthy();
  const res = await page.request.get(
    `${E2E_API_URL}/api/admin/items?category_id=${pizzaCat!.category_id}&active=true`,
  );
  expect(res.ok()).toBeTruthy();
  const items: PizzaTarget[] = await res.json();
  const target = items.find((i) => !/^(A9|E2E)\b/.test(i.name));
  expect(target, "seed should have at least one active, non-test pizza dish").toBeTruthy();
  return target as PizzaTarget;
}

async function openDishEditor(page: Page, dish: PizzaTarget) {
  await page.goto(`${E2E_BASE_URL}/admin/items`);
  await page.getByRole("link", { name: dish.name, exact: true }).click();
  await expect(page.getByRole("heading", { name: "Edit Dish", exact: true })).toBeVisible();
  // Basics editor is pre-filled with the dish name.
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue(dish.name);
}

async function openCustomizer(page: Page, dish: PizzaTarget) {
  await page.goto(`${E2E_BASE_URL}/menu`);
  // Cards expose two links (cover + title) with the same accessible name.
  await page.getByRole("link", { name: dish.name, exact: true }).first().click();
  await expect(page.getByRole("heading", { name: dish.name, exact: true })).toBeVisible();
}

test.describe("A8 – Admin dish editor options", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("editor shows the dish's category option groups with enable toggles", async ({ page }) => {
    const dish = await activePizza(page);
    await openDishEditor(page, dish);
    // A Pizza dish surfaces exactly the Pizza category's groups: Size/Crust/Toppings.
    await expect(page.getByRole("radiogroup", { name: "Size selection type" })).toBeVisible();
    await expect(page.getByRole("radiogroup", { name: "Crust selection type" })).toBeVisible();
    await expect(page.getByRole("radiogroup", { name: "Toppings selection type" })).toBeVisible();
  });

  test("toggling an option off hides it from the customer customizer", async ({ page }) => {
    // Hermetic: operate on a dedicated temp option so failed runs never poison
    // the shared seed data (or parallel specs reading the same dish).
    const dish = await activePizza(page);
    const pid = dish.product_id;
    // Option groups are owned by a category. The temp group must belong to the
    // dish's own category (Pizza) to show up on this dish's editor + customizer.
    const groupRes = await page.request.post(`${E2E_API_URL}/api/admin/option-groups`, {
      data: {
        name: `E2E Sauce ${Date.now()}`,
        category_id: dish.category_id,
        select_type: "multi",
        required: false,
        sort_order: 99,
      },
    });
    expect(groupRes.status(), await groupRes.text()).toBe(201);
    const group = await groupRes.json();
    try {
      const optRes = await page.request.post(
        `${E2E_API_URL}/api/admin/option-groups/${group.group_id}/options`,
        { data: { name: "E2E Dip", price_delta_vnd: 5000, sort_order: 1 } },
      );
      expect(optRes.status(), await optRes.text()).toBe(201);
      const opt = await optRes.json();
      const enabledRes = await page.request.get(`${E2E_API_URL}/api/admin/items/${pid}/options`);
      expect(enabledRes.ok()).toBeTruthy();
      const enabledGroups = await enabledRes.json();
      const enabledIds = enabledGroups.flatMap(
        (g: { options: { option_id: number; enabled: boolean }[] }) =>
          g.options.filter((o) => o.enabled).map((o) => o.option_id),
      );
      const putRes = await page.request.put(`${E2E_API_URL}/api/admin/items/${pid}/options`, {
        data: { option_ids: [...enabledIds, opt.option_id] },
      });
      expect(putRes.status(), await putRes.text()).toBe(200);

      // Customer sees the enabled temp option.
      await openCustomizer(page, dish);
      await expect(page.getByRole("checkbox", { name: /E2E Dip/ })).toBeVisible();

      // Admin toggles it off in the dish editor UI.
      await openDishEditor(page, dish);
      const dip = page.getByRole("switch", { name: "E2E Dip" });
      await dip.click();
      await expect(dip).toHaveAttribute("aria-checked", "false");

      // Customer no longer sees it.
      await openCustomizer(page, dish);
      await expect(page.getByRole("group", { name: "Toppings" })).toBeVisible();
      await expect(page.getByRole("checkbox", { name: /E2E Dip/ })).toHaveCount(0);
    } finally {
      await page.request.delete(`${E2E_API_URL}/api/admin/option-groups/${group.group_id}`);
    }
  });

  test("adding a category appears in the editor and can be removed", async ({ page }) => {
    const dish = await activePizza(page);
    await openDishEditor(page, dish);
    const name = `E2E Extras ${Date.now()}`;
    await page.getByRole("button", { name: "+ Add Category" }).click();
    await page.getByLabel("Category name", { exact: true }).fill(name);
    await page.getByRole("button", { name: "Create", exact: true }).click();
    const nameInput = page.getByRole("textbox", { name: `${name} category name` });
    await expect(nameInput).toBeVisible();

    // Clean up via the UI confirm flow, scoped to this group's card so leftover
    // groups from other runs can never be the delete target.
    const card = page.locator("div.rounded-xl").filter({ has: nameInput });
    await card.getByRole("button", { name: "Delete category" }).click();
    await card.getByRole("button", { name: "Confirm", exact: true }).click();
    await expect(nameInput).toHaveCount(0);
  });
});
