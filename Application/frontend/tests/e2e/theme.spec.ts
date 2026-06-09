import { expect, test, type Page } from "@playwright/test";

const API_URL = process.env.E2E_API_URL ?? "http://localhost:8000";
const ADMIN_PHONE = process.env.E2E_ADMIN_PHONE ?? "0900000001";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "admin123";

async function loginAsAdmin(page: Page) {
  const res = await page.request.post(`${API_URL}/api/auth/login`, {
    data: { phone_number: ADMIN_PHONE, password: ADMIN_PASSWORD },
  });
  expect(res.ok(), "admin seed login should succeed against a seeded stack").toBeTruthy();
}

test.describe("theme — public shell", () => {
  test("system default, toggle, and persistence", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/");
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
    const before = await html.getAttribute("class");

    await page.getByRole("button", { name: "Toggle dark mode" }).first().click();
    const after = await html.getAttribute("class");
    expect(after).not.toBe(before);
  });
});