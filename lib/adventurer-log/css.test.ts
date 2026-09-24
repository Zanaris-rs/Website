import * as csstree from "css-tree";
import { describe, expect, it } from "vitest";

import { RULES_MAX, sanitizeCss } from "./css";

const OWNER = "hero";

function clean(raw: string): string {
  return sanitizeCss(raw, OWNER).css;
}

/** Every selector in the output starts inside the log. */
function everySelectorScoped(css: string): boolean {
  const ast = csstree.parse(css);
  let ok = true;
  csstree.walk(ast, {
    visit: "Rule",
    enter(rule) {
      if (rule.prelude.type !== "SelectorList") return;
      // keyframe steps (from, 50%) are not selectors
      if (this.atrule && this.atrule.name.endsWith("keyframes")) return;
      rule.prelude.children.forEach((selector) => {
        if (!csstree.generate(selector).startsWith(".al-root ")) ok = false;
      });
    },
  });
  return ok;
}

describe("sanitizeCss: what it keeps", () => {
  it("keeps ordinary styling, scoped to the log", () => {
    const css = clean(".al-update { color: pink; border: 1px solid gold } .al-name:hover { text-decoration: underline }");
    expect(css).toContain(".al-root .al-update{color:pink;border:1px solid gold}");
    expect(css).toContain(".al-root .al-name:hover{text-decoration:underline}");
  });

  it("reads html, body and :root as the log's page", () => {
    expect(clean("body { background: black }")).toContain(".al-root .al-page{background:black}");
    expect(clean("html body .al-box { color: red }")).toContain(".al-root .al-page .al-box{color:red}");
    expect(clean(":root { --accent: red }")).toContain(".al-root .al-page{--accent: red");
  });

  it("keeps the site's own pictures", () => {
    expect(clean(".al-page { background: url(/img/game/items/1038.png) }")).toContain("url(/img/game/items/1038.png)");
  });

  it("keeps @media and @supports, and names keyframes apart", () => {
    const css = clean(
      "@media (max-width: 600px) { .al-side { display: none } } @keyframes glow { from { opacity: .5 } to { opacity: 1 } } .al-title { animation: glow 2s infinite }",
    );
    expect(css).toContain("@media (max-width:600px){.al-root .al-side{display:none}}");
    expect(css).toContain("@keyframes al-hero-glow");
    expect(css).toContain("animation:al-hero-glow 2s infinite");
  });

  it("lets content draw symbols", () => {
    expect(clean('.al-name::before { content: "★ " }')).toContain('content:"★ "');
  });

  it("adds the reduced-motion override", () => {
    expect(clean(".al-page { color: red }")).toContain("prefers-reduced-motion:reduce");
  });

  it("is empty for nothing", () => {
    expect(sanitizeCss("   ", OWNER)).toEqual({ css: "", dropped: [] });
  });
});

