import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Vendored, not ours: a minified bundle of the game client's map applet,
    // and the clone it is built from. Narrow on purpose — anything else that
    // lands in `public/` is ours and should be linted.
    "public/js/mapview.js",
    ".cache/**",
  ]),
]);

export default eslintConfig;
