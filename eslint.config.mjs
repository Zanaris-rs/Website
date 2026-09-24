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
    // Vendored, not ours: minified bundles of the game client's code, and
    // the clone they are built from. Narrow on purpose — anything else that
    // lands in `public/` is ours and should be linted.
    "public/js/mapview.js",
    // Likewise the client's Model/Pix3D/Pix2D, bundled for the chathead.
    "public/game/chathead/renderer.js",
    ".cache/**",
  ]),
  {
    rules: {
      /*
       * Every link on this site is a plain `<a>`, and that is a decision, not
       * an oversight: `/worldmap` loads the vendored `public/js/mapview.js`,
       * which reaches for `document.getElementById` the moment it is
       * evaluated, so a `next/link` client-side navigation would hand it a
       * document whose canvas is not there yet. `components/site/Frame.tsx`
       * carries the long version, and a full page load is what the 2004 site
       * did anyway.
       *
       * The rule stayed quiet until Part 3 only because it fires once a page
       * directory has more than the one route in it — `/messages` grew
       * `[id]`, `new` and `tickets/[id]`, and it started flagging every link
       * to `/messages` on the site, including two written in Part 1.
       */
      "@next/next/no-html-link-for-pages": "off",
    },
  },
]);

export default eslintConfig;
