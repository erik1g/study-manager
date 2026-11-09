// The tests run against the test stack (http://localhost:8090), filled with
// the invented data of infra/test/seed.mjs for 3 November 2026; the browser's
// clock stands still at 10:00 that day, so that every run sees the same day.
//   ./infra/test/stack.sh e2e
import { defineConfig, devices } from "@playwright/test";

const AUSSEHEN = ["aussehen-chromium", "aussehen-webkit", "aussehen-iphone"];
const desktop = (device: string) => ({ ...devices[device], viewport: { width: 1400, height: 900 } });

export default defineConfig({
  testDir: "tests",
  timeout: 45_000,
  expect: { timeout: 8_000, toHaveScreenshot: { maxDiffPixelRatio: 0.02, animations: "disabled" } },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  snapshotPathTemplate: "{testDir}/__screenshots__/{projectName}/{arg}{ext}",
  use: {
    baseURL: "http://localhost:8090",
    locale: "de-DE",
    timezoneId: "Europe/Berlin",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    // First the pictures, on the data as seeded; then the tests that change it; deleting an account last.
    { name: "aussehen-chromium", testMatch: /visual/, use: { ...desktop("Desktop Chrome") } },
    { name: "aussehen-webkit", testMatch: /visual/, use: { ...desktop("Desktop Safari") } },
    { name: "aussehen-iphone", testMatch: /visual/, use: { ...devices["iPhone 13"] } },
    { name: "chromium", testIgnore: /visual|delete-account/, dependencies: AUSSEHEN, use: { ...desktop("Desktop Chrome") } },
    { name: "webkit", testIgnore: /visual|delete-account/, dependencies: AUSSEHEN, use: { ...desktop("Desktop Safari") } },
    { name: "iphone", testIgnore: /visual|delete-account/, dependencies: AUSSEHEN, use: { ...devices["iPhone 13"] } },
    { name: "zum-schluss", testMatch: /delete-account/, dependencies: ["chromium", "webkit", "iphone"], use: { ...devices["Desktop Chrome"] } },
  ],

});
