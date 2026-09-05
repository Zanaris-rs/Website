import "server-only";

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { cache } from "react";

import { parsePost, sortNewestFirst, type NewsPost } from "./parse";

/**
 * Reading the posts off disk. Everything else about news is pure and lives in
 * `parse.ts`; this is the half that touches the filesystem.
 *
 * It runs at **build time only**: every news route is a static path with
 * `dynamicParams = false`, so `content/news` is read while `next build` is
 * prerendering and never on a request. That is why `readdirSync` is fine, and
 * why a malformed post fails the build rather than a page view.
 */

const NEWS_DIR = join(process.cwd(), "content", "news");

/**
 * All posts, newest first. `React.cache` keeps one build from reading the same
 * directory once per prerendered page.
 */
export const readAllPosts = cache((): NewsPost[] => {
  const files = readdirSync(NEWS_DIR).filter((name) => name.endsWith(".md"));
  const posts = files.map((file) =>
    parsePost(file, readFileSync(join(NEWS_DIR, file), "utf8")),
  );

  const seen = new Set<string>();
  for (const post of posts) {
    if (seen.has(post.slug)) {
      throw new Error(`content/news: duplicate slug "${post.slug}"`);
    }
    seen.add(post.slug);
  }

  return sortNewestFirst(posts);
});

/** The `n` most recent posts, for the title screen. */
export function latest(n: number): NewsPost[] {
  return readAllPosts().slice(0, n);
}

/** Every post in one category, newest first. */
export function byCategory(slug: string): NewsPost[] {
  return readAllPosts().filter((post) => post.category.slug === slug);
}

/** One post, or `null` if there is no such file. */
export function bySlug(slug: string): NewsPost | null {
  return readAllPosts().find((post) => post.slug === slug) ?? null;
}
