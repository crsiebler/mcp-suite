module.exports = {
  root: true,
  env: { node: true, es2022: true },
  parserOptions: { ecmaVersion: "latest", sourceType: "module" },
  extends: ["eslint:recommended"],
  ignorePatterns: [
    "**/dist/**",
    "**/node_modules/**",
    "**/*.d.ts",
    "shared/**/*.js",
  ],
  overrides: [
    {
      files: ["**/*.ts"],
      parser: "@typescript-eslint/parser",
      // TypeScript owns symbol checks; unused declarations are not a baseline gate.
      rules: { "no-undef": "off", "no-unused-vars": "off" },
    },
  ],
};
