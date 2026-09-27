"use client";

import { useState } from "react";

import Chathead from "@/components/game/Chathead";
import Figure from "@/components/game/Figure";
import type { Look } from "@/lib/chathead/look";
import { EMOTE_NAMES, EMOTES, MOOD_NAMES, MOODS } from "@/lib/chathead/vocab";

type Named = { name: string; look: Look };

const TILES = { display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" } as const;
const TILE = { margin: 0, textAlign: "center", fontSize: 11 } as const;

/**
 * Every emote on a few figures, each played by its button, and every mood
 * talking over two lines: the check that the clips load, play at the game's
 * pace and stop or loop as they should.
 */
export default function Motion({ figures, head }: { figures: Named[]; head: Named }) {
  const [replays, setReplays] = useState<Record<string, number>>({});
  const play = (...keys: string[]) =>
    setReplays((current) => {
      const next = { ...current };
      for (const key of keys) next[key] = (next[key] ?? 0) + 1;
      return next;
    });

  return (
    <>
      {figures.map(({ name, look }) => (
        <section key={name}>
          <h3>
            {name}{" "}
            <button type="button" onClick={() => play(...EMOTES.map((emote) => `${name}/${emote}`))}>
              Play all
            </button>
          </h3>
          <div style={TILES}>
            {EMOTES.map((emote) => {
              const key = `${name}/${emote}`;
              return (
                <figure key={emote} style={TILE}>
                  <Figure
                    look={look}
                    emote={emote}
                    replay={replays[key] ?? 0}
                    label={`${name}, ${EMOTE_NAMES[emote]}`}
                  />
                  <figcaption>
                    <button type="button" onClick={() => play(key)}>
                      {EMOTE_NAMES[emote]}
                    </button>
                  </figcaption>
                </figure>
              );
            })}
          </div>
        </section>
      ))}
      <section>
        <h3>{head.name}, every mood over two lines</h3>
        <div style={TILES}>
          {MOODS.map((mood) => (
            <figure key={mood} style={{ ...TILE, width: 133 }}>
              <Chathead look={head.look} mood={mood} lines={2} label={`${head.name}, ${MOOD_NAMES[mood]}`} />
              <figcaption>{MOOD_NAMES[mood]}</figcaption>
            </figure>
          ))}
        </div>
      </section>
    </>
  );
}
