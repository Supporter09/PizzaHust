import { defineConfig } from "@playwright/test";

import { E2E_BASE_URL } from "./tests/e2e/env";

export default defineConfig({
  testDir: "./tests/e2e",
  use: { baseURL: E2E_BASE_URL },
  reporter: [["list"]],
  // E2E runs against the full stack under parallel workers: a quote/poll request
  // can transiently stall under contention (e.g. the combo-estimate spec). One
  // retry clears that flake without masking deterministic failures, which fail
  // every attempt. CI gets an extra retry for its heavier shared runners.
  retries: process.env.CI ? 2 : 1,
});
