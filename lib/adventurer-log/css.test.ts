import * as csstree from "css-tree";
import { describe, expect, it } from "vitest";

import { DROPPED_MAX, RULES_MAX, sanitizeCss } from "./css";

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
    expect(clean(".al-page { background: url(/img/title/mm_sword.jpg) }")).toContain("url(/img/title/mm_sword.jpg)");
  });

  it("keeps the version the generated pictures carry, and no other query", () => {
    expect(sanitizeCss(".al-page { background: url(/img/game/items/995.png?v=f205cfb4) }", OWNER)).toEqual({
      css: expect.stringContaining("url(/img/game/items/995.png?v=f205cfb4)"),
      dropped: [],
    });
    expect(clean('.al-page { background: url("/img/game/textures/3.png?v=0123abcd") }')).toContain(
      "/img/game/textures/3.png?v=0123abcd",
    );
    for (const url of [
      "/img/game/items/995.png?v=f205cfb",
      "/img/game/items/995.png?v=f205cfb4a",
      "/img/game/items/995.png?v=F205CFB4",
      "/img/game/items/995.png?v=f205cfb4&x=1",
      "/img/game/items/995.png?x=f205cfb4",
      "/img/game/items/995.png?",
      "/img/game/items/995.png#x",
      "/img/../api/x.png?v=f205cfb4",
      "/img/a.png?v=../../x",
    ]) {
      expect(clean(`.al-page { background: url(${url}) }`), url).not.toContain("url(");
    }
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
    expect(out.dropped.filter((item) => item.reason.includes(String(RULES_MAX)))).toHaveLength(1);
  });

  it("refuses a stylesheet over the limit whole", () => {
    expect(sanitizeCss("a{}".repeat(8000), OWNER).css).toBe("");
  });

  it("says what it dropped", () => {
    const out = sanitizeCss("@import url(x); .al-page { background: url(https://x) }", OWNER);
    expect(out.dropped.map((item) => item.reason)).toEqual(
      expect.arrayContaining(["@import", "url() other than the site's own /img/ pictures"]),
    );
  });
});

describe("sanitizeCss: where", () => {
  it("says which line each thing it took out was on", () => {
    const raw = [
      "@import url(/img/a.css);", // 1
      ".al-page {", // 2
      "  color: red;", // 3
      "  background: url(https://evil.example/x.png);", // 4
      "}", // 5
      ".al-box:has(.x) { color: blue }", // 6
      ".al-name::after {", // 7
      '  content: "hello";', // 8
      "  -moz-binding: none;", // 9
      "}", // 10
      ".al-time { color gold }", // 11
    ].join("\n");
    expect(sanitizeCss(raw, OWNER).dropped).toEqual([
      { reason: "parts the parser could not read", line: 11 },
      { reason: "@import", line: 1 },
      { reason: "url() other than the site's own /img/ pictures", line: 4 },
      { reason: "the :has() selector", line: 6 },
      { reason: "content with letters or numbers in it", line: 8 },
      { reason: "the -moz-binding property", line: 9 },
    ]);
  });

  it("names the line of a value that runs over several", () => {
    const raw = ".al-page {\n  background:\n    #000\n    url(//evil.example/x.png);\n}";
    expect(sanitizeCss(raw, OWNER).dropped).toEqual([
      { reason: "url() other than the site's own /img/ pictures", line: 4 },
    ]);
  });

  it("reports a reason once per line, and every line it is on", () => {
    const raw = ".a { background: url(//x); border-image: url(//y) }\n.b { background: url(//z) }";
    expect(sanitizeCss(raw, OWNER).dropped).toEqual([
      { reason: "url() other than the site's own /img/ pictures", line: 1 },
      { reason: "url() other than the site's own /img/ pictures", line: 2 },
    ]);
  });

  it("finds the first backslash or < that refuses the whole sheet", () => {
    expect(sanitizeCss(".a { color: red }\r\n\n.b { font-family: '\\66oo' }", OWNER).dropped).toEqual([
      { reason: "everything: backslashes (CSS escapes) are not allowed", line: 3 },
    ]);
    expect(sanitizeCss("\n\n\n.a::after { content: '<' }", OWNER).dropped).toEqual([
      { reason: "everything: the < character is not allowed", line: 4 },
    ]);
    expect(sanitizeCss("a{}".repeat(8000), OWNER).dropped).toEqual([
      { reason: "everything: the stylesheet is over 20000 characters" },
    ]);
  });

  it("marks where the rule limit cuts, not every rule after it", () => {
    const raw = Array.from({ length: RULES_MAX + 20 }, (_, i) => `.a${i} { color: red }`).join("\n");
    expect(sanitizeCss(raw, OWNER).dropped).toEqual([
      { reason: `rules after the first ${RULES_MAX}`, line: RULES_MAX + 1 },
    ]);
  });

  it("says nothing about a stray semicolon, and does not call a typo a nested rule", () => {
    expect(sanitizeCss(".a { color: red;; }", OWNER).dropped).toEqual([]);
    expect(sanitizeCss(".a {\n  color red;\n  margin: 0\n}", OWNER)).toEqual({
      css: expect.stringContaining(".al-root .a{margin:0}"),
      dropped: [{ reason: "parts the parser could not read", line: 2 }],
    });
  });

  it("reports at most DROPPED_MAX things", () => {
    const raw = Array.from({ length: DROPPED_MAX + 50 }, (_, i) => `.a${i} { background: url(//x) }`).join("\n");
    const out = sanitizeCss(raw, OWNER);
    expect(out.dropped).toHaveLength(DROPPED_MAX);
    expect(out.dropped[0]).toEqual({ reason: "url() other than the site's own /img/ pictures", line: 1 });
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
