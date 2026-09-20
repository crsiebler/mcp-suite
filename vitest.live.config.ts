import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/integration/flight-server.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 10_000,
  },
});
