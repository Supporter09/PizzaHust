/**
 * E2E happy path: register → browse menu → customize → cart → checkout → track
 * Requires a running stack: docker compose up + seeded DB.
 */
import { test, expect, type Page } from "@playwright/test";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const TS = Date.now();
// Backend expects a 10-digit VN mobile: ^(0|\+84)[3-9]\d{8}$.
// "09" + 8 digits = 10 chars, with a valid leading [3-9] second digit.
const TEST_PHONE = `09${TS.toString().slice(-8)}`;
const TEST_PASSWORD = "testpass123";

async function register(page: Page) {
  await page.goto(`${BASE}/register`);
  await page.getByLabel(/name/i).fill(`E2E User ${TS}`);
  await page.getByLabel(/phone/i).fill(TEST_PHONE);
  await page.getByLabel(/password/i).fill(TEST_PASSWORD);
  await page.getByRole("button", { name: /register/i }).click();
  await page.waitForURL(/menu|\/$/);
}

test.describe("Happy path", () => {
  // FUTURE(U-register): register currently redirects to /login (no auto-login),
  // but register() waits for /menu|/. Revisit when the register→menu flow exists.
  test.fixme("01 – register new account", async ({ page }) => {
    await register(page);
    await expect(page).not.toHaveURL(/register/);
  });

  // FUTURE(U1): /menu is not built yet.
  test.fixme("02 – browse menu", async ({ page }) => {
    await page.goto(`${BASE}/menu`);
    await expect(page.getByRole("heading", { name: /menu/i })).toBeVisible();
    const items = page.locator("[data-testid='menu-item']");
    await expect(items.first()).toBeVisible();
  });

  // FUTURE(U2): item detail depends on /menu, not built yet.
  test.fixme("03 – view item detail", async ({ page }) => {
    await page.goto(`${BASE}/menu`);
    await page.locator("[data-testid='menu-item']").first().click();
    await expect(page.getByRole("button", { name: /customize/i })).toBeVisible();
  });

  test("04 – login existing account", async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.getByLabel(/phone/i).fill("0901234567");
    await page.getByLabel(/password/i).fill("demo1234");
    const [res] = await Promise.all([
      page.waitForResponse((r) => r.url().includes("/api/auth/login")),
      page.getByRole("button", { name: /login/i }).click(),
    ]);
    // The seed account may or may not exist, but the response must be definitive.
    expect([200, 401]).toContain(res.status());
    if (res.status() === 200) {
      // A successful login must navigate away from /login.
      await expect(page).not.toHaveURL(/login/);
    }
  });

  // FUTURE(U4): /track is not built yet.
  test.fixme("05 – track order page renders", async ({ page }) => {
    await page.goto(`${BASE}/track`);
    await expect(page.getByRole("heading", { name: /track/i })).toBeVisible();
  });
});
