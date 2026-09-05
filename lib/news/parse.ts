import { categoryByName, type NewsCategory } from "./categories";

/**
 * News posts are Markdown files committed to this repo — no database, no
 * editor, no admin login. A post is `content/news/YYYY-MM-DD-slug.md` with
 * three-key frontmatter:
 *
 * ```
 * ---
 * title: Welcome to Zanaris
 * date: 2026-09-05
 * category: Website
 * ---
 * ```
 *
 * Everything here is pure and throws on anything malformed, because the only
 * place these errors can appear is a build — a typo in a post should fail the
 * deploy, not render an empty page in production.
 */

export type NewsPost = {
  /** The filename's slug: what `/news/<slug>` uses. */
  slug: string;
  title: string;
  /** `YYYY-MM-DD`, always the filename's date. */
  date: string;
  category: NewsCategory;
  /** The Markdown body, still unrendered. */
  body: string;
};

/**
 * Slugs the news routes need for themselves. `/news/page/2` and
 * `/news/category/website` are real paths, so a post may not be called
 * `page` or `category` or it would shadow one.
 */
export const RESERVED_SLUGS = ["page", "category"];

/** One list page, matching the original's table. */
export const PAGE_SIZE = 17;

const FILENAME = /^(\d{4}-\d{2}-\d{2})-([a-z0-9]+(?:-[a-z0-9]+)*)\.md$/;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function isRealDate(date: string): boolean {
  const match = ISO_DATE.exec(date);
  if (!match) return false;
  const [, year, month, day] = match;
  const parsed = new Date(`${date}T00:00:00Z`);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.getUTCFullYear() === Number(year) &&
    parsed.getUTCMonth() + 1 === Number(month) &&
    parsed.getUTCDate() === Number(day)
  );
}

export type Frontmatter = {
  title: string;
  date: string;
  category: NewsCategory;
  body: string;
};

/**
 * The three keys and the body. Hand-rolled rather than a YAML dependency:
 * three keys, one line each, no nesting and no quoting rules to get wrong.
 */
export function parseFrontmatter(source: string, where = "post"): Frontmatter {
  const normalised = source.replace(/\r\n/g, "\n");
  if (!normalised.startsWith("---\n")) {
    throw new Error(`${where}: must start with a "---" frontmatter block`);
  }

  const end = normalised.indexOf("\n---", 3);
  if (end === -1) {
    throw new Error(`${where}: the frontmatter block is not closed with "---"`);
  }

  const block = normalised.slice(4, end);
  const body = normalised.slice(end + 4).replace(/^\n/, "");

  const fields = new Map<string, string>();
  for (const line of block.split("\n")) {
    if (line.trim() === "") continue;
    const colon = line.indexOf(":");
    if (colon === -1) {
      throw new Error(`${where}: frontmatter line is not "key: value": ${line}`);
    }
    const key = line.slice(0, colon).trim();
    const value = line.slice(colon + 1).trim();
    if (fields.has(key)) {
      throw new Error(`${where}: duplicate frontmatter key "${key}"`);
    }
    fields.set(key, value);
  }

  for (const key of fields.keys()) {
    if (key !== "title" && key !== "date" && key !== "category") {
      throw new Error(`${where}: unknown frontmatter key "${key}"`);
    }
  }

  const title = fields.get("title");
  if (!title) {
    throw new Error(`${where}: frontmatter needs a non-empty "title"`);
  }

  const date = fields.get("date");
  if (!date || !isRealDate(date)) {
    throw new Error(`${where}: frontmatter "date" must be a real YYYY-MM-DD`);
  }

  const categoryName = fields.get("category");
  if (!categoryName) {
    throw new Error(`${where}: frontmatter needs a "category"`);
  }
  const category = categoryByName(categoryName);
  if (!category) {
    throw new Error(`${where}: unknown category "${categoryName}"`);
  }

  return { title, date, category, body };
}

