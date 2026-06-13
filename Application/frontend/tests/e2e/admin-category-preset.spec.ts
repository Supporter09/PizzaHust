import { test, expect, type Page } from "@playwright/test";

import { E2E_ADMIN_PASSWORD, E2E_ADMIN_PHONE, E2E_API_URL, E2E_BASE_URL } from "./env";

async function loginAsAdmin(page: Page) {
  const res = await page.request.post(`${E2E_API_URL}/api/auth/login`, {
    data: { phone_number: E2E_ADMIN_PHONE, password: E2E_ADMIN_PASSWORD },
  });
  expect(res.ok()).toBeTruthy();
}

async function categoryId(page: Page, name: string): Promise<number> {
  const cats = await (await page.request.get(`${E2E_API_URL}/api/admin/categories`)).json();
  const cat = cats.find((c: { name: string }) => c.name === name);
  expect(cat, `seed should contain a "${name}" category`).toBeTruthy();
  return cat.category_id;
}

test.describe("Category option presets", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("Pizza preset shows the rich editor (groups + options, no per-dish switch)", async ({
    page,
  }) => {
    const pizza = await categoryId(page, "Pizza");
    await page.goto(`${E2E_BASE_URL}/admin/categories/${pizza}/preset`);
    await expect(page.getByRole("heading", { name: /Pizza preset/ })).toBeVisible();

    // The Size group renders as a card: an editable group-name input plus its
    // options as OptionRows. The seeded Size option "S" is an editable name input.
    await expect(page.getByRole("textbox", { name: "Size category name" })).toHaveValue("Size");
    // exact: true — "S name" otherwise also matches "Olives name" (strict-mode violation).
    await expect(page.getByRole("textbox", { name: "S name", exact: true })).toHaveValue("S");

    // This is the preset, not a dish: OptionRow has no enable toggle here.
    await expect(page.getByRole("switch")).toHaveCount(0);
  });

  test("adding an option persists to the category's groups", async ({ page }) => {
    const pizza = await categoryId(page, "Pizza");
    const optionName = `E2E Topping ${Date.now()}`;
    await page.goto(`${E2E_BASE_URL}/admin/categories/${pizza}/preset`);
    await expect(page.getByRole("heading", { name: /Pizza preset/ })).toBeVisible();

    // Add the option through the Toppings group's inline "+ Add option" form.
    await page.getByRole("textbox", { name: "New option name for Toppings" }).fill(optionName);
    await page
      .getByRole("spinbutton", { name: "New option price delta for Toppings" })
      .fill("3000");
    // The Toppings card owns its own "+ Add option" submit; scope to that card so
    // a parallel/other group's form can never be the click target.
    const toppingsCard = page
      .locator("div.rounded-xl")
      .filter({ has: page.getByRole("textbox", { name: "Toppings category name" }) });
    await toppingsCard.getByRole("button", { name: "+ Add option" }).click();

    // UI shows it (its name becomes an editable OptionRow input).
    await expect(page.getByRole("textbox", { name: `${optionName} name` })).toHaveValue(optionName);

    let createdId: number | undefined;
    try {
      // Really persisted: the category's groups now include the new option.
      const groups = await (
        await page.request.get(`${E2E_API_URL}/api/admin/categories/${pizza}/option-groups`)
      ).json();
      const all = groups.flatMap(
        (g: { options: { option_id: number; name: string }[] }) => g.options,
      );
      const created = all.find((o: { name: string }) => o.name === optionName);
      expect(created, "added option should be persisted on the category").toBeTruthy();
      createdId = created.option_id;
    } finally {
      if (createdId !== undefined) {
        await page.request.delete(`${E2E_API_URL}/api/admin/options/${createdId}`);
      }
    }
  });

  test("a new pizza inherits the category's options", async ({ page }) => {
    const pizza = await categoryId(page, "Pizza");
    const name = `E2E Preset Pizza ${Date.now()}`;
    const created = await page.request.post(`${E2E_API_URL}/api/admin/items`, {
      data: { name, category_id: pizza, base_price_vnd: 99000, kind: "pizza" },
    });
    expect(created.status(), await created.text()).toBe(201);
    const pid = (await created.json()).product_id;
    try {
      const groups = await (
        await page.request.get(`${E2E_API_URL}/api/admin/items/${pid}/options`)
      ).json();
      const enabled = groups.flatMap((g: { options: { enabled: boolean }[] }) =>
        g.options.filter((o) => o.enabled),
      );
      expect(enabled.length).toBeGreaterThan(0);
    } finally {
      await page.request.delete(`${E2E_API_URL}/api/admin/items/${pid}?hard=true`);
    }
  });

  test("Side Dishes preset has no pizza-owned groups (groups are category-scoped)", async ({
    page,
  }) => {
    const sides = await categoryId(page, "Side Dishes");
    await page.goto(`${E2E_BASE_URL}/admin/categories/${sides}/preset`);
    await expect(page.getByRole("heading", { name: /Side Dishes preset/ })).toBeVisible();

    // Pizza owns Size/Crust/Toppings; Side Dishes owns none — their group-name
    // inputs must be absent here.
    await expect(page.getByRole("textbox", { name: "Size category name" })).toHaveCount(0);
    await expect(page.getByRole("textbox", { name: "Crust category name" })).toHaveCount(0);
    await expect(page.getByRole("textbox", { name: "Toppings category name" })).toHaveCount(0);
  });
});
