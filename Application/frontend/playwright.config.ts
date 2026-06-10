import { defineConfig } from "@playwright/test";

import { E2E_BASE_URL } from "./tests/e2e/env";

export default defineConfig({
  testDir: "./tests/e2e",
  use: { baseURL: E2E_BASE_URL },
  reporter: [["list"]],
  retries: 0,
});
