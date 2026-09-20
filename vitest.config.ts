import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: [
      ...configDefaults.exclude,
      "tests/integration/flight-server.test.ts",
    ],
    clearMocks: true,
    restoreMocks: true,
  },
});
