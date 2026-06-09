import { expect, test } from "@playwright/test";

test.describe("U2 — View Item Details", () => {
  test("pizza: customizer narrows/updates the estimate", async ({ page }) => {
    await page.goto("/menu");
    await page.getByRole("link", { name: /Margherita Classic/ }).click();

    await expect(page.getByRole("heading", { name: "Margherita Classic" })).toBeVisible();
    await expect(page.getByText("Select Size")).toBeVisible();
    await expect(page.getByText("Add Toppings (Optional)")).toBeVisible();

    // No add-to-cart in U2.
    await expect(page.getByRole("button", { name: /add to cart/i })).toHaveCount(0);

    const estimate = page.getByTestId("line-estimate");
    const base = await estimate.textContent();

    // Default size is S (+0); selecting L (+60.000₫) changes the estimate.
    const sizeL = page.getByRole("radio", { name: /^L/ });
    await sizeL.click();
    await expect(sizeL).toHaveAttribute("aria-checked", "true");
    await expect(page.getByRole("radio", { name: /^S/ })).toHaveAttribute("aria-checked", "false");
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

  test("non-pizza: no options section", async ({ page }) => {
    await page.goto("/menu");
    await page.getByRole("link", { name: /Truffle Fries/ }).click();
    await expect(page.getByRole("heading", { name: "Truffle Fries" })).toBeVisible();
    await expect(page.getByText("Select Size")).toHaveCount(0);
    await expect(page.getByTestId("line-estimate")).toHaveCount(0);
  });

  test("unknown id shows not-found", async ({ page }) => {
    await page.goto("/menu/99999999");
    await expect(page.getByText("Item not found.")).toBeVisible();
  });
});
