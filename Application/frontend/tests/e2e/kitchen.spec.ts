import { expect, test } from "@playwright/test";

const KITCHEN_PHONE = process.env.E2E_KITCHEN_PHONE ?? "0900000002";
const KITCHEN_PASSWORD = process.env.E2E_KITCHEN_PASSWORD ?? "kitchen123";

test.describe("K1 — View Incoming Orders", () => {
  test("non-kitchen visitor is redirected away from /kitchen", async ({ page }) => {
    await page.goto("/kitchen");
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  });

  test("kitchen login lands on the queue and sees incoming tickets", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Phone Number").fill(KITCHEN_PHONE);
    await page.getByLabel("Password", { exact: true }).fill(KITCHEN_PASSWORD);
    await page.getByRole("button", { name: /sign in/i }).click();

    await expect(page).toHaveURL(/\/kitchen/, { timeout: 20_000 });
    await expect(page.getByRole("heading", { name: "Incoming Orders" })).toBeVisible();
    await expect(page.getByTestId("kitchen-poll-indicator")).toContainText("3s");
    await expect(page.getByTestId("kitchen-ticket").first()).toBeVisible({ timeout: 15_000 });
    // Seeded ReadyForDispatch order shows the courier delivery-note block.
    await expect(page.getByTestId("kitchen-delivery-note").first()).toBeVisible();
  });
});
