import { expect, test } from "@playwright/test";

test.describe("U1 — Browse Menus", () => {
  test("renders chips + cards, and category filter narrows the set", async ({ page }) => {
    await page.goto("/menu");

    await expect(page.getByRole("button", { name: "Pizza" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Drinks" })).toBeVisible();

    const cards = page.getByRole("article");
    await expect(cards.first()).toBeVisible();
    const all = await cards.count();
    expect(all).toBeGreaterThan(0);

    const pizza = page.getByRole("button", { name: "Pizza" });
    await pizza.click();
    await expect(pizza).toHaveAttribute("aria-pressed", "true");
    await expect(cards).not.toHaveCount(all);
    const pizzaCount = await cards.count();
    expect(pizzaCount).toBeGreaterThan(0);
    expect(pizzaCount).toBeLessThan(all);

    await page.getByRole("button", { name: "Drinks" }).click();
    await expect(page.getByText("No items in this category.")).toBeVisible();
  });
});