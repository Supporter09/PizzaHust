import { test, expect, type Page } from "@playwright/test";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const API_URL = process.env.E2E_API_URL ?? "http://localhost:8000";
const ADMIN_PHONE = process.env.E2E_ADMIN_PHONE ?? "0900000001";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "admin123";

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

async function loginAsAdmin(page: Page) {
  const res = await page.request.post(`${API_URL}/api/auth/login`, {
    data: { phone_number: ADMIN_PHONE, password: ADMIN_PASSWORD },
  });
  expect(res.ok(), "admin seed login should succeed").toBeTruthy();
}

test.describe("A9 - admin image gallery", () => {
  let createdPid: number | null = null;

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  // Soft-deactivate the throwaway dish so it never leaks into the shared dev DB
  // (a stray cheap pizza otherwise undercuts other tests' combo-savings checks).
  test.afterEach(async ({ page }) => {
    if (createdPid !== null) {
      await page.request.delete(`${API_URL}/api/admin/items/${createdPid}`);
      createdPid = null;
    }
  });

  test("upload two, set cover, remove one", async ({ page }) => {
    const cats = await (await page.request.get(`${API_URL}/api/admin/categories`)).json();
    const created = await page.request.post(`${API_URL}/api/admin/items`, {
      data: {
        category_id: cats[0].category_id,
        name: `A9 ${Date.now()}`,
        base_price_vnd: 200_000,
        kind: "pizza",
      },
    });
    const pid = (await created.json()).product_id;
    createdPid = pid;

    await page.goto(`${BASE}/admin/items/${pid}`);
    await expect(page.getByRole("heading", { name: "Images" })).toBeVisible();

    const upload = async () => {
      await page.locator('input[type="file"]').setInputFiles({
        name: "a.png",
        mimeType: "image/png",
        buffer: PNG,
      });
      await expect
        .poll(async () =>
          (await page.request.get(`${API_URL}/api/admin/items/${pid}`))
            .json()
            .then((d) => d.images.length),
        )
        .toBeGreaterThan(0);
    };
    await upload();
    await expect.poll(async () => page.getByText("Cover", { exact: true }).count()).toBeGreaterThan(0);
    await upload();

    await page.getByRole("button", { name: "Set as cover" }).first().click();
    await page.getByRole("button", { name: "Remove image" }).first().click();
    await expect
      .poll(async () =>
        (await page.request.get(`${API_URL}/api/admin/items/${pid}`))
          .json()
          .then((d) => d.images.length),
      )
      .toBe(1);
  });
});