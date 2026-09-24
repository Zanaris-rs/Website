import * as csstree from "css-tree";

/**
 * An owner's stylesheet, made safe to put on their log.
 *
 * The database keeps what the owner wrote; this runs every time a log is
 * drawn, so tightening a rule here applies to every log at once. It parses
 * the CSS, walks every node, drops what is not allowed, and prints the tree
 * back out - the output is always CSS this file generated, never the input.
 *
 * What it guarantees:
 *
 * - **Only the log.** Every selector is prefixed with `.al-root `, so a rule
 *   can only match inside the log; `html`, `body` and `:root` at the start of
 *   a selector mean the log's page (`.al-page`). The site's own rules put
 *   `contain: paint` on `.al-root` with `!important` (`Log.module.css`), so
 *   nothing inside - `position: fixed` included - can be drawn over the site's
 *   header, footer or the report button, and `!important` is taken off every
 *   owner declaration, so none of that can be undone.
 * - **Nothing leaves the site.** `url()` only for the site's own `/img/`
 *   pictures; no `@import`, no `@font-face`, no `image-set()`, `image()`,
 *   `cross-fade()`, `element()`, `expression()`, `attr()`. Custom properties
 *   are checked as text for the same, since their values are not parsed. The
 *   log page's Content-Security-Policy backs this up.
 * - **Nobody else's words.** `content` may draw symbols, not letters or
 *   digits, so a stylesheet cannot put a sentence into someone's reply.
 * - **No backslashes anywhere**: CSS escapes are how every string check above
 *   would otherwise be slipped past, and no legitimate log needs one.
 * - **Calm.** Animations shorter than 0.2s are slowed to 0.2s, and a reader
 *   who asks for reduced motion gets none.
 * - **Small.** At most CSS_MAX characters in, and RULES_MAX rules out.
 *
 * `@media`, `@supports` and `@keyframes` are kept; keyframe names are
 * prefixed so they cannot replace the site's own.
 */

export const SANITIZER_VERSION = 1;
export const RULES_MAX = 500;

const ALLOWED_AT_RULES = new Set(["media", "supports", "keyframes", "-webkit-keyframes"]);

const BANNED_FUNCTIONS = new Set([
  "image-set",
  "-webkit-image-set",
  "image",
  "cross-fade",
  "-webkit-cross-fade",
  "element",
  "-moz-element",
  "expression",
  "attr",
  "paint",
]);

const BANNED_PROPERTIES = new Set(["behavior", "-moz-binding", "-ms-behavior"]);

/** The site's own pictures, and nothing that walks out of them. */
const SAFE_URL = /^\/img\/[A-Za-z0-9_\-/.]+\.(png|gif|jpe?g)$/;

