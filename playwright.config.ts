import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests",
  timeout: 30_000,
  fullyParallel: true,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3017",
    browserName: "chromium",
  },
  webServer: {
    command: "npx next dev -p 3017",
    url: "http://localhost:3017",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
