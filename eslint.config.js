const js = require("@eslint/js");
const nextPlugin = require("@next/eslint-plugin-next");
const tseslint = require("typescript-eslint");

module.exports = tseslint.config(
  {
    ignores: [
      ".next/**",
      ".next-build/**",
      "node_modules/**",
      "next-env.d.ts",
      "eslint.config.js",
      "tsconfig.tsbuildinfo"
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: __dirname
      }
    },
    plugins: {
      "@next/next": nextPlugin
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules
    }
  }
);
