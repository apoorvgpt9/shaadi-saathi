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
    languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname } },
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
    files: ["**/*.{js,mjs}"],
    extends: [tseslint.configs.disableTypeChecked],
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "coverage/**", ".claude/**", ".planning/**"]),
]);

export default eslintConfig;
