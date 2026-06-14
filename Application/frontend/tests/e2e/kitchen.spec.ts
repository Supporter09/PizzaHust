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

test.describe("K2 — Accept Order", () => {
  test("accepting a Received order moves it to Preparing", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Phone Number").fill(KITCHEN_PHONE);
    await page.getByLabel("Password", { exact: true }).fill(KITCHEN_PASSWORD);
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/kitchen/, { timeout: 20_000 });

    const acceptBtn = page.getByTestId("kitchen-accept").first();
    await expect(acceptBtn).toBeVisible({ timeout: 15_000 });
    const card = page
      .getByTestId("kitchen-ticket")
      .filter({ has: page.getByTestId("kitchen-accept") })
      .first();
    const code = await card.getAttribute("data-order-code");
    expect(code).toBeTruthy();
    await acceptBtn.click();

    // After the post-action refresh that card no longer offers Accept (now Preparing → Mark Ready).
    const sameCard = page.locator(`[data-testid="kitchen-ticket"][data-order-code="${code}"]`);
    await expect(sameCard.getByTestId("kitchen-accept")).toHaveCount(0, { timeout: 15_000 });
  });
});

test.describe("K3 — Mark Ready for Dispatch", () => {
  test("marking a Preparing order ready requests dispatch and clears the button", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Phone Number").fill(KITCHEN_PHONE);
    await page.getByLabel("Password", { exact: true }).fill(KITCHEN_PASSWORD);
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/kitchen/, { timeout: 20_000 });

    const readyBtn = page.getByTestId("kitchen-mark-ready").first();
    await expect(readyBtn).toBeVisible({ timeout: 15_000 });
    const card = page
      .getByTestId("kitchen-ticket")
      .filter({ has: page.getByTestId("kitchen-mark-ready") })
      .first();
    const code = await card.getAttribute("data-order-code");
    expect(code).toBeTruthy();
    await readyBtn.click();

    // After dispatch the order leaves Preparing (→ ReadyForDispatch, or → Delivering via the
    // mock provider's webhook) and the card no longer offers Mark Ready.
    const sameCard = page.locator(`[data-testid="kitchen-ticket"][data-order-code="${code}"]`);
    await expect(sameCard.getByTestId("kitchen-mark-ready")).toHaveCount(0, { timeout: 15_000 });
  });
});

test.describe("K4 — Confirm Pickup (fallback)", () => {
  test("confirming pickup advances a ReadyForDispatch order to Delivering and clears the card", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByLabel("Phone Number").fill(KITCHEN_PHONE);
    await page.getByLabel("Password", { exact: true }).fill(KITCHEN_PASSWORD);
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/kitchen/, { timeout: 20_000 });

    const pickupBtn = page.getByTestId("kitchen-confirm-pickup").first();
    await expect(pickupBtn).toBeVisible({ timeout: 15_000 });
    const card = page
      .getByTestId("kitchen-ticket")
      .filter({ has: page.getByTestId("kitchen-confirm-pickup") })
      .first();
    const code = await card.getAttribute("data-order-code");
    expect(code).toBeTruthy();

    const cardByCode = page.locator(
      `[data-testid="kitchen-ticket"][data-order-code="${code}"]`,
    );
    await cardByCode.getByTestId("kitchen-confirm-pickup").click(); // → inline confirm
    await cardByCode.getByTestId("kitchen-pickup-yes").click(); // confirm

    await expect(cardByCode).toHaveCount(0, { timeout: 15_000 });
  });
});
