import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * Vitest covers the pure logic only: graph generation, the force layout, frame statistics,
 * and the projection maths.
 *
 * Component and renderer tests are deliberately absent. Every one of them would need a
 * device or a GL context, and a test that stubs those out asserts that the code runs rather
 * than that it draws anything — which is exactly the claim this project exists to measure
 * rather than mock.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
