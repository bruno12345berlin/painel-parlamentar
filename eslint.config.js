import js from "@eslint/js";
import tseslint from "typescript-eslint";
import astro from "eslint-plugin-astro";

export default [
  { ignores: ["dist/", ".astro/", "node_modules/", "data/"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...astro.configs.recommended,
  // Fatia vertical descartável (Fase 2): JSON bruto das APIs sem schema. O pipeline definitivo usa zod.
  { files: ["pipeline/slice/**"], rules: { "@typescript-eslint/no-explicit-any": "off" } },
];