describe("sanitizeCss: what it refuses", () => {
  const attacks: [string, string][] = [
    ["remote url", ".al-page { background: url(https://evil.example/x.png) }"],
    ["protocol-relative url", ".al-page { background: url(//evil.example/x.png) }"],
    ["data url", ".al-page { background: url(data:image/png;base64,AAAA) }"],
    ["path escaping /img", ".al-page { background: url(/img/../api/x.png) }"],
    ["quoted remote url", '.al-page { background: url("https://evil.example") }'],
    ["image-set", '.al-page { background: image-set("https://evil.example/x.png" 1x) }'],
    ["cross-fade", ".al-page { background: cross-fade(url(/img/a.png), url(/img/b.png), 50%) }"],
    ["element()", ".al-page { background: -moz-element(#header) }"],
    ["expression", ".al-page { width: expression(alert(1)) }"],
    ["attr()", ".al-page::after { content: attr(data-x) }"],
    ["custom property url", ".al-page { --x: url(https://evil.example); background: var(--x) }"],
    ["custom property image-set", '.al-page { --x: image-set("//evil" 1x) }'],
    ["behavior", ".al-page { behavior: url(x.htc) }"],
    ["-moz-binding", ".al-page { -moz-binding: url(x.xml) }"],
    ["content words", '.al-reply-body::after { content: "Staff: this player is banned" }'],
    ["content digits", '.al-reply-body::after { content: "1234" }'],
  ];

  it.each(attacks)("%s", (_name, raw) => {
    const css = clean(raw);
    expect(css).not.toMatch(/evil|image-set|cross-fade|element\(|expression|attr\(|behavior|binding|banned|1234|data:/i);
  });

  it("drops @import, @font-face and friends whole", () => {
    for (const raw of [
      "@import url(https://evil.example/x.css); .al-page{color:red}",
      "@font-face { font-family: x; src: url(https://evil.example/f.woff) }",
      "@namespace svg url(http://www.w3.org/2000/svg);",
      "@layer x { .al-page { color: red } }",
      "@property --x { syntax: '<color>'; inherits: false; initial-value: red }",
    ]) {
      const css = clean(raw);
      expect(css).not.toMatch(/@import|@font-face|@namespace|@layer|@property|evil/);
    }
  });

  it("takes !important off everything the owner wrote", () => {
    const owners = clean(".al-page { contain: none !important; color: red!important }").split("@media (prefers-reduced-motion")[0];
    expect(owners).not.toContain("important");
    expect(clean(".al-page { contain: none !important }")).toContain(".al-root .al-page{contain:none}");
  });

  it("refuses backslash escapes and <, which could slip past every other check", () => {
    expect(sanitizeCss(".al-page { background: u\\72l(https://evil) }", OWNER).css).toBe("");
    expect(sanitizeCss(".al-page { font-family: '</style><script>alert(1)</script>' }", OWNER).css).toBe("");
  });

  it("refuses :has() and nesting", () => {
    expect(clean(".al-page:has(.x) { color: red }")).toBe("");
    expect(clean(".al-page { color: red; .x { color: blue } }")).not.toContain("blue");
  });

  it("slows anything faster than a fifth of a second", () => {
    expect(clean("@keyframes f { to { opacity: 0 } } .al-title { animation: f 50ms infinite }")).toContain("animation:al-hero-f 0.2s infinite");
    expect(clean(".al-title { animation-duration: 0.01s }")).toContain("animation-duration:0.2s");
  });

  it("keeps at most RULES_MAX rules", () => {
    const raw = Array.from({ length: RULES_MAX + 20 }, (_, i) => `.a${i}{color:red}`).join("");
    const out = sanitizeCss(raw, OWNER);
    expect(out.css.match(/color:red/g)).toHaveLength(RULES_MAX);
    expect(out.dropped.some((reason) => reason.includes(String(RULES_MAX)))).toBe(true);
  });

  it("refuses a stylesheet over the limit whole", () => {
    expect(sanitizeCss("a{}".repeat(8000), OWNER).css).toBe("");
  });

  it("says what it dropped", () => {
    const out = sanitizeCss("@import url(x); .al-page { background: url(https://x) }", OWNER);
    expect(out.dropped).toEqual(expect.arrayContaining(["@import", "url() other than the site's own /img/ pictures"]));
  });
});

describe("sanitizeCss: invariants", () => {
  const corpus = [
    "body{background:#000} .al-update{color:pink} @media (min-width:900px){.al-side{order:2}}",
    "a,b>c~d+e,.al-root .x,*{margin:0} [data-x^=a]{color:red} .x:not(.y)::before{content:'»'}",
    "@supports (display:grid){:root .al-page{display:grid}} @keyframes spin{to{transform:rotate(1turn)}} .al-chathead{animation:spin 3s linear infinite}",
  ];

  it.each(corpus)("scopes every selector and is stable when run again: %s", (raw) => {
    const once = clean(raw);
    expect(everySelectorScoped(once)).toBe(true);
    // Running the output through again only adds another scope; nothing
    // dropped comes back and nothing kept is lost.
    const twice = sanitizeCss(once.replace(/@media \(prefers-reduced-motion:reduce\)\{[^}]*\}\}/, ""), OWNER);
    expect(twice.dropped).toEqual([]);
  });
});
