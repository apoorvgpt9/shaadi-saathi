import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    coverage: {
      include: ["src/**"],
      // The root layout loads next/font, which only exists inside the Next build; it has no logic to test.
      exclude: ["src/app/layout.tsx"],
      thresholds: { statements: 99, branches: 96, functions: 99, lines: 99 },
    },
    projects: [
      { extends: true, test: { name: "unit", environment: "node", include: ["tests/*.test.ts"] } },
      {
        extends: true,
        test: {
          name: "ui",
          environment: "jsdom",
          include: ["tests/ui/**/*.test.tsx"],
          setupFiles: ["tests/ui/setup.ts"],
        },
      },
    ],
  },
});
