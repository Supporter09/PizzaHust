import { expect, test } from "@playwright/test";

test.describe("U5 — Manage Cart", () => {
  test("add item with note, adjust qty, add combo, remove combo, checkout enabled", async ({
    page,
  }) => {
    await page.goto("/menu");
    await page.getByRole("link", { name: /Margherita Classic/ }).first().click();
    await expect(page.getByRole("heading", { name: "Margherita Classic" })).toBeVisible();

    await page.getByTestId("dish-note").fill("Well-done bake");
    await page.getByRole("button", { name: "Add to cart" }).click();
    await expect(page.getByRole("status").first()).toContainText("Added to cart", {
      timeout: 15_000,
    });

    const cartLink = page.getByRole("link", { name: /Cart, 1 item/i });
    await expect(cartLink).toBeVisible();

    await cartLink.click();
    await expect(page).toHaveURL(/\/cart/);
    await expect(page.getByText("Well-done bake")).toBeVisible();

    const pizzaLine = page.getByTestId("cart-line").first();
    const lineTotal = pizzaLine.locator(".text-brand").first();
    const totalBefore = await lineTotal.textContent();

    await pizzaLine.getByRole("button", { name: "Increase quantity" }).click();
    await expect(lineTotal).not.toHaveText(totalBefore ?? "", { timeout: 10_000 });

    await page.goto("/combos");
    const card = page
      .locator("article")
      .filter({ has: page.getByRole("heading", { name: "Pick-Any Feast" }) });
    await card.getByRole("link", { name: "Order Now — Pick-Any Feast" }).click();
    await expect(page).toHaveURL(/\/combos\/\d+$/);

    const estimate = page.getByTestId("combo-estimate");
    for (let picks = 0; ; picks++) {
      if (picks > 20) {
        throw new Error("Combo slots still unpicked after 20 attempts — selection not converging");
      }
      const unpicked = page
        .getByTestId("slot-group")
        .filter({ hasNot: page.getByRole("radio", { checked: true }) })
        .first();
      if ((await unpicked.count()) === 0) break;
      await unpicked.getByTestId("slot-pick").first().click();
    }

    await expect(estimate).toHaveText(/₫/, { timeout: 15_000 });

    await page.getByRole("button", { name: "Add Combo to Cart" }).click();
    await expect(page.getByRole("status").first()).toContainText("Added to cart", {
      timeout: 15_000,
    });
    await expect(page.getByRole("link", { name: /Cart, 3 items/i })).toBeVisible();

    await page.goto("/cart");
    const lines = page.getByTestId("cart-line");
    await expect(lines).toHaveCount(2);

    const comboLine = lines.filter({ hasText: /Pick-Any Feast|Feast/i }).first();
    await comboLine.getByRole("button", { name: /Remove/ }).click();
    await expect(lines).toHaveCount(1, { timeout: 10_000 });

    await expect(page.getByTestId("cart-checkout")).toHaveAttribute("href", "/checkout");
  });
});