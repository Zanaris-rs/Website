import { describe, expect, it } from "vitest";

import {
  assembleHandbook,
  parseSection,
  parseSectionFilename,
  renderSection,
  slugify,
  type HandbookSection,
} from "./handbook";

function section(
  order: number,
  slug: string,
  body: string,
  title = "A section",
): HandbookSection {
  return { order, slug, title, body };
}

describe("parseSectionFilename", () => {
  it("reads the order and the slug", () => {
    expect(parseSectionFilename("02-bans-and-mutes.md")).toEqual({
      order: 2,
      slug: "bans-and-mutes",
    });
  });

  it("keeps the leading zero out of the number", () => {
    expect(parseSectionFilename("09-tickets.md").order).toBe(9);
    expect(parseSectionFilename("10-privacy.md").order).toBe(10);
  });

  it.each([
    "1-bans.md",
    "001-bans.md",
    "02_bans.md",
    "02-Bans.md",
    "02-bans--and-mutes.md",
    "02-bans-and-mutes.markdown",
    "bans-and-mutes.md",
    "02-.md",
  ])("refuses %s", (filename) => {
    expect(() => parseSectionFilename(filename)).toThrow(
      /named NN-lower-case-slug/,
    );
  });
});

describe("slugify", () => {
  it("lower-cases and joins with dashes", () => {
    expect(slugify("What the player sees")).toBe("what-the-player-sees");
  });

  it("collapses punctuation and trims the ends", () => {
    expect(slugify("`::ban <username> <minutes>`")).toBe("ban-username-minutes");
    expect(slugify("Kick, track — and visibility")).toBe(
      "kick-track-and-visibility",
    );
  });

  it("is empty when there is nothing to slug", () => {
    expect(slugify("—")).toBe("");
  });
});

describe("parseSection", () => {
  it("takes the title from the frontmatter and the rest as the body", () => {
    const parsed = parseSection(
      "01-who-does-what.md",
      "---\ntitle: Who does what\n---\n\n### Levels\n\nText.\n",
    );
    expect(parsed).toEqual({
      order: 1,
      slug: "who-does-what",
      title: "Who does what",
      // One leading newline survives the fences, as it does for a news post.
      body: "\n### Levels\n\nText.\n",
    });
  });

  it("reads a CRLF file", () => {
    const parsed = parseSection(
      "01-who.md",
      "---\r\ntitle: Who\r\n---\r\n\r\nText.\r\n",
    );
    expect(parsed.title).toBe("Who");
    expect(parsed.body).toBe("\nText.\n");
  });

  it("refuses a second frontmatter key", () => {
    expect(() =>
      parseSection(
        "01-who.md",
        "---\ntitle: Who\ndate: 2026-09-06\n---\n\nText.\n",
      ),
    ).toThrow(/the only frontmatter key is "title", not "date"/);
  });

  it("refuses an empty title", () => {
    expect(() =>
      parseSection("01-who.md", "---\ntitle:\n---\n\nText.\n"),
    ).toThrow(/non-empty "title"/);
  });

  it("refuses a missing title", () => {
    expect(() =>
      parseSection("01-who.md", "---\n---\n\nText.\n"),
    ).toThrow(/non-empty "title"/);
  });

  it("refuses a file with no frontmatter at all", () => {
    expect(() => parseSection("01-who.md", "### Levels\n")).toThrow(
      /must start with a "---" frontmatter block/,
    );
  });

  it("refuses an unclosed frontmatter block", () => {
    expect(() => parseSection("01-who.md", "---\ntitle: Who\n")).toThrow(
      /not closed with "---"/,
    );
  });

  it("refuses an empty body", () => {
    expect(() =>
      parseSection("01-who.md", "---\ntitle: Who\n---\n\n   \n"),
    ).toThrow(/has no body/);
  });

  it("names the file it is complaining about", () => {
    expect(() => parseSection("07-evidence.md", "nope")).toThrow(
      /^07-evidence\.md:/,
    );
  });
});

