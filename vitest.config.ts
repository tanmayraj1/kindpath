import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      // Mirror the tsconfig path alias so modules under test can use "@/…"
      // exactly as they do in the app.
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // Next.js provides "server-only" as a build-time poison pill for client
      // bundles. It has no runtime behaviour, and no package to resolve outside
      // the Next build, so tests stub it out.
      "server-only": fileURLToPath(new URL("./test/stubs/server-only.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});
