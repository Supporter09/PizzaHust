import { expect, test, type Page } from "@playwright/test";

import { E2E_ADMIN_PASSWORD, E2E_ADMIN_PHONE, E2E_API_URL } from "./env";

const API_URL = E2E_API_URL;
const ADMIN_PHONE = E2E_ADMIN_PHONE;
const ADMIN_PASSWORD = E2E_ADMIN_PASSWORD;

async function loginAsAdmin(page: Page) {
  const res = await page.request.post(`${API_URL}/api/auth/login`, {
    data: { phone_number: ADMIN_PHONE, password: ADMIN_PASSWORD },
  });
  expect(res.ok(), "admin seed login should succeed against a seeded stack").toBeTruthy();
}

test.describe("theme — public shell", () => {
  test("system default, toggle, and persistence", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => window.localStorage.removeItem("theme"));
    await page.emulateMedia({ colorScheme: "dark" });
    await page.reload();
    const html = page.locator("html");
    await expect(html).toHaveClass(/dark/);

    await page.getByRole("button", { name: "Toggle dark mode" }).first().click();
    await expect(html).not.toHaveClass(/dark/);

    await page.reload();
    await expect(html).not.toHaveClass(/dark/);
  });
});

test.describe("theme — admin shell", () => {
  test("admin sidebar has its own toggle and it flips .dark", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/orders");
    const html = page.locator("html");
    const hadDark = await html.evaluate((el) => el.classList.contains("dark"));

    await page.getByRole("button", { name: "Toggle dark mode" }).first().click();

    if (hadDark) {
      await expect(html).not.toHaveClass(/dark/);
    } else {
      await expect(html).toHaveClass(/dark/);
    }
  });
});