import { expect, test } from "@playwright/test";

test.describe("U6 — Checkout", () => {
  test("cart to checkout to place order shows PIZZ code", async ({ page }) => {
    await page.goto("/menu");
    await page.getByRole("link", { name: /Margherita Classic/ }).first().click();
    await page.getByRole("button", { name: "Add to cart" }).click();
    await expect(page.getByRole("status").first()).toContainText("Added to cart", {
      timeout: 15_000,
    });

    await page.goto("/cart");
    await page.getByTestId("cart-checkout").click();
    await expect(page).toHaveURL(/\/checkout/);
    await expect(page.getByRole("heading", { name: "Checkout" })).toBeVisible();

    const ward = page.locator("#checkout-ward");
    await expect(ward.locator("option")).toHaveCount(52, { timeout: 15_000 });
    await ward.selectOption({ label: "Ba Dinh" });
    await page.locator("#checkout-street").fill("1 Phố Huế");
    await page.locator("#checkout-name").fill("Nguyen Van An");
    await page.locator("#checkout-phone").fill("0912345678");

    await expect(page.getByText("22.000₫")).toBeVisible({ timeout: 15_000 });

    await page.getByRole("button", { name: /Place Order/ }).click();
    await expect(page).toHaveURL(/\/order-confirmed\/PIZZ-/, { timeout: 20_000 });
    await expect(page.getByText(/PIZZ-/)).toBeVisible();
  });
});