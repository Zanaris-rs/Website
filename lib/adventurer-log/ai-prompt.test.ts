import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { aiPrompt, CONTENT_SYMBOLS, LOOK_PLACEHOLDER } from "./ai-prompt";
import { sanitizeCss } from "./css";
import { CSS_MAX } from "./format";

const COMPONENTS = path.join(__dirname, "../../components");

/** Everything drawn inside `.al-root`, which is where an owner's classes live. */
const LOG_SOURCES = [
  "adventurer-log/LogView.tsx",
  "adventurer-log/Wardrobe.tsx",
  "adventurer-log/Timeline.tsx",
  "adventurer-log/Entry.tsx",
  "adventurer-log/LevelRun.tsx",
  "adventurer-log/Body.tsx",
  "adventurer-log/Composer.tsx",
  "adventurer-log/ReportButton.tsx",
];

/**
 * Every `al-` class named in some text. A modifier (`al-event--level`,
 * `al-skill--1`, or `al-event--${slug}` in a component) counts as its family,
 * `al-event--`, since the components build the suffixes from data.
 */
function classes(text: string): string[] {
  return [...new Set(text.match(/\bal-[a-z]+(?:-[a-z]+)*(?:--)?/g) ?? [])].sort();
}

function sanitised(css: string) {
  return sanitizeCss(css, "zezima", CSS_MAX);
}

describe("aiPrompt", () => {
  const prompt = aiPrompt("");

  it("names every al- class the log draws, and none it does not", () => {
    const drawn = classes(LOG_SOURCES.map((file) => readFileSync(path.join(COMPONENTS, file), "utf8")).join("\n"));
    expect(classes(prompt)).toEqual(drawn);
  });

  it("lists only pictures the sanitiser keeps", () => {
    // Every address it gives; the rules also say `url(...)` in prose.
    const urls = prompt.match(/url\(\/[^)]*\)/g) ?? [];
    expect(urls.length).toBeGreaterThan(50);
    for (const url of urls) {
      expect(sanitised(`.a { background: ${url} }`).dropped, url).toEqual([]);
    }
  });

  it("gives a content example the sanitiser keeps", () => {
    expect(sanitised(`.a::before { content: "${CONTENT_SYMBOLS}" }`).dropped).toEqual([]);
  });

  it("asks for the look, and adds the owner's stylesheet only when there is one", () => {
    expect(prompt).toContain(LOOK_PLACEHOLDER);
    expect(prompt).not.toContain("## My stylesheet now");

    const withSheet = aiPrompt("  .al-box { color: red }\n");
    expect(withSheet).toContain("## My stylesheet now");
    expect(withSheet.endsWith("```css\n.al-box { color: red }\n```\n")).toBe(true);
  });
});

/**
 * The prompt's rules are prose, so these hold the sanitiser to each one: if
 * `css.ts` changes what it allows, the prompt has to change with it.
 */
describe("the rules the prompt states", () => {
  it("1: every selector is scoped, and html/body/:root mean the page", () => {
    expect(sanitised(".al-box h2 { color: red }").css).toContain(".al-root .al-box h2{color:red}");
    expect(sanitised("body { color: red }").css).toContain(".al-root .al-page{color:red}");
  });

  it("2: a backslash or a < throws away everything", () => {
    for (const bad of ['.a::before { content: "\\2605" }', "/* a < b */ .a { color: red }"]) {
      const out = sanitised(bad);
      expect(out.css).toBe("");
      expect(out.dropped[0].reason).toMatch(/^everything/);
    }
  });

  it("3: pictures from anywhere else are dropped", () => {
    expect(sanitised(".a { background: url(https://example.com/a.png) }").dropped).not.toEqual([]);
    expect(sanitised(".a { background: url(data:image/png;base64,AAAA) }").dropped).not.toEqual([]);
  });

  it("4 and 5: @import and @font-face and other at-rules go; @media, @supports and @keyframes stay", () => {
    expect(sanitised("@import url(/img/background.jpg);").dropped).not.toEqual([]);
    expect(sanitised("@font-face { font-family: x }").dropped).not.toEqual([]);
    expect(sanitised("@layer x { .a { color: red } }").dropped).not.toEqual([]);
    expect(
      sanitised(
        "@media (min-width: 900px) { .a { color: red } } @supports (display: grid) { .a { display: grid } } @keyframes glow { 50% { opacity: 0.5 } } .a { animation: glow 2s infinite }",
      ).dropped,
    ).toEqual([]);
  });

  it("6: nesting and :has() are dropped", () => {
    expect(sanitised(".a { & .b { color: red } }").dropped).not.toEqual([]);
    expect(sanitised(".a:has(.b) { color: red }").dropped).not.toEqual([]);
  });

  it("7: !important is taken off", () => {
    expect(sanitised(".a { color: red !important }").css).toContain(".al-root .a{color:red}");
  });

  it("8: content with letters or digits is dropped", () => {
    expect(sanitised('.a::before { content: "Zezima" }').dropped).not.toEqual([]);
    expect(sanitised('.a::before { content: "99" }').dropped).not.toEqual([]);
  });

  it("9: the listed functions, and custom properties that load, are dropped", () => {
    expect(sanitised(".a { width: attr(data-x) }").dropped).not.toEqual([]);
    expect(sanitised(".a { --bg: url(/img/background.jpg) }").dropped).not.toEqual([]);
  });

  it("10: fast animations are slowed, and reduced motion gets none", () => {
    const out = sanitised("@keyframes spin { to { opacity: 0 } } .a { animation: spin 0.05s infinite }");
    expect(out.css).not.toContain(".05s");
    expect(out.css).toContain("prefers-reduced-motion");
  });
});