describe("renderSection", () => {
  it("gives every heading an id prefixed with the section slug", () => {
    const html = renderSection(
      section(2, "bans-and-mutes", "### What the player sees\n"),
    );
    expect(html).toContain(
      '<h3 id="bans-and-mutes-what-the-player-sees">What the player sees</h3>',
    );
  });

  it("renders the inline Markdown inside a heading, but slugs its text", () => {
    const html = renderSection(section(2, "bans", "### The `::ban` command\n"));
    expect(html).toContain('id="bans-the-ban-command"');
    expect(html).toContain("<code>::ban</code>");
  });

  it("scopes ids to the section, so two sections may share a heading", () => {
    const one = renderSection(section(2, "bans-and-mutes", "### Durations\n"));
    const two = renderSection(section(4, "lifting", "### Durations\n"));
    expect(one).toContain('id="bans-and-mutes-durations"');
    expect(two).toContain('id="lifting-durations"');
  });

  it("falls back to the section slug when a heading has nothing to slug", () => {
    const html = renderSection(section(1, "who-does-what", "### —\n"));
    expect(html).toContain('id="who-does-what"');
  });

  it("renders GFM tables", () => {
    const html = renderSection(
      section(
        1,
        "who-does-what",
        "| Level | Who |\n| --- | --- |\n| 2 | moderator |\n",
      ),
    );
    expect(html).toContain("<table>");
    expect(html).toContain("<td>moderator</td>");
  });

  it("passes raw HTML through, by design", () => {
    // The same waiver as `lib/news/render.ts`. Every section opens with an
    // HTML comment naming its source, and this is the line that lets it
    // through — pinned here so the decision cannot be reversed by accident.
    const html = renderSection(
      section(1, "who-does-what", "<!-- Source: level.ts -->\n\nText.\n"),
    );
    expect(html).toContain("<!-- Source: level.ts -->");
  });

  it("does not leak its renderer into the shared marked instance", async () => {
    renderSection(section(1, "who-does-what", "### Levels\n"));
    const { renderMarkdown } = await import("@/lib/news/render");
    expect(renderMarkdown("### Levels\n")).toBe("<h3>Levels</h3>\n");
  });
});

describe("assembleHandbook", () => {
  it("orders the sections by their number, not by the order read", () => {
    const book = assembleHandbook([
      section(10, "privacy", "Text.\n", "Rules of thumb"),
      section(2, "bans-and-mutes", "Text.\n", "Bans and mutes"),
      section(1, "who-does-what", "Text.\n", "Who does what"),
    ]);
    expect(book.sections.map((entry) => entry.slug)).toEqual([
      "who-does-what",
      "bans-and-mutes",
      "privacy",
    ]);
  });

  it("gives the contents list the same order and the section titles", () => {
    const book = assembleHandbook([
      section(2, "bans-and-mutes", "Text.\n", "Bans and mutes"),
      section(1, "who-does-what", "Text.\n", "Who does what"),
    ]);
    expect(book.contents).toEqual([
      { slug: "who-does-what", title: "Who does what" },
      { slug: "bans-and-mutes", title: "Bans and mutes" },
    ]);
  });

  it("renders each section's body", () => {
    const book = assembleHandbook([section(1, "who", "### Levels\n")]);
    expect(book.sections[0].html).toContain('<h3 id="who-levels">');
  });

  it("throws on a duplicate order", () => {
    expect(() =>
      assembleHandbook([section(4, "lifting", "a\n"), section(4, "appeals", "b\n")]),
    ).toThrow(/duplicate order 4/);
  });

  it("throws on a duplicate slug", () => {
    expect(() =>
      assembleHandbook([section(4, "lifting", "a\n"), section(5, "lifting", "b\n")]),
    ).toThrow(/duplicate slug "lifting"/);
  });

  it("is an empty book rather than an error when there is nothing to read", () => {
    expect(assembleHandbook([])).toEqual({ contents: [], sections: [] });
  });
});
