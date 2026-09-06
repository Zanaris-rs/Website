import { Marked } from "marked";

import { splitFrontmatter } from "@/lib/news/parse";

/**
 * The staff moderation handbook: ten Markdown files in `content/staff`,
 * rendered into one page behind the staff gate.
 *
 * It is a *book*, not a list of posts, which is the whole of why this is not
 * `lib/news`. A section has an order rather than a date, there is one page
 * rather than one URL each, and the thing a reader needs most is a contents
 * list they can jump around in — so every section and every heading inside it
 * gets an anchor, and the ids are prefixed with the section's slug so two
 * sections may both have a "What the player sees" without colliding.
 *
 * **The output is not sanitised, deliberately** — the same trust model as
 * `lib/news/render.ts`, and the same waiver. These are files committed to this
 * repository and reviewed in a pull request; raw HTML in one is a feature (the
 * source comment at the top of every section is an HTML comment), and there is
 * no path by which an untrusted person can add a file here. Two things guard
 * the difference between "unsanitised" and "unread": `handbook-content.test.ts`
 * refuses a `<script` in any committed section, and the page is staff-only. If
 * a section ever becomes something a logged-in user can write, this is the
 * first line that has to change.
 *
 * Everything here is pure. The half that touches the filesystem is
 * `handbook-server.ts`.
 */

export type HandbookSection = {
  /** `01` … `10`: the order the sections are read in. */
  readonly order: number;
  /** The filename's slug, which is the section's anchor id. */
  readonly slug: string;
  /** The one frontmatter key, rendered as the section's `<h2>`. */
  readonly title: string;
  /** The Markdown body, still unrendered. */
  readonly body: string;
};

export type RenderedSection = {
  readonly slug: string;
  readonly title: string;
  /** The body as HTML, with an `id` on every heading in it. */
  readonly html: string;
};

export type ContentsEntry = {
  readonly slug: string;
  readonly title: string;
};

export type Handbook = {
  readonly contents: readonly ContentsEntry[];
  readonly sections: readonly RenderedSection[];
};

const FILENAME = /^(\d{2})-([a-z0-9]+(?:-[a-z0-9]+)*)\.md$/;

/**
 * Heading text to an anchor id: lower case, runs of anything else collapsed to
 * one dash, no dash at either end.
 *
 * Deliberately lossy and deliberately simple. "The `::ban` command" and "The
 * ban command" produce the same id, which is a collision the content test
 * catches by name rather than a rule this function has to be clever about.
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** `02-bans-and-mutes.md` → order 2, slug `bans-and-mutes`. */
export function parseSectionFilename(filename: string): {
  order: number;
  slug: string;
} {
  const match = FILENAME.exec(filename);
  if (!match) {
    throw new Error(
      `${filename}: handbook files are named NN-lower-case-slug.md`,
    );
  }
  const [, order, slug] = match;
  return { order: Number(order), slug };
}

/**
 * One section: the filename's order and slug, and the single `title:` key.
 *
 * One key, and the check says so, because the failure this is guarding against
 * is a section copied from a news post with a `date:` and a `category:` still
 * on it — which would otherwise be silently ignored and read as deliberate.
 */
export function parseSection(
  filename: string,
  source: string,
): HandbookSection {
  const { order, slug } = parseSectionFilename(filename);
  const { fields, body } = splitFrontmatter(source, filename);

  for (const key of fields.keys()) {
    if (key !== "title") {
      throw new Error(
        `${filename}: the only frontmatter key is "title", not "${key}"`,
      );
    }
  }

  const title = fields.get("title");
  if (!title) {
    throw new Error(`${filename}: frontmatter needs a non-empty "title"`);
  }

  if (body.trim() === "") {
    throw new Error(`${filename}: the section has no body`);
  }

  return { order, slug, title, body };
}

/**
 * A Markdown renderer for one section, with that section's anchor prefix
 * baked into it.
 *
 * A private instance rather than the module-level `marked`: `marked.use` and
 * `marked.parse` share one global, so a renderer registered for the handbook
 * would follow every news post rendered afterwards in the same process. This
 * one is built, used and dropped.
 *
 * Only the heading is overridden, and only to add the `id`. Everything else —
 * tables, code, raw HTML — is marked's own output, which is what keeps a
 * section looking like a news post.
 */
function markedFor(prefix: string): Marked {
  return new Marked({
    gfm: true,
    renderer: {
      heading(token) {
        const suffix = slugify(token.text);
        const id = suffix === "" ? prefix : `${prefix}-${suffix}`;
        const depth = Math.min(6, Math.max(1, token.depth));
        const inner = this.parser.parseInline(token.tokens);
        return `<h${depth} id="${id}">${inner}</h${depth}>\n`;
      },
    },
  });
}

/**
 * One section's body as HTML.
 *
 * `async: false` is honest rather than defensive: no async extension is
 * registered on this instance, so `parse` returns a string, and the cast says
 * so instead of papering over it.
 */
export function renderSection(section: HandbookSection): string {
  return markedFor(section.slug).parse(section.body, {
    async: false,
  }) as string;
}

/**
 * The whole book, in order, with the contents list the page prints above it.
 *
 * A duplicate order or a duplicate slug throws rather than being resolved:
 * two sections numbered `04` have no reading order anybody meant, and two
 * sections with one slug would give the contents list two links to the same
 * anchor. Both are typos in a filename, and the only useful thing to do with
 * a typo in a filename is to name it.
 */
export function assembleHandbook(
  sections: readonly HandbookSection[],
): Handbook {
  const orders = new Set<number>();
  const slugs = new Set<string>();
  for (const section of sections) {
    if (orders.has(section.order)) {
      throw new Error(`content/staff: duplicate order ${section.order}`);
    }
    if (slugs.has(section.slug)) {
      throw new Error(`content/staff: duplicate slug "${section.slug}"`);
    }
    orders.add(section.order);
    slugs.add(section.slug);
  }

  const ordered = [...sections].sort((a, b) => a.order - b.order);

  return {
    contents: ordered.map(({ slug, title }) => ({ slug, title })),
    sections: ordered.map((section) => ({
      slug: section.slug,
      title: section.title,
      html: renderSection(section),
    })),
  };
}
