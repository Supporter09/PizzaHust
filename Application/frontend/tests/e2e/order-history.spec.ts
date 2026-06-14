import { expect, test } from "@playwright/test";

import { E2E_BASE_URL } from "./env";

const BASE = E2E_BASE_URL;

function uniquePhone(): string {
  return `09${Date.now().toString().slice(-8)}`;
}

async function registerCustomer(
  page: import("@playwright/test").Page,
  phone: string,
  password: string,
): Promise<void> {
  await page.goto(`${BASE}/register`);
  await page.getByLabel("Full Name").fill(`E2E U11 ${Date.now()}`);
  await page.getByLabel("Phone Number").fill(phone);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/auth/register") && r.request().method() === "POST"),
    page.waitForResponse((r) => r.url().includes("/api/auth/login") && r.request().method() === "POST"),
    page.getByRole("button", { name: "Create Account" }).click(),
  ]);
  await expect(page).toHaveURL(/\/account$/);
}

test.describe("U11 — View Order History", () => {
  test("place → history → expand → reorder", async ({ page }) => {
    const phone = uniquePhone();
    const password = "testpass123";
    await registerCustomer(page, phone, password);

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
    await expect(page).toHaveURL(/\/order-confirmed\/(PIZZ-[A-Z0-9]+)/, { timeout: 20_000 });
    const confirmedUrl = page.url();
    const orderCodeMatch = confirmedUrl.match(/PIZZ-[A-Z0-9]+/);
    expect(orderCodeMatch).not.toBeNull();
    const orderCode = orderCodeMatch![0];

    await page.goto("/account/orders");
    await expect(page.getByRole("heading", { name: "Order History" })).toBeVisible();
    const card = page.locator(`[data-testid="order-history-card"][data-order-code="${orderCode}"]`);
    await expect(card).toBeVisible({ timeout: 15_000 });
    await expect(card.getByText(orderCode)).toBeVisible();

    await card.getByTestId("order-details-toggle").click();
    const detailPanel = card.getByTestId("order-detail-panel");
    await expect(detailPanel).toBeVisible({ timeout: 15_000 });
    await expect(detailPanel.getByText(/Margherita Classic/)).toBeVisible();

    await card.getByTestId("order-reorder").click();
    await expect(page).toHaveURL(/\/cart/, { timeout: 15_000 });
    await expect(page.getByText(/Margherita Classic/)).toBeVisible();
  });
});