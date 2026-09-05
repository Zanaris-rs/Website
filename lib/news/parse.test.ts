import { describe, expect, it } from "vitest";

import {
  formatLongDate,
  formatShortDate,
  listHref,
  neighbours,
  PAGE_SIZE,
  paginate,
  parseFilename,
  parseFrontmatter,
  parsePost,
  postHref,
  sortNewestFirst,
  type NewsPost,
} from "./parse";

const GOOD = `---
title: Welcome to Zanaris
date: 2026-09-05
category: Website
---

Hello.
`;

function post(date: string, slug: string): NewsPost {
  return {
    slug,
    title: slug,
    date,
    category: {
      name: "Website",
      slug: "website",
      style: "lblue",
    },
    body: "",
  };
}

describe("parseFrontmatter", () => {
  it("reads the three keys and the body", () => {
    const front = parseFrontmatter(GOOD);
    expect(front.title).toBe("Welcome to Zanaris");
    expect(front.date).toBe("2026-09-05");
    expect(front.category.name).toBe("Website");
    expect(front.category.style).toBe("lblue");
    expect(front.body.trim()).toBe("Hello.");
  });

  it("throws without an opening ---", () => {
    expect(() => parseFrontmatter("title: nope\n")).toThrow(/frontmatter/);
  });

  it("throws when the block is never closed", () => {
    expect(() => parseFrontmatter("---\ntitle: nope\n")).toThrow(/not closed/);
  });

  it("throws without a title", () => {
    expect(() =>
      parseFrontmatter("---\ndate: 2026-09-05\ncategory: Website\n---\n"),
    ).toThrow(/title/);
  });

  it("throws on an unknown category", () => {
    expect(() =>
      parseFrontmatter(GOOD.replace("Website", "Rumours")),
    ).toThrow(/unknown category/);
  });

  it("throws on a date that is not a real day", () => {
    expect(() => parseFrontmatter(GOOD.replace("2026-09-05", "2026-02-30"))).toThrow(
      /YYYY-MM-DD/,
    );
  });

  it("throws on an unknown key", () => {
    expect(() => parseFrontmatter(GOOD.replace("title:", "headline:"))).toThrow(
      /unknown frontmatter key/,
    );
  });
});

describe("parseFilename", () => {
  it("splits the date from the slug", () => {
    expect(parseFilename("2026-09-05-welcome-to-zanaris.md")).toEqual({
      date: "2026-09-05",
      slug: "welcome-to-zanaris",
    });
  });

  it("throws on a filename with no date", () => {
    expect(() => parseFilename("welcome.md")).toThrow(/YYYY-MM-DD/);
  });

  it("throws on a reserved slug", () => {
    expect(() => parseFilename("2026-09-05-page.md")).toThrow(/reserved slug/);
    expect(() => parseFilename("2026-09-05-category.md")).toThrow(
      /reserved slug/,
    );
  });
});

describe("parsePost", () => {
  it("keeps the filename's date and slug", () => {
    const parsed = parsePost("2026-09-05-welcome-to-zanaris.md", GOOD);
    expect(parsed.slug).toBe("welcome-to-zanaris");
    expect(parsed.date).toBe("2026-09-05");
    expect(parsed.title).toBe("Welcome to Zanaris");
  });

  it("throws when the frontmatter date is not the filename's", () => {
    expect(() => parsePost("2026-09-06-welcome-to-zanaris.md", GOOD)).toThrow(
      /does not match the filename/,
    );
  });
});

describe("sortNewestFirst", () => {
  it("orders by date descending, then slug", () => {
    const sorted = sortNewestFirst([
      post("2026-01-01", "oldest"),
      post("2026-03-01", "b-same-day"),
      post("2026-03-01", "a-same-day"),
    ]);
    expect(sorted.map((p) => p.slug)).toEqual([
      "a-same-day",
      "b-same-day",
      "oldest",
    ]);
  });

  it("does not mutate its argument", () => {
    const posts = [post("2026-01-01", "a"), post("2026-02-01", "b")];
    sortNewestFirst(posts);
    expect(posts.map((p) => p.slug)).toEqual(["a", "b"]);
  });
});

