import { test, expect } from "@playwright/test";

import { E2E_BASE_URL } from "./env";

const BASE = E2E_BASE_URL;

function uniquePhone(): string {
  return `09${Date.now().toString().slice(-8)}`;
}

test.describe("Auth register (U8)", () => {
  test("register creates account, auto-logs-in, lands on /account", async ({ page }) => {
    const phone = uniquePhone();
    const password = "testpass123";
    const fullName = `E2E Register ${Date.now()}`;

    await page.goto(`${BASE}/register`);
    await expect(page.getByRole("tab", { name: "Create Account" })).toHaveAttribute(
      "aria-selected",
      "true",
    );

    await page.getByLabel("Full Name").fill(fullName);
    await page.getByLabel("Phone Number").fill(phone);
    await page.getByLabel("Password", { exact: true }).fill(password);

    await Promise.all([
      page.waitForResponse((r) => r.url().includes("/api/auth/register") && r.request().method() === "POST"),
      page.waitForResponse((r) => r.url().includes("/api/auth/login") && r.request().method() === "POST"),
      page.getByRole("button", { name: "Create Account" }).click(),
    ]);

    await expect(page).toHaveURL(/\/account$/);
    await expect(page.getByLabel(/full name/i)).toHaveValue(fullName);
  });

  test("tab switch navigates between /login and /register", async ({ page }) => {
    await page.goto(`${BASE}/register?returnTo=%2Fcheckout`);

    await page.getByRole("tab", { name: "Sign In" }).click();
    await expect(page).toHaveURL(/\/login\?returnTo=%2Fcheckout/);

    await page.getByRole("tab", { name: "Create Account" }).click();
    await expect(page).toHaveURL(/\/register\?returnTo=%2Fcheckout/);
  });
});