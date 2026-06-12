import { expect, test } from "@playwright/test";

test.describe("U7 — Track Order", () => {
  test("checkout then track shows Received and delivery note", async ({ page }) => {
    await page.goto("/menu");
    await page.getByRole("link", { name: /Margherita Classic/ }).first().click();
    await page.getByRole("button", { name: "Add to cart" }).click();
    await expect(page.getByRole("status").first()).toContainText("Added to cart", {
      timeout: 15_000,
    });

    await page.goto("/cart");
    await page.getByTestId("cart-checkout").click();
    await expect(page).toHaveURL(/\/checkout/);

    await page.locator("#checkout-ward").selectOption({ label: "Ba Dinh" });
    await page.locator("#checkout-street").fill("1 Phố Huế");
    await page.locator("#checkout-name").fill("Nguyen Thi Lan");
    await page.locator("#checkout-phone").fill("0911112222");
    await page.locator("#checkout-note").fill("Ring doorbell twice");

    await expect(page.getByText("22.000₫")).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: /Place Order/ }).click();
    await expect(page).toHaveURL(/\/order-confirmed\/PIZZ-/, { timeout: 20_000 });

    await page.getByRole("link", { name: "Track Order" }).click();
    await expect(page).toHaveURL(/\/track\?code=PIZZ-/);
    await expect(page.getByText("Order Received", { exact: true })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText(/Ring doorbell twice/)).toBeVisible();
    await expect(page.getByText(/~\d+ min/)).toBeVisible();
  });
});