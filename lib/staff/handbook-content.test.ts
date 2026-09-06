import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { assembleHandbook, parseSection, renderSection } from "./handbook";

/**
 * The sections actually committed to `content/staff`, checked the way the page
 * checks them — and then checked for the things a *page* cannot notice.
 *
 * `handbook-server.ts` is `server-only` and cannot be imported here, so this
 * reads the directory itself, exactly as `lib/news/content.test.ts` does.
 *
 * The handbook is read on a request rather than at build time, so a malformed
 * section does not fail the deploy: it fails the page, for a moderator, at the
 * moment they needed it. These tests are what turns that into a red `npm test`
 * naming the file instead.
 *
 * The last four are about what a staff page must not become. It is rendered
 * unsanitised (`handbook.ts` says why), so a `<script` in a section is a
 * script on a moderator's session — and the handbook is the operator's
 * material rewritten for people who do not have the database, so an address, a
 * connection string or the name of a secret has wandered in from the wrong
 * document.
 */
const HANDBOOK_DIR = join(process.cwd(), "content", "staff");
const ENTRIES = readdirSync(HANDBOOK_DIR);
const FILES = ENTRIES.filter((name) => name.endsWith(".md"));

function read(file: string): string {
  return readFileSync(join(HANDBOOK_DIR, file), "utf8");
}

const SECTIONS = FILES.map((file) => parseSection(file, read(file)));

/** Anything shaped like an address; operator material, never moderator material. */
const IPV4 = /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/;

/**
 * Words that belong to the operator's runbook. "password" is deliberately not
 * one of them: the handbook has to say "never ask a player for one".
 */
const OPERATOR_ONLY = ["postgres://", "psql", "SESSION_SECRET", "DATABASE_URL"];

describe("content/staff", () => {
  it("has sections", () => {
    expect(FILES.length).toBeGreaterThan(0);
  });

  it("holds nothing but .md files", () => {
    expect(ENTRIES).toEqual(FILES);
  });

  it.each(FILES)("%s parses and renders", (file) => {
    const section = parseSection(file, read(file));
    expect(section.title.length).toBeGreaterThan(0);
    expect(section.body.trim().length).toBeGreaterThan(0);
    expect(renderSection(section).length).toBeGreaterThan(0);
  });

  it.each(FILES)("%s opens with an HTML comment naming its sources", (file) => {
    expect(parseSection(file, read(file)).body.trimStart()).toMatch(
      /^<!--[\s\S]*?-->/,
    );
  });

  it.each(FILES)("%s keeps h1 and h2 for the page itself", (file) => {
    // The section's own title is the `<h2>`, so a body that reaches for one is
    // claiming to be a second section; `#` would claim to be the page.
    const offending = parseSection(file, read(file))
      .body.split("\n")
      .filter((line) => /^#{1,2}\s/.test(line));
    expect(offending).toEqual([]);
  });

  it("assembles, so the orders and the slugs are unique", () => {
    expect(() => assembleHandbook(SECTIONS)).not.toThrow();
  });

  it("gives every heading in the book its own id", () => {
    const book = assembleHandbook(SECTIONS);
    const ids = book.sections.flatMap((section) => [
      // The `<section id>` the contents list links to, which a heading id must
      // not collide with either.
      section.slug,
      ...[...section.html.matchAll(/ id="([^"]+)"/g)].map(([, id]) => id),
    ]);
    const seen = new Set<string>();
    const duplicates = ids.filter((id) => !seen.add(id));
    expect(duplicates).toEqual([]);
  });

  it.each(FILES)("%s has no script in it", (file) => {
    expect(read(file).toLowerCase()).not.toContain("<script");
  });

  it.each(FILES)("%s names no address", (file) => {
    expect(read(file)).not.toMatch(IPV4);
  });

  it.each(FILES)("%s leaves the operator's material out", (file) => {
    const source = read(file);
    for (const word of OPERATOR_ONLY) {
      expect(source).not.toContain(word);
    }
  });
});
