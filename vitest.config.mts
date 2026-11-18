import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // The in-memory MongoDB binary is downloaded on first run.
    hookTimeout: 120_000,
  },
  resolve: {
    tsconfigPaths: true,
    // `server-only` throws outside the React server bundle; it's a no-op in tests.
    alias: { "server-only": new URL("./tests/empty.ts", import.meta.url).pathname },
  },
});
