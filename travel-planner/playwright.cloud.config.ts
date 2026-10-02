import { defineConfig } from "@playwright/test";
// Explicit emulator-only suite. Never point this configuration at production.
export default defineConfig({
  testDir: "tests/cloud-browser",
  workers: 1,
  timeout: 90000,
  use: {
    baseURL: "http://127.0.0.1:4174",
    channel: "chrome",
    headless: true,
    viewport: { width: 1440, height: 1000 },
    trace: "retain-on-failure",
  },
  reporter: "list",
});
