import { defineConfig } from "vitest/config";
import viteConfig from "./vite.config";

export default defineConfig({
  ...viteConfig,
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    globals: true,
    css: true,
    fileParallelism: false,
    clearMocks: true,
    restoreMocks: true,
    unstubGlobals: true,
    testTimeout: 15000,
    exclude: ["e2e/**", "node_modules/**", "dist/**"],
  },
});
