import { test, expect } from "@playwright/test";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const API_URL = process.env.E2E_API_URL ?? "http://localhost:8000";

test("U2/A9 - dish detail swaps main image when a thumbnail is clicked", async ({ page }) => {
  const items = await (await page.request.get(`${API_URL}/api/items`)).json();
  let target: number | null = null;
  for (const it of items) {
    const detail = await (
      await page.request.get(`${API_URL}/api/items/${it.product_id}`)
    ).json();
    if ((detail.images ?? []).length > 1) {
      target = it.product_id;
      break;
    }
  }
  test.skip(target === null, "no multi-image dish in seed");

  await page.goto(`${BASE}/menu/${target}`);
  const main = page.getByRole("img").first();
  const firstSrc = await main.getAttribute("src");
  await page.getByRole("button", { name: /show image/i }).nth(1).click();
  await expect.poll(() => main.getAttribute("src")).not.toBe(firstSrc);
});