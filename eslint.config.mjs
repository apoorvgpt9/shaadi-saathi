import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import jsxA11y from "eslint-plugin-jsx-a11y";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

const eslintConfig = defineConfig([
  ...nextVitals,
  {
    files: ["src/**/*.{ts,tsx}", "tests/**/*.{ts,tsx}", "*.ts"],
    extends: [tseslint.configs.strictTypeChecked, tseslint.configs.stylisticTypeChecked],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      // Numbers in template literals are safe and read better than String(n).
      "@typescript-eslint/restrict-template-expressions": ["error", { allowNumber: true }],
      // Concise arrow handlers that return void calls are idiomatic in JSX props.
      "@typescript-eslint/no-confusing-void-expression": ["error", { ignoreArrowShorthand: true }],
    },
  },
  {
    files: ["src/**/*.{ts,tsx}", "tests/**/*.{ts,tsx}"],
    // Rules only: eslint-config-next already registers these plugins, and re-registering them throws.
    rules: {
      ...jsxA11y.flatConfigs.recommended.rules,
      ...reactHooks.configs.flat.recommended.rules,
      // A scrollable region must be keyboard focusable (WCAG 2.1.1), so a labelled region or log may take tabIndex 0.
      "jsx-a11y/no-noninteractive-tabindex": ["error", { roles: ["tabpanel", "region", "log"] }],
    },
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: { "no-console": "error" },
  },
  {
    // The request logger is the one place allowed to write to the console.
    files: ["src/lib/ai/logger.ts"],
    rules: { "no-console": "off" },
  },
  {
    // Layering: the engine is pure and browser-safe, so it may not reach the UI, the store, the
    // network layer or the AI layer, and it may not read the clock or storage.
    files: ["src/lib/plan/**/*.ts", "src/lib/format.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "react", message: "The engine has no UI dependencies." },
            { name: "react-dom", message: "The engine has no UI dependencies." },
            { name: "next", message: "The engine has no framework dependencies." },
            { name: "@/lib/api", message: "The engine does no I/O." },
            { name: "@/lib/store", message: "State depends on the engine, not the reverse." },
          ],
          patterns: [
            { group: ["next/*"], message: "The engine has no framework dependencies." },
            { group: ["@/lib/ai", "@/lib/ai/*"], message: "The engine never calls the AI layer." },
            { group: ["@/components/*"], message: "The engine never imports UI." },
          ],
        },
      ],
      "no-restricted-globals": [
        "error",
        { name: "localStorage", message: "Persistence belongs to usePlan, not the engine." },
        { name: "fetch", message: "The engine does no I/O." },
      ],
      "no-restricted-properties": [
        "error",
        { object: "Date", property: "now", message: "Take `today` as a parameter." },
        { object: "window", property: "localStorage", message: "The engine does not persist." },
        { object: "process", property: "env", message: "The engine reads no environment." },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector: "NewExpression[callee.name='Date'][arguments.length=0]",
          message: "Take `today` as a parameter instead of reading the clock.",
        },
      ],
    },
  },
  {
    // Layering: the server's AI layer and route handlers are stateless and never import the
    // engine, the client store, the browser API client or UI.
    files: ["src/lib/ai/**/*.ts", "src/app/api/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "@/lib/store", message: "Routes are stateless." },
            { name: "@/lib/api", message: "That is the browser's client for these routes." },
          ],
          patterns: [
            { group: ["@/lib/plan", "@/lib/plan/*"], message: "Routes never run the engine." },
            { group: ["@/components/*"], message: "Server code never imports UI." },
          ],
        },
      ],
    },
  },
  {
    files: ["**/*.{js,mjs}"],
    extends: [tseslint.configs.disableTypeChecked],
  },
  {
    // Every branch and loop body is braced, so adding a line never changes the control flow.
    rules: { curly: ["error", "all"] },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "coverage/**",
    ".claude/**",
    ".planning/**",
  ]),
]);

export default eslintConfig;
