import nextPlugin from "@next/eslint-plugin-next";
import tseslint from "typescript-eslint";

/**
 * ESLint 10 + typescript-eslint (loads TypeScript 6 via scripts/eslint-with-ts6.cjs).
 * Project compiler remains typescript@7 for Next / tsc.
 *
 * @type {import("eslint").Linter.Config[]}
 */
export default tseslint.config(
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      "eslint-with-ts6.cjs",
      "scripts/eslint-with-ts6.cjs",
    ],
  },
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{js,jsx,mjs,cjs,ts,tsx}"],
    plugins: {
      "@next/next": nextPlugin,
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
    },
  },
);
