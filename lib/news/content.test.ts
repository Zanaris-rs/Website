import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { parsePost } from "./parse";
import { renderMarkdown } from "./render";

/**
 * The posts actually committed to `content/news`, checked the way the build
 * checks them. A malformed post already fails `next build`; this catches it in
 * a second rather than a minute, and names the file.
 *
 * `lib/news/index.ts` is `server-only` and cannot be imported here, so this
 * reads the directory itself.
 */
const NEWS_DIR = join(process.cwd(), "content", "news");
const FILES = readdirSync(NEWS_DIR).filter((name) => name.endsWith(".md"));

describe("content/news", () => {
  it("has at least one post", () => {
    expect(FILES.length).toBeGreaterThan(0);
  });

  it("holds nothing but .md files", () => {
    expect(readdirSync(NEWS_DIR)).toEqual(FILES);
  });

  it.each(FILES)("%s parses and renders", (file) => {
    const post = parsePost(file, readFileSync(join(NEWS_DIR, file), "utf8"));
    expect(post.title.length).toBeGreaterThan(0);
    expect(post.body.trim().length).toBeGreaterThan(0);
    expect(renderMarkdown(post.body).length).toBeGreaterThan(0);
  });

  it("has unique slugs", () => {
    const slugs = FILES.map(
      (file) => parsePost(file, readFileSync(join(NEWS_DIR, file), "utf8")).slug,
    );
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});
