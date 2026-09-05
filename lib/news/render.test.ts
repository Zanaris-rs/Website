import { describe, expect, it } from "vitest";

import { renderMarkdown } from "./render";

describe("renderMarkdown", () => {
  it("renders Markdown", () => {
    expect(renderMarkdown("# Update\n\nHello **there**.")).toContain(
      "<h1>Update</h1>",
    );
    expect(renderMarkdown("Hello **there**.")).toContain("<strong>there</strong>");
  });

  it("renders links and lists", () => {
    expect(renderMarkdown("[rules](/rules)")).toContain('<a href="/rules">');
    expect(renderMarkdown("- one\n- two")).toContain("<li>one</li>");
  });

  it("has GitHub-flavoured tables on", () => {
    const html = renderMarkdown("| a | b |\n| --- | --- |\n| 1 | 2 |");
    expect(html).toContain("<table>");
    expect(html).toContain("<td>1</td>");
  });

  it("passes raw HTML straight through, by design", () => {
    // Posts are files committed to this repo and reviewed like any other
    // change, so raw HTML in one is a feature rather than a hole. This test
    // exists so that decision cannot be reversed by accident: if news ever
    // becomes user-submitted, this is the assertion that has to be rewritten
    // first.
    const html = renderMarkdown('<span class="red">Server down</span>');
    expect(html).toContain('<span class="red">Server down</span>');
  });

  it("is synchronous", () => {
    expect(typeof renderMarkdown("hello")).toBe("string");
  });
});
