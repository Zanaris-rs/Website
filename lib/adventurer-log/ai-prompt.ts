import { CATEGORIES } from "@/lib/hiscores/categories";

import { ADVENTURE_CATEGORIES } from "./categories";
import { CSS_MAX } from "./format";
import { cssUrl, type Picture, SITE_ART, SKILL_PICTURES, TEXTURE_PICTURES } from "./pictures";

/**
 * The prompt the settings page's "Copy a prompt for an AI" puts on the
 * clipboard: everything an AI needs to write an Adventurer Log's stylesheet
 * that the sanitiser (`css.ts`) keeps whole, with a line for the owner to say
 * what look they want and their current stylesheet to start from.
 *
 * The AI never sees the page, so the prompt carries it: the log's markup cut
 * down, its look before any owner's CSS (`Log.module.css`), the rules the
 * sanitiser enforces, and the only picture addresses it lets through.
 * `ai-prompt.test.ts` keeps it honest - every `al-` class the log draws is in
 * the outline and nothing else is, every picture passes the sanitiser, and so
 * do the examples the rules give.
 *
 * Pure and client-side, so it imports nothing that pulls in the sanitiser's
 * parser: the rules are written out here, not read from `css.ts`.
 */

/** Where the owner says what they want; the test checks it is in the prompt. */
export const LOOK_PLACEHOLDER =
  "[Describe it here: colours, a mood, a theme - \"the Wilderness at night\", \"party hats\", \"a 2004 fan site\".]";

/** Fonts an owner can count on a reader having, since the log loads none. */
const SAFE_FONTS = 'Arial, Verdana, Tahoma, "Trebuchet MS", Georgia, "Times New Roman", "Courier New", Impact';

/** Symbols `content` keeps (no letters or digits), for the rule's example. */
export const CONTENT_SYMBOLS = "★ ♦ ⚔ • ~ »";

const FENCE = "```";

/**
 * The log's markup, cut down: what `LogView`, `Wardrobe`, `Timeline`, `Entry`
 * and `Body` draw, with one of each repeated thing.
 */
const OUTLINE = `<div class="al-root">                 <!-- the log; your CSS reaches nothing outside it -->
  <div class="al-page">                <!-- html, body and :root in your CSS mean this -->
    <aside class="al-side">
      <section class="al-header al-box">
        <h1 class="al-title">Zezima</h1>
        <div class="al-chathead"><canvas></canvas></div>
        <p class="al-headline">"Headline"</p>
        <p class="al-joined">Adventuring since Sep 2026</p>
        <p class="al-links"><a>Hiscores</a></p>
      </section>
      <section class="al-stats al-box">
        <h2>Skills</h2>
        <div class="al-box-body">
          <p class="al-skill-total"><a>Total level 513 &middot; 1,234,567 xp &middot; #45</a></p>
          <p class="al-combat">Combat 45</p>                          <!-- or "Combat 23-27" when it cannot be exact -->
          <table>
            <tr class="al-skill al-skill--1"><td><img></td><td><a>Attack</a><span class="al-skill-xp">224,466 xp &middot; #12</span></td><td class="al-skill-level">99</td></tr>
            <tr class="al-skill al-skill--2 al-skill--unranked"><td><img></td><td><a>Defence</a><span class="al-skill-xp">under 15</span></td><td class="al-skill-level">&lt;15</td></tr> ...
          </table>
          <p class="al-skills-note">A note shown once a skill is under 15</p>
          <!-- or, before any skill is on the hiscores: <p class="al-empty">Not on the hiscores yet.</p> -->
        </div>
      </section>
    </aside>
    <div class="al-main">
      <section class="al-about al-box">
        <h2>About Zezima</h2>
        <div class="al-box-body"><p>About text</p></div>
      </section>
      <section class="al-wardrobe al-box">
        <h2>Zezima's Wardrobe</h2>
        <div class="al-box-body">
          <ul class="al-outfits">
            <li class="al-outfit al-outfit--default"><canvas></canvas><span class="al-outfit-name">★ Outfit name</span></li> ...
          </ul>
        </div>
      </section>
      <section class="al-timeline al-box">
        <h2>Zezima's Adventurer Log</h2>
        <div class="al-box-body">
          <div class="al-post">                                 <!-- the owner's "post an update" box -->
            <form class="al-composer">
              <textarea></textarea>
              <div class="al-actions"><button>Post update</button> <button>Add an item or skill</button> <span class="al-time">0/2000</span></div>
              <div class="al-picker"><input type="search"><div class="al-picker-results"><button><img> Coins</button> ...</div></div>
            </form>
          </div>
          <p class="al-notice">A message after posting</p>
          <p class="al-empty">Nothing to show yet.</p>        <!-- instead of the list, when it is empty -->
          <ul class="al-entries">
            <li class="al-event al-event--level">
              <span class="al-event-icon"><img></span>
              <span class="al-event-text">Levelled up Attack from 98 to 99</span>
              <time class="al-time">24 Sep 2026, 14:05</time>
            </li>
            <li class="al-update">
              <div class="al-update-head">
                <span class="al-avatar"><canvas></canvas></span>
                <div class="al-update-main">
                  <div class="al-update-meta"><b class="al-name">Zezima</b> <time class="al-time">24 Sep 2026, 14:05</time></div>
                  <p class="al-update-body"><span class="al-text"><span>Text</span><span class="al-asset"><img></span></span></p>
                  <div class="al-actions"><button>Reply</button> <span class="al-report"><button>Report</button></span></div>
                </div>
              </div>
              <ul class="al-replies">
                <li class="al-reply">
                  <span class="al-avatar"><canvas></canvas></span>
                  <div class="al-reply-main">
                    <div class="al-reply-meta"><a class="al-name">B0aty</a> <time class="al-time">24 Sep 2026, 14:10</time></div>
                    <p class="al-reply-body"><span class="al-text"><span>Text</span></span></p>
                    <div class="al-actions">...</div>
                  </div>
                </li>
                <li class="al-reply-form"><form class="al-composer">...</form></li>
              </ul>
            </li> ...
          </ul>
          <p class="al-more"><button>Older adventures</button></p>
        </div>
      </section>
    </div>
  </div>
</div>`;

