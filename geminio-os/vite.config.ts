import path from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    globals: true,
    // Every suite here tests server/shared/client *logic* and uses Node APIs (fetch, FormData, Blob, node:sqlite,
    // real sockets). jsdom would replace FormData/Blob/AbortController with incompatible implementations and break
    // those tests, so run in plain Node. A suite that truly needs a DOM can opt in with `// @vitest-environment jsdom`.
    environment: "node",
    include: ["tests/**/*.test.ts"],
    exclude: ["**/node_modules/**", "dist/**"],
  },
});
