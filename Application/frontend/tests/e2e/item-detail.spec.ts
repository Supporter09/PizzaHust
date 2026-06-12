import { expect, test } from "@playwright/test";

test.describe("U2/U3 — item detail with generic options", () => {
  test("pizza: option chips drive the server-quoted estimate", async ({ page }) => {
    await page.goto("/menu");
    // Cards expose two links (cover + title) with the same accessible name.
    await page.getByRole("link", { name: /Margherita Classic/ }).first().click();

    await expect(page.getByRole("heading", { name: "Margherita Classic" })).toBeVisible();
    await expect(page.getByRole("radiogroup", { name: "Size" })).toBeVisible();
    await expect(page.getByRole("group", { name: "Toppings" })).toBeVisible();

    // Add-to-cart is rendered but gated on the cart use case (U5).
    await expect(page.getByRole("button", { name: /add to cart/i })).toBeDisabled();

    const estimate = page.getByTestId("line-estimate");
    const base = await estimate.textContent();

    // Default size is S (+0); selecting L (+60.000₫) changes the estimate.
    const sizeL = page.getByRole("radio", { name: /^L/ });
    await sizeL.click();
    await expect(sizeL).toHaveAttribute("aria-checked", "true");
    await expect(page.getByRole("radio", { name: /^S$/ })).toHaveAttribute(
      "aria-checked",
      "false",
    );
    await expect(estimate).not.toHaveText(base ?? "");

    // Toggling a topping changes it again.
    const afterSize = await estimate.textContent();
    await page.getByRole("checkbox", { name: /Extra Cheese/ }).click();
    await expect(estimate).not.toHaveText(afterSize ?? "");

    // Quantity starts at 1 (decrease disabled) and increasing changes the estimate.
    await expect(page.getByRole("button", { name: "Decrease quantity" })).toBeDisabled();
    const afterTopping = await estimate.textContent();
    await page.getByRole("button", { name: "Increase quantity" }).click();
    await expect(estimate).not.toHaveText(afterTopping ?? "");
  });

  test("dish without options: static price, no quote needed", async ({ page }) => {
    await page.goto("/menu");
    await page.getByRole("link", { name: /Truffle Fries/ }).first().click();
    await expect(page.getByRole("heading", { name: "Truffle Fries" })).toBeVisible();
    await expect(page.getByRole("radiogroup")).toHaveCount(0);
    // No options -> the price line shows the static base price (no server quote).
    await expect(page.getByText("Price", { exact: true })).toBeVisible();
    await expect(page.getByTestId("line-estimate")).not.toHaveText("—");
  });

  test("unknown id shows not-found", async ({ page }) => {
    await page.goto("/menu/99999999");
    await expect(page.getByText("Item not found.")).toBeVisible();
  });
});
