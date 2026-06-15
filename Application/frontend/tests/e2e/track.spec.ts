import { expect, test } from "@playwright/test";

import { E2E_API_URL } from "./env";

const KITCHEN_PHONE = process.env.E2E_KITCHEN_PHONE ?? "0900000002";
const KITCHEN_PASSWORD = process.env.E2E_KITCHEN_PASSWORD ?? "kitchen123";

test.describe("U7 — Track Order", () => {
  test("checkout then track shows Received and delivery note", async ({ page }) => {
    await page.goto("/menu");
    await page.getByRole("link", { name: /Margherita Classic/ }).first().click();
    await page.getByRole("button", { name: "Add to cart" }).click();
    await expect(page.getByText("Added to cart").first()).toBeVisible({
      timeout: 15_000,
    });

    await page.goto("/cart");
    await page.getByTestId("cart-checkout").click();
    await expect(page).toHaveURL(/\/checkout/);

    await page.locator("#checkout-ward").selectOption({ label: "Ba Dinh" });
    await page.locator("#checkout-street").fill("1 Phố Huế");
    await page.locator("#checkout-name").fill("Nguyen Thi Lan");
    await page.locator("#checkout-phone").fill("0911112222");
    await page.locator("#checkout-note").fill("Ring doorbell twice");

    await expect(page.getByText("22.000₫")).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: /Place Order/ }).click();
    await expect(page).toHaveURL(/\/order-confirmed\/PIZZ-/, { timeout: 20_000 });

    await page.getByRole("link", { name: "Track Order" }).click();
    await expect(page).toHaveURL(/\/track\?code=PIZZ-/);
    await expect(page.getByText("Order Received", { exact: true })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText(/Ring doorbell twice/)).toBeVisible();
    await expect(page.getByText(/~\d+ min/)).toBeVisible();
  });

  test("checkout, kitchen dispatch, then track auto-advances to Delivered", async ({
    page,
    playwright,
  }) => {
    // Full delivery loop: checkout + mock auto-advance (~8s) + a track-page poll
    // (15s) exceeds the default 30s per-test cap, so extend it to fit the wait.
    test.setTimeout(90_000);

    // Customer places an order (same checkout flow as the Received test).
    await page.goto("/menu");
    await page.getByRole("link", { name: /Margherita Classic/ }).first().click();
    await page.getByRole("button", { name: "Add to cart" }).click();
    await expect(page.getByText("Added to cart").first()).toBeVisible({
      timeout: 15_000,
    });
    await page.goto("/cart");
    await page.getByTestId("cart-checkout").click();
    await expect(page).toHaveURL(/\/checkout/);
    await page.locator("#checkout-ward").selectOption({ label: "Ba Dinh" });
    await page.locator("#checkout-street").fill("1 Phố Huế");
    await page.locator("#checkout-name").fill("Track Delivered");
    await page.locator("#checkout-phone").fill("0911112222");
    await page.locator("#checkout-note").fill("Leave at door");
    await expect(page.getByText("22.000₫")).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: /Place Order/ }).click();
    await expect(page).toHaveURL(/\/order-confirmed\/PIZZ-/, { timeout: 20_000 });
    const code = new URL(page.url()).pathname.split("/").pop()!;
    expect(code).toMatch(/^PIZZ-/);

    // Kitchen (separate API context): accept + mark ready → fires T1 dispatch to the mock.
    const kitchen = await playwright.request.newContext({ baseURL: E2E_API_URL });
    const login = await kitchen.post("/api/auth/login", {
      data: { phone_number: KITCHEN_PHONE, password: KITCHEN_PASSWORD },
    });
    expect(login.ok()).toBeTruthy();
    const queue = (await (await kitchen.get("/api/kitchen/orders")).json()) as Array<{
      order_id: number;
      order_code: string;
    }>;
    const ticket = queue.find((t) => t.order_code === code);
    expect(ticket, `order ${code} should be in the kitchen queue`).toBeTruthy();
    expect((await kitchen.post(`/api/kitchen/orders/${ticket!.order_id}/accept`)).status()).toBe(204);
    const ready = await kitchen.post(`/api/kitchen/orders/${ticket!.order_id}/mark-ready`);
    expect(ready.ok()).toBeTruthy();
    await kitchen.dispose();

    // Customer track page polls (15s) — wait for the mock's webhooks to land Delivered.
    await page.goto(`/track?code=${code}`);
    await expect(page.getByTestId("order-status-badge")).toHaveText("Delivered", {
      timeout: 45_000,
    });
  });
});