/** In a custom property's raw text: anything that loads or reads. */
const RAW_BANNED = /url\s*\(|image-set|image\s*\(|cross-fade|element\s*\(|expression|attr\s*\(|@import|paint\s*\(/i;

const MIN_ANIMATION_SECONDS = 0.2;

export type SanitizedCss = {
  css: string;
  /** What was taken out, in words the owner can act on (deduplicated). */
  dropped: string[];
};

function keyframeName(owner: string, name: string): string {
  return `al-${owner}-${name}`;
}

function checkSelector(selector: csstree.Selector, dropped: Set<string>): boolean {
  let ok = true;
  csstree.walk(selector, (node) => {
    if (node.type === "PseudoClassSelector" && node.name.toLowerCase() === "has") {
      dropped.add("the :has() selector");
      ok = false;
    }
    if (node.type === "NestingSelector") {
      dropped.add("nested (&) selectors");
      ok = false;
    }
  });
  return ok;
}

/** `html body .x` -> `.al-root .al-page .x`; anything else -> `.al-root <it>`. */
function scopeSelector(selector: csstree.Selector): void {
  const children = selector.children;
  let pageRoot = false;

  // Leading html / body / :root compounds, each followed by a descendant or
  // child combinator, stand for the page itself.
  for (;;) {
    const first = children.first;
    if (!first) break;
    const isRoot =
      (first.type === "TypeSelector" && ["html", "body"].includes(first.name.toLowerCase())) ||
      (first.type === "PseudoClassSelector" && first.name.toLowerCase() === "root");
    if (!isRoot) break;
    children.shift();
    pageRoot = true;
    const next = children.first;
    if (next?.type === "Combinator") children.shift();
  }

  const prefix: csstree.CssNode[] = [
    { type: "ClassSelector", name: "al-root" },
    { type: "Combinator", name: " " },
  ];
  if (pageRoot) {
    prefix.push({ type: "ClassSelector", name: "al-page" });
    if (!children.isEmpty) prefix.push({ type: "Combinator", name: " " });
  }
  for (const node of prefix.reverse()) children.prependData(node);
}

function checkValue(
  declaration: csstree.Declaration,
  owner: string,
  keyframes: Set<string>,
  dropped: Set<string>,
): boolean {
  const property = declaration.property.toLowerCase();

  if (BANNED_PROPERTIES.has(property)) {
    dropped.add(`the ${property} property`);
    return false;
  }

  if (declaration.value.type === "Raw") {
    if (RAW_BANNED.test(declaration.value.value)) {
      dropped.add(`a custom property that loads or reads something (${property})`);
      return false;
    }
    return true;
  }

  let ok = true;
  csstree.walk(declaration.value, {
    enter(node: csstree.CssNode) {
      if (!ok) return;
      if (node.type === "Url") {
        if (!SAFE_URL.test(node.value) || node.value.includes("..")) {
          dropped.add("url() other than the site's own /img/ pictures");
          ok = false;
        }
      } else if (node.type === "Function" && BANNED_FUNCTIONS.has(node.name.toLowerCase())) {
        dropped.add(`${node.name.toLowerCase()}()`);
        ok = false;
      } else if (node.type === "String" && property === "content" && /[\p{L}\p{N}]/u.test(node.value)) {
        dropped.add("content with letters or numbers in it");
        ok = false;
      } else if (node.type === "Raw" && RAW_BANNED.test(node.value)) {
        dropped.add(`a value that loads or reads something (${property})`);
        ok = false;
      }
    },
  });
  if (!ok) return false;

  if (property === "animation" || property === "animation-name") {
    csstree.walk(declaration.value, (node) => {
      if (node.type === "Identifier" && keyframes.has(node.name)) {
        node.name = keyframeName(owner, node.name);
      }
    });
  }
  if (property === "animation" || property === "animation-duration" || property === "transition" || property === "transition-duration") {
    csstree.walk(declaration.value, (node) => {
      if (node.type !== "Dimension") return;
      const unit = node.unit.toLowerCase();
      const seconds = unit === "ms" ? Number(node.value) / 1000 : unit === "s" ? Number(node.value) : NaN;
      if (Number.isFinite(seconds) && seconds > 0 && seconds < MIN_ANIMATION_SECONDS) {
        node.value = String(MIN_ANIMATION_SECONDS);
        node.unit = "s";
      }
    });
  }

  declaration.important = false;
  return true;
}

function cleanBlock(
  block: csstree.Block,
  owner: string,
  keyframes: Set<string>,
  dropped: Set<string>,
): void {
  block.children.forEach((node, item, list) => {
    if (node.type === "Declaration") {
      if (!checkValue(node, owner, keyframes, dropped)) list.remove(item);
    } else {
      // nested rules and at-rules inside a declaration block
      dropped.add("rules nested inside other rules");
      list.remove(item);
    }
  });
}

function cleanRules(
  list: csstree.List<csstree.CssNode>,
  owner: string,
  keyframes: Set<string>,
  dropped: Set<string>,
  counter: { rules: number },
): void {
  list.forEach((node, item) => {
    if (node.type === "Rule") {
      if (node.prelude.type !== "SelectorList" || counter.rules >= RULES_MAX) {
        if (counter.rules >= RULES_MAX) dropped.add(`rules after the first ${RULES_MAX}`);
        list.remove(item);
        return;
      }
      const selectors = node.prelude.children;
      selectors.forEach((selector, selectorItem) => {
        if (selector.type !== "Selector" || !checkSelector(selector, dropped)) {
          selectors.remove(selectorItem);
        } else {
          scopeSelector(selector);
        }
      });
      if (selectors.isEmpty) {
        list.remove(item);
        return;
      }
      cleanBlock(node.block, owner, keyframes, dropped);
      counter.rules++;
      return;
    }

    if (node.type === "Atrule") {
      const name = node.name.toLowerCase();
      if (!ALLOWED_AT_RULES.has(name) || !node.block) {
        dropped.add(`@${name}`);
        list.remove(item);
        return;
      }
      if (name.endsWith("keyframes")) {
        const prelude = node.prelude ? csstree.generate(node.prelude).trim() : "";
        if (!/^[A-Za-z_][A-Za-z0-9_-]{0,40}$/.test(prelude)) {
          dropped.add("an @keyframes with an unusual name");
          list.remove(item);
          return;
        }
        node.prelude = { type: "Raw", value: keyframeName(owner, prelude) };
        // keyframe selectors (from, 50%) are not scoped; only declarations
        node.block.children.forEach((frame, frameItem, frames) => {
          if (frame.type !== "Rule") {
            frames.remove(frameItem);
            return;
          }
          cleanBlock(frame.block, owner, keyframes, dropped);
        });
        return;
      }
      // @media / @supports: their prelude is a condition, their block rules
      cleanRules(node.block.children, owner, keyframes, dropped, counter);
      if (node.block.children.isEmpty) list.remove(item);
      return;
    }

    list.remove(item);
  });
}

/**
 * The owner's stylesheet, safe to draw on their log. `owner` is their
 * username, which names their keyframes apart from anyone else's.
 */
export function sanitizeCss(raw: string, owner: string, max: number = 20000): SanitizedCss {
  const dropped = new Set<string>();
  if (raw.trim() === "") return { css: "", dropped: [] };

  if (raw.length > max) {
    return { css: "", dropped: [`everything: the stylesheet is over ${max} characters`] };
  }
  if (raw.includes("\\")) {
    return { css: "", dropped: ["everything: backslashes (CSS escapes) are not allowed"] };
  }
  if (raw.includes("<")) {
    // Nothing in CSS needs one, and it is the one character that could end
    // the <style> element this is drawn in.
    return { css: "", dropped: ["everything: the < character is not allowed"] };
  }

  let parseErrors = 0;
  const ast = csstree.parse(raw, {
    context: "stylesheet",
    onParseError: () => {
      parseErrors++;
    },
  }) as csstree.StyleSheet;
  if (parseErrors > 0) dropped.add("parts the parser could not read");

  // Keyframe names first, so animation references anywhere can be renamed.
  const keyframes = new Set<string>();
  csstree.walk(ast, (node) => {
    if (node.type === "Atrule" && node.name.toLowerCase().endsWith("keyframes") && node.prelude) {
      keyframes.add(csstree.generate(node.prelude).trim());
    }
  });

  cleanRules(ast.children, owner, keyframes, dropped, { rules: 0 });

  let css = csstree.generate(ast);
  if (css !== "") {
    // The site's, not the owner's: a reader who asked for less motion gets none.
    css += "@media (prefers-reduced-motion:reduce){.al-root *{animation:none!important;transition:none!important}}";
  }
  // Belt and braces for the <style> element: generate() never prints "<"
  // from a stylesheet that had none, but the output is what is drawn.
  css = css.replace(/</g, "\\3c ");

  return { css, dropped: [...dropped] };
}