describe("paginate", () => {
  const posts = Array.from({ length: 20 }, (_, i) =>
    post("2026-01-01", `post-${String(i).padStart(2, "0")}`),
  );

  it("puts seventeen on the first page", () => {
    const page = paginate(posts, 1);
    expect(PAGE_SIZE).toBe(17);
    expect(page.items).toHaveLength(17);
    expect(page.pageCount).toBe(2);
    expect(page.prevPage).toBeNull();
    expect(page.nextPage).toBe(2);
  });

  it("puts the remainder on the last page", () => {
    const page = paginate(posts, 2);
    expect(page.items).toHaveLength(3);
    expect(page.prevPage).toBe(1);
    expect(page.nextPage).toBeNull();
  });

  it("is empty past the end rather than an error", () => {
    const page = paginate(posts, 9);
    expect(page.items).toEqual([]);
    expect(page.nextPage).toBeNull();
  });

  it("reports one page when there is nothing at all", () => {
    const page = paginate([], 1);
    expect(page.items).toEqual([]);
    expect(page.pageCount).toBe(1);
    expect(page.prevPage).toBeNull();
    expect(page.nextPage).toBeNull();
  });
});

describe("neighbours", () => {
  const posts = [
    post("2026-03-01", "newest"),
    post("2026-02-01", "middle"),
    post("2026-01-01", "oldest"),
  ];

  it("finds the post either side", () => {
    expect(neighbours(posts, "middle")).toEqual({
      newer: posts[0],
      older: posts[2],
    });
  });

  it("has no newer post at the top and no older at the bottom", () => {
    expect(neighbours(posts, "newest").newer).toBeNull();
    expect(neighbours(posts, "oldest").older).toBeNull();
  });

  it("returns neither for a slug that is not in the list", () => {
    expect(neighbours(posts, "absent")).toEqual({ newer: null, older: null });
  });
});

describe("formatShortDate", () => {
  it("is the table's D-Mon-YYYY", () => {
    expect(formatShortDate("2026-07-08")).toBe("8-Jul-2026");
    expect(formatShortDate("2026-12-25")).toBe("25-Dec-2026");
  });
});

describe("formatLongDate", () => {
  it("gets the ordinals right", () => {
    expect(formatLongDate("2026-07-01")).toBe("1st July 2026");
    expect(formatLongDate("2026-07-02")).toBe("2nd July 2026");
    expect(formatLongDate("2026-07-03")).toBe("3rd July 2026");
    expect(formatLongDate("2026-07-04")).toBe("4th July 2026");
    expect(formatLongDate("2026-07-11")).toBe("11th July 2026");
    expect(formatLongDate("2026-07-12")).toBe("12th July 2026");
    expect(formatLongDate("2026-07-13")).toBe("13th July 2026");
    expect(formatLongDate("2026-07-21")).toBe("21st July 2026");
    expect(formatLongDate("2026-07-22")).toBe("22nd July 2026");
    expect(formatLongDate("2026-07-23")).toBe("23rd July 2026");
    expect(formatLongDate("2026-07-31")).toBe("31st July 2026");
  });
});

describe("hrefs", () => {
  it("covers every list shape", () => {
    expect(listHref()).toBe("/news");
    expect(listHref({ page: 1 })).toBe("/news");
    expect(listHref({ page: 2 })).toBe("/news/page/2");
    expect(listHref({ category: "website" })).toBe("/news/category/website");
    expect(listHref({ category: "website", page: 1 })).toBe(
      "/news/category/website",
    );
    expect(listHref({ category: "website", page: 3 })).toBe(
      "/news/category/website/page/3",
    );
  });

  it("builds a post link", () => {
    expect(postHref("welcome-to-zanaris")).toBe("/news/welcome-to-zanaris");
  });
});
