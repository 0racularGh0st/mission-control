import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/smoke",
  fullyParallel: false,
  reporter: "list",
  timeout: 30_000,
  use: {
    baseURL: "http://localhost:3003",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3003",
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
