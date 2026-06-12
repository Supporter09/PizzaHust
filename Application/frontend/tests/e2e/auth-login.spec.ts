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
  await page.getByLabel("Full Name").fill(`E2E Login ${Date.now()}`);
  await page.getByLabel("Phone Number").fill(phone);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/auth/register") && r.request().method() === "POST"),
    page.waitForResponse((r) => r.url().includes("/api/auth/login") && r.request().method() === "POST"),
    page.getByRole("button", { name: "Create Account" }).click(),
  ]);
  await expect(page).toHaveURL(/\/account$/);
}

test.describe("Auth login (U9)", () => {
  test("login error shows for wrong credentials", async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.getByLabel("Phone Number").fill("0900000000");
    await page.getByLabel("Password", { exact: true }).fill("wrongpass1");
    await page.getByRole("button", { name: "Sign In" }).click();
    await expect(page.getByText("Invalid phone number or password.")).toBeVisible();
  });

  test("returnTo is honored for safe paths only", async ({ page }) => {
    const phone = uniquePhone();
    const password = "testpass123";
    await registerCustomer(page, phone, password);

    await page.goto(`${BASE}/login?returnTo=//evil.com`);
    await page.getByLabel("Phone Number").fill(phone);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign In" }).click();
    await expect(page).toHaveURL(/\/account$/);
  });
});