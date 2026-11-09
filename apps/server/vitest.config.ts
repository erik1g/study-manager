import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // The tests share one database and empty it between files.
    fileParallelism: false,
    env: { TZ: "Europe/Berlin" },
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