/** `2026-09-05-welcome-to-zanaris.md` → date and slug. */
export function parseFilename(filename: string): {
  date: string;
  slug: string;
} {
  const match = FILENAME.exec(filename);
  if (!match) {
    throw new Error(
      `${filename}: news files are named YYYY-MM-DD-lower-case-slug.md`,
    );
  }
  const [, date, slug] = match;
  if (!isRealDate(date)) {
    throw new Error(`${filename}: "${date}" is not a real date`);
  }
  if (RESERVED_SLUGS.includes(slug)) {
    throw new Error(`${filename}: "${slug}" is a reserved slug`);
  }
  return { date, slug };
}

/** A whole post, with the filename and the frontmatter checked against each other. */
export function parsePost(filename: string, source: string): NewsPost {
  const { date, slug } = parseFilename(filename);
  const front = parseFrontmatter(source, filename);
  if (front.date !== date) {
    throw new Error(
      `${filename}: frontmatter date ${front.date} does not match the filename`,
    );
  }
  return {
    slug,
    title: front.title,
    date,
    category: front.category,
    body: front.body,
  };
}

/** Newest first; same-day posts fall back to the slug so the order is stable. */
export function sortNewestFirst(posts: NewsPost[]): NewsPost[] {
  return [...posts].sort((a, b) =>
    a.date === b.date ? a.slug.localeCompare(b.slug) : b.date.localeCompare(a.date),
  );
}

export type Page = {
  items: NewsPost[];
  page: number;
  pageCount: number;
  prevPage: number | null;
  nextPage: number | null;
};

/**
 * One page of a list. `pageCount` is at least 1 so an empty category is a page
 * that says nothing rather than a 404, and a page past the end is empty with
 * no next link rather than an error.
 */
export function paginate(posts: NewsPost[], page: number): Page {
  const pageCount = Math.max(1, Math.ceil(posts.length / PAGE_SIZE));
  const start = (page - 1) * PAGE_SIZE;
  const items = posts.slice(start, start + PAGE_SIZE);
  return {
    items,
    page,
    pageCount,
    prevPage: page > 1 ? page - 1 : null,
    nextPage: page < pageCount ? page + 1 : null,
  };
}

/**
 * The posts either side of one, in a list already sorted newest first.
 * `newer` is the one above it, `older` the one below — which is which matters,
 * because the prev arrow on a post means "more recent".
 */
export function neighbours(
  posts: NewsPost[],
  slug: string,
): { newer: NewsPost | null; older: NewsPost | null } {
  const index = posts.findIndex((post) => post.slug === slug);
  if (index === -1) return { newer: null, older: null };
  return {
    newer: index > 0 ? posts[index - 1] : null,
    older: index < posts.length - 1 ? posts[index + 1] : null,
  };
}

/** `2026-07-08` → `8-Jul-2026`, the list table's format. */
export function formatShortDate(date: string): string {
  const match = ISO_DATE.exec(date);
  if (!match) throw new Error(`not a YYYY-MM-DD date: ${date}`);
  const [, year, month, day] = match;
  return `${Number(day)}-${MONTHS[Number(month) - 1].slice(0, 3)}-${year}`;
}

/** `2026-07-08` → `8th July 2026`, the heading on a post. */
export function formatLongDate(date: string): string {
  const match = ISO_DATE.exec(date);
  if (!match) throw new Error(`not a YYYY-MM-DD date: ${date}`);
  const [, year, month, day] = match;
  const n = Number(day);
  // 11th, 12th and 13th are the exceptions the naive rule gets wrong.
  const suffix =
    n % 100 >= 11 && n % 100 <= 13
      ? "th"
      : n % 10 === 1
        ? "st"
        : n % 10 === 2
          ? "nd"
          : n % 10 === 3
            ? "rd"
            : "th";
  return `${n}${suffix} ${MONTHS[Number(month) - 1]} ${year}`;
}

/**
 * A list URL. Page 1 has no `/page/1` segment: one canonical path per page,
 * which is also what makes every one of them prerender.
 */
export function listHref(options: { category?: string; page?: number } = {}): string {
  const { category, page = 1 } = options;
  const base = category ? `/news/category/${category}` : "/news";
  return page > 1 ? `${base}/page/${page}` : base;
}

export function postHref(slug: string): string {
  return `/news/${slug}`;
}