function pictureLines(pictures: readonly Picture[]): string {
  return pictures.map((picture) => `- ${cssUrl(picture.src)} - ${picture.name}, ${picture.width}x${picture.height}`).join("\n");
}

/** The whole prompt, with `current` - the editor's text - to start from when there is one. */
export function aiPrompt(current: string): string {
  const skills = CATEGORIES.map((category) => `${category.id} ${category.name}`).join(", ");
  const kinds = ADVENTURE_CATEGORIES.map((category) => `\`--${category.slug}\` (${category.label.toLowerCase()})`).join(", ");
  const sheet = current.trim();

  const sections = [
    `Please write the CSS for my Adventurer Log on Zanaris (zanaris.rs), a fan-run server of RuneScape as it was in 2004. The log is my profile page there. I will paste your CSS into the site's stylesheet box, which checks it and removes anything it does not allow, so follow the rules below exactly.`,

    `## The look I want

${LOOK_PLACEHOLDER}`,

    `## What to send back

One stylesheet in a single ${FENCE}css code block, ready to paste, at most ${CSS_MAX} characters. If you want a picture that is not in the lists below, do not guess its address: ask me for it.`,

    `## The page

Your CSS reaches only the log itself. The site's header, menu and footer around it are not yours to change. This is the log's HTML, cut down ("..." is more of the same):

${FENCE}html
${OUTLINE}
${FENCE}

- One column on a phone. From 900px wide there are two: \`.al-side\` is 280px on the left and \`.al-main\` takes the rest (a CSS grid on \`.al-page\`).
- \`.al-skill--<id>\` is one skill's row: ${skills}.
- \`.al-event--<kind>\` is one kind of adventure: ${kinds}.
- \`.al-outfit--default\` is the outfit my chathead wears.
- \`.al-post\`, \`.al-actions\` and \`.al-reply-form\` hold buttons and forms that only signed-in readers see. Style them if you like, but keep them usable.
- Chatheads and outfits are drawn on \`<canvas>\`: you can frame, size and place them, but not recolour them.

Its look before your CSS: a black page; each \`.al-box\` black with a 1px #3a3a3a border; each box title (\`.al-box > h2\`) a #2b2b2b bar with white 13px bold text; text #e4e4e4 in 13px Arial; links #c8ccd2; times #9a9a9a.`,

    `## The rules

The box checks your CSS and removes whatever breaks these. Three things throw away the whole stylesheet instead: a backslash, a "<" (rule 2), or going over ${CSS_MAX} characters.

1. Write selectors like \`.al-box h2\`, never starting with \`.al-root\`: the site puts \`.al-root \` in front of every selector itself. \`html\`, \`body\` and \`:root\` at the start of a selector mean the log's page, \`.al-page\`.
2. No backslash anywhere (no CSS escapes, not even in a comment) and no "<" character anywhere. Either one throws away everything.
3. Pictures only through \`url(...)\` with an address from the lists below, exactly as written there, \`?v=\` and all. Nothing from other sites, and no \`data:\` addresses.
4. No \`@import\`, no \`@font-face\`, no web fonts. Use fonts readers already have: ${SAFE_FONTS}.
5. \`@media\`, \`@supports\` and \`@keyframes\` are fine. Every other at-rule (\`@layer\`, \`@container\`, \`@page\` ...) is removed.
6. No nesting (\`&\`, or a rule inside a rule) and no \`:has()\`.
7. \`!important\` is taken off every declaration, so do not rely on it; use a more specific selector instead.
8. \`content\` may draw symbols such as ${CONTENT_SYMBOLS} but no letters or digits. Write the symbols themselves, never an escape like the one for a star (rule 2).
9. None of these: \`image-set()\`, \`image()\`, \`cross-fade()\`, \`element()\`, \`attr()\`, \`paint()\`, \`expression()\`, \`behavior\`, \`-moz-binding\`. A custom property (\`--name\`) may not hold \`url(\` or any of them either.
10. Animations faster than 0.2s are slowed to 0.2s, and readers who ask for reduced motion see none. Keep motion gentle.
11. Anything drawn outside the log is cut off, \`position: fixed\` included.

Keep the text readable against whatever is behind it, and keep names, times and buttons easy to see.`,

    `## Pictures you can use

The 2004 website's own art (width x height in pixels):
${pictureLines(SITE_ART)}

The game's textures, made for tiling:
${pictureLines(TEXTURE_PICTURES)}

The skill icons:
${pictureLines(SKILL_PICTURES)}

Item icons (coins, party hats, weapons ...) can be used too, but only by their exact address. If you want one, ask me and I will look it up.`,
  ];

  if (sheet !== "") {
    sections.push(`## My stylesheet now

Change this rather than starting over, unless I have asked for something new:

${FENCE}css
${sheet}
${FENCE}`);
  }

  return `${sections.join("\n\n")}\n`;
}
