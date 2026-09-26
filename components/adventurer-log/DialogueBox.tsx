"use client";

import Chathead from "@/components/game/Chathead";
import type { DialoguePage } from "@/lib/adventurer-log/persona";
import type { Look } from "@/lib/chathead/look";

import { usePersonaStage } from "./PersonaStage";

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
  const page = pages[Math.min(stage.page, pages.length - 1)];
  return (
    <section className="al-dialogue al-box" aria-label={`${name} says`}>
      <div className="al-dialogue-head al-chathead">
        <Chathead look={look} label={`${name}'s chathead`} mood={page.mood} lines={page.lines.length} />
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
