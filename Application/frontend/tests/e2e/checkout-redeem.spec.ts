import { expect, test } from "@playwright/test";

import { E2E_BASE_URL } from "./env";

const BASE = E2E_BASE_URL;

function uniquePhone(): string {
  return `09${Date.now().toString().slice(-8)}`;
}

async function registerCustomer(page: import("@playwright/test").Page, phone: string) {
  await page.goto(`${BASE}/register`);
  await page.getByLabel("Full Name").fill(`E2E U14 ${Date.now()}`);
  await page.getByLabel("Phone Number").fill(phone);
  await page.getByLabel("Password", { exact: true }).fill("testpass123");
  await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes("/api/auth/login") && r.request().method() === "POST",
    ),
    page.getByRole("button", { name: "Create Account" }).click(),
  ]);
  await expect(page).toHaveURL(/\/account$/);
}

async function addMargheritaToCart(page: import("@playwright/test").Page) {
  await page.goto(`${BASE}/menu`);
  await page.getByRole("link", { name: /Margherita Classic/ }).first().click();
  await page.getByRole("button", { name: "Add to cart" }).click();
  await expect(page.getByText("Added to cart").first()).toBeVisible({
    timeout: 15_000,
  });
}

async function checkoutAndPlace(page: import("@playwright/test").Page) {
  await page.goto(`${BASE}/cart`);
  await page.getByTestId("cart-checkout").click();
  await expect(page).toHaveURL(/\/checkout/);
  const ward = page.locator("#checkout-ward");
  await expect(ward.locator("option")).toHaveCount(52, { timeout: 15_000 });
  await ward.selectOption({ label: "Ba Dinh" });
  await page.locator("#checkout-street").fill("1 Phố Huế");
  await page.locator("#checkout-name").fill("Nguyen Van An");
  await page.locator("#checkout-phone").fill("0912345678");
  await expect(page.getByText("22.000₫")).toBeVisible({ timeout: 15_000 });
}

test.describe("U14 — Redeem points at checkout", () => {
  test("earn on first order, redeem on second", async ({ page }) => {
    await registerCustomer(page, uniquePhone());

    // Order 1: earns points.
    await addMargheritaToCart(page);
    await checkoutAndPlace(page);
    await page.getByRole("button", { name: /Place Order/ }).click();
    await expect(page).toHaveURL(/\/order-confirmed\/PIZZ-/, { timeout: 20_000 });

    // Order 2: redeem the earned points.
    await addMargheritaToCart(page);
    await checkoutAndPlace(page);

    const panel = page.getByText("Redeem loyalty points");
    await expect(panel).toBeVisible({ timeout: 15_000 });

    await page.getByRole("button", { name: "Use max" }).click();
    await page.getByRole("button", { name: "Apply" }).click();

    await expect(page.getByText("Loyalty discount")).toBeVisible({ timeout: 15_000 });

    await page.getByRole("button", { name: /Place Order/ }).click();
    await expect(page).toHaveURL(/\/order-confirmed\/PIZZ-/, { timeout: 20_000 });

    // Balance reflects the spend on the loyalty page.
    await page.goto(`${BASE}/account/loyalty`);
    await expect(page.getByText("Points History")).toBeVisible();
  });
});
