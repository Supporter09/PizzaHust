import { expect, test } from "@playwright/test";

test.describe("U15 — Customize Combo", () => {
  test("resolves slots and shows a live quoted total", async ({ page }) => {
    await page.goto("/combos");
    const card = page
      .locator("article")
      .filter({ has: page.getByRole("heading", { name: "Pick-Any Feast" }) });
    await card.getByRole("link", { name: "Customize" }).click();
    await expect(page).toHaveURL(/\/combos\/\d+$/);

    const estimate = page.getByTestId("combo-estimate");
    await expect(estimate).not.toHaveText(/₫/); // gated until picks complete

    // Resolve slot units until none remain unpicked. Picking a slot mounts new
    // PickOptions radiogroups into the DOM, so never iterate a captured index —
    // re-query the stable slot-group wrapper each pass.
    for (;;) {
      const unpicked = page
        .getByTestId("slot-group")
        .filter({ hasNot: page.getByRole("radio", { checked: true }) })
        .first();
      if ((await unpicked.count()) === 0) break;
      await unpicked.getByTestId("slot-pick").first().click();
    }

    await expect(estimate).toHaveText(/₫/, { timeout: 10_000 });
    const baseline = await estimate.textContent();

    // A premium pick (chip labelled with a surcharge) must change the total.
    const premium = page
      .locator('[data-testid="slot-pick"][aria-checked="false"]')
      .filter({ hasText: "+" })
      .first();
    if ((await premium.count()) > 0) {
      await premium.click();
      await expect(estimate).not.toHaveText(baseline ?? "", { timeout: 10_000 });
    }
  });

  test("unknown combo id shows the unavailable state", async ({ page }) => {
    await page.goto("/combos/999999");
    await expect(page.getByText("isn't available right now")).toBeVisible();
  });
});