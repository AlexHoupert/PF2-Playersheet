import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import unusedImports from "eslint-plugin-unused-imports";
import globals from "globals";

export default [
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "src/data/**",
      "ressources/**",
      "recovery/**",
    ],
  },
  js.configs.recommended,
  {
    files: ["src/**/*.{js,jsx}", "tests/**/*.js", "scripts/**/*.js", "server/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      "react-hooks": reactHooks,
      "unused-imports": unusedImports,
    },
    rules: {
      ...Object.fromEntries(Object.keys(js.configs.recommended.rules || {}).map((rule) => [rule, "off"])),
      "no-undef": "error",
      "no-unused-vars": "off",
      "unused-imports/no-unused-imports": "warn",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "off",
    },
  },
];
