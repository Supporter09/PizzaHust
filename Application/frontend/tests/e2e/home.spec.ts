import { test, expect, chromium } from "@playwright/test";

test("home renders", async () => {
  const cdpUrl = process.env.CHROME_DEBUG_URL;
  const targetUrl = process.env.E2E_BASE_URL ?? "http://localhost:3000";

  if (!cdpUrl) {
    const browser = await chromium.launch();
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(targetUrl);
    await expect(page.getByRole("heading", { name: "PizzaHUST" })).toBeVisible();
    await browser.close();
    return;
  }

  const browser = await chromium.connectOverCDP(cdpUrl);
  const context = browser.contexts()[0] ?? (await browser.newContext());
  const cdpPage = await context.newPage();
  await cdpPage.goto(targetUrl);
  await expect(cdpPage.getByRole("heading", { name: "PizzaHUST" })).toBeVisible();
  await browser.close();
});
