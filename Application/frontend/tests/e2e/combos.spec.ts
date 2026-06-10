import { expect, test } from "@playwright/test";

test.describe("U4 — View Combo Promotions", () => {
  test("lists active combos with price and savings", async ({ page }) => {
    await page.goto("/combos");
    await expect(page.getByRole("heading", { name: "Combo Promotions" })).toBeVisible();

    const card = page
      .locator("article")
      .filter({ has: page.getByRole("heading", { name: "Lunch Duo for 2" }) });
    await expect(card).toBeVisible();
    await expect(card.getByText("255.000₫")).toBeVisible();
    await expect(card.getByText(/Save\s/)).toBeVisible();

    await expect(page.getByRole("heading", { name: "Family Feast 4" })).toBeVisible();
  });

  test("combos reachable from the nav", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Combos" }).first().click();
    await expect(page).toHaveURL(/\/combos$/);
    await expect(page.getByRole("heading", { name: "Combo Promotions" })).toBeVisible();
  });
});