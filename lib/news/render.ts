import { marked } from "marked";

/**
 * Markdown to HTML, at build time.
 *
 * **The output is not sanitised, deliberately.** Posts are Markdown files
 * committed to this repository and reviewed in a pull request like any other
 * change; raw HTML in one is a feature (a table, a coloured span, an image at
 * an exact size) and there is no path by which an untrusted person can add a
 * file here. If news ever becomes something a logged-in user can submit, this
 * is the line that has to change first.
 *
 * `marked.parse` is synchronous as long as no async extension is registered,
 * and none is: the `string` cast documents that rather than papering over it.
 */
export function renderMarkdown(markdown: string): string {
  return marked.parse(markdown, { gfm: true, async: false }) as string;
}
