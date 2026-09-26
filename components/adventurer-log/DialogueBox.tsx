"use client";

import Chathead from "@/components/game/Chathead";
import { tables } from "@/lib/chathead/load";
import type { DialoguePage } from "@/lib/adventurer-log/persona";
import type { Look } from "@/lib/chathead/look";

import { usePersonaStage } from "./PersonaStage";

/**
 * The chatbox's own head is a fixed 96 frame-pixels wide - `Chathead`'s
 * `scale` prop draws it at that size directly, as `ChatheadFace` scales a
 * chathead to its own target width, rather than asking CSS to resize a
 * canvas after the fact (which `sanitizeCss` would refuse to let an owner's
 * stylesheet do anyway: it strips every `!important`).
 */
const HEAD_SCALE = 96 / tables.frame.width;

/**
 * The adventurer talking, as an NPC talks in 2004: their chathead in the
 * page's mood, their name in dark red, the page's lines in black, and "Click
 * here to continue" in blue - which moves the conversation on, back to the
 * first page after the last, and has the figure act out the next page.
 */
export default function DialogueBox({
  name,
  look,
  pages,
}: {
  name: string;
  look: Look | null;
  pages: readonly DialoguePage[];
}) {
  const stage = usePersonaStage();
  if (pages.length === 0) return null;
  // `stage.page` is already clamped to `pages` by `PersonaStage`; reading it
  // straight keeps this in agreement with the emote it is driving, even if
  // `pages` shrinks under an unchanged stage (W5's live editor preview).
  const page = pages[stage.page];
  return (
    <section className="al-dialogue al-box" aria-label={`${name} says`}>
      <div className="al-dialogue-head al-chathead">
        <Chathead look={look} label={`${name}'s chathead`} mood={page.mood} lines={page.lines.length} scale={HEAD_SCALE} />
      </div>
      <div className="al-dialogue-body">
        <p className="al-dialogue-name">{name}</p>
        <div className="al-dialogue-text" aria-live="polite">
          {page.lines.map((line, i) => (
            <p key={i}>{line}</p>
          ))}
        </div>
        {pages.length > 1 ? (
          <button type="button" className="al-continue" onClick={stage.next}>
            Click here to continue
          </button>
        ) : null}
        <p className="al-dialogue-page">{pages.length > 1 ? `${stage.page + 1} / ${pages.length}` : ""}</p>
      </div>
    </section>
  );
}
