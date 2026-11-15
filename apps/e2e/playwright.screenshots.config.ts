// The pictures of the app for the README and the documentation, taken of the test stack
// with its invented data, in the English interface (the clock stands at 3 November 2026, 10:00). They are written to
// apps/docs/static/img/screenshots/.   ./infra/test/stack.sh screenshots
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "screenshots",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: { baseURL: "http://localhost:8090", locale: "de-DE", timezoneId: "Europe/Berlin" },
  projects: [
    { name: "laptop", use: { ...devices["Desktop Chrome"], viewport: { width: 1400, height: 900 } } },
    { name: "phone", use: { ...devices["iPhone 13"] } },
  ],
});
