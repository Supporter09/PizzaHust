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
  await page.getByLabel("Full Name").fill(`E2E U12 ${Date.now()}`);
  await page.getByLabel("Phone Number").fill(phone);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/auth/register") && r.request().method() === "POST"),
    page.waitForResponse((r) => r.url().includes("/api/auth/login") && r.request().method() === "POST"),
    page.getByRole("button", { name: "Create Account" }).click(),
  ]);
  await expect(page).toHaveURL(/\/account$/);
}

test.describe("U12/U13 — profile + loyalty", () => {
  test("manage profile and view loyalty", async ({ page }) => {
    const password = "testpass123";
    await registerCustomer(page, uniquePhone(), password);

    await expect(page.getByRole("heading", { name: "My Account" })).toBeVisible();
    await expect(page.getByRole("link", { name: /loyalty points/i })).toHaveAttribute("href", "/account/loyalty");

    await page.getByRole("link", { name: /edit profile/i }).click();
    await page.getByLabel(/full name/i).fill("E2E Renamed");
    await page.getByLabel(/address/i).fill("99 New Street");
    await page.getByRole("button", { name: /save changes/i }).click();
    await expect(page.getByText(/profile updated/i)).toBeVisible();

    await page.setInputFiles('input[type="file"]', {
      name: "avatar.png",
      mimeType: "image/png",
      buffer: Buffer.from("\x89PNGfake"),
    });
    await expect(page.locator("img[alt='E2E Renamed']")).toBeVisible({ timeout: 15_000 });

    await page.getByLabel(/current password/i).fill(password);
    await page.getByLabel(/new password/i).fill("newpass456");
    await page.getByRole("button", { name: /update password/i }).click();
    await expect(page.getByText(/password updated/i)).toBeVisible();
    await page.goto(`${BASE}/account`);
    await expect(page.getByRole("heading", { name: "My Account" })).toBeVisible();

    await page.goto(`${BASE}/account/loyalty`);
    await expect(page.getByRole("heading", { name: "Loyalty Points" })).toBeVisible();
    await expect(page.getByText("Points History")).toBeVisible();
  });
});