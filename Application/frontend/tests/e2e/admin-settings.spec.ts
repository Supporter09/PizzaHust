import { test, expect, type Page } from "@playwright/test";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const API_URL = process.env.E2E_API_URL ?? "http://localhost:8000";
const ADMIN_PHONE = process.env.E2E_ADMIN_PHONE ?? "0900000001";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "admin123";

async function loginAsAdmin(page: Page) {
  const res = await page.request.post(`${API_URL}/api/auth/login`, {
    data: { phone_number: ADMIN_PHONE, password: ADMIN_PASSWORD },
  });
  expect(res.ok(), "admin seed login should succeed against a seeded stack").toBeTruthy();
}

test.describe("A13 - Admin Business Settings", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("renders the settings page", async ({ page }) => {
    await page.goto(`${BASE}/admin/settings`);

    // Page heading is the <h1>Settings</h1> in app/admin/settings/page.tsx.
    await expect(page.getByRole("heading", { name: "Settings", exact: true })).toBeVisible();

    // General+loyalty section: timezone <select> labelled "Timezone",
    // and the "Loyalty accrual rate" number input.
    await expect(page.getByLabel("Timezone")).toBeVisible();
    await expect(page.getByLabel("Loyalty accrual rate")).toBeVisible();

    // Delivery section: at least one ward row. Each ward-name input is
    // labelled "Ward name" (htmlFor ward-name-${i}); there are many, so we
    // assert the first is visible rather than an exact-count match.
    await expect(page.getByLabel("Ward name").first()).toBeVisible();
  });

  test("editing a ward fee is reflected in /api/config/delivery", async ({ page }) => {
    await page.goto(`${BASE}/admin/settings`);

    // Ha Dong's fee input is uniquely addressable by its per-row accessible
    // name. In components/admin/ward-fees-editor.tsx the fee <input> sets:
    //   aria-label={row.ward ? `Fee for ${row.ward}` : "Fee (VND)"}
    // so the populated "Ha Dong" row yields a UNIQUE aria-label
    // "Fee for Ha Dong" (the ward name is interpolated, so no two seeded
    // wards collide). We use exact:true to avoid any "Fee for Ha Dong ..."
    // substring matches.
    const haDongFee = page.getByLabel("Fee for Ha Dong", { exact: true });
    await expect(haDongFee).toBeVisible();

    await haDongFee.fill("");
    await haDongFee.fill("30000");

    // Save the delivery section (its own button, distinct from "Save settings").
    await page.getByRole("button", { name: "Save delivery fees", exact: true }).click();

    // The ward editor renders <span>Saved</span> on success. Scope to the
    // "Delivery fees by ward" section so we don't accidentally match the
    // general-settings "Saved" span.
    const deliverySection = page
      .locator("section")
      .filter({ has: page.getByRole("heading", { name: "Delivery fees by ward", exact: true }) });
    await expect(deliverySection.getByText("Saved", { exact: true })).toBeVisible();

    // Verify the public config endpoint reflects the new fee.
    const res = await page.request.get(`${API_URL}/api/config/delivery`);
    expect(res.ok()).toBeTruthy();
    const body = (await res.json()) as { ward_fees: Array<{ ward: string; fee_vnd: number }> };
    const haDong = body.ward_fees.find((w) => w.ward === "Ha Dong");
    expect(haDong, "Ha Dong should be present in /api/config/delivery").toBeTruthy();
    expect(haDong?.fee_vnd).toBe(30000);
  });
});
