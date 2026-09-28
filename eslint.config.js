import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default [
  { ignores: ["dist/**", "node_modules/**", "coverage/**", "devlog/**"] },
  { ...js.configs.recommended, files: ["**/*.{js,mjs}"] },
  { files: ["**/*.{js,mjs}"], languageOptions: { globals: globals.node } },
  ...tseslint.configs.recommendedTypeChecked.map((config) => ({
    ...config,
    files: ["**/*.ts"],
    languageOptions: {
      ...config.languageOptions,
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
      globals: globals.node,
    },
  })),
  { files: ["**/*.ts"], rules: {
    "@typescript-eslint/no-floating-promises": "error",
    "@typescript-eslint/consistent-type-imports": "error",
    "@typescript-eslint/require-await": "off",
  } },
  { files: ["**/*.test.ts"], rules: { "@typescript-eslint/no-floating-promises": "off" } },
  { files: ["src/project/**/*.ts", "src/sampler/**/*.ts", "src/automation/**/*.ts"],
    ignores: ["**/*.test.ts"], rules: {
    "no-restricted-properties": ["error",
      { object: "Math", property: "random", message: "Audio and project logic must be deterministic" },
      { object: "performance", property: "now", message: "Audio and project logic must be deterministic" },
      { object: "crypto", property: "randomUUID", message: "Audio and project logic must be deterministic" },
    ],
    "no-restricted-globals": ["error", { name: "Date", message: "Audio and project logic must be deterministic" }],
  } },
];
