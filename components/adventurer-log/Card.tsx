import Chathead from "@/components/game/Chathead";
import ChatText from "@/components/game/ChatText";
import { cardMode, sheetRows } from "@/lib/adventurer-log/card";
import { formatMonth } from "@/lib/adventurer-log/format";
import type { Persona } from "@/lib/adventurer-log/persona";
import type { Look } from "@/lib/chathead/look";

import CardFigure from "./CardFigure";

/**
 * The top of the left column: who this adventurer is. It keeps the classes
 * today's header had (al-header, al-title, al-chathead, al-headline,
 * al-joined, al-links), so skins written for it still land.
 */
export default function Card({
  name,
  username,
  joinedAt,
  headline,
  persona,
  outfitLook,
  headLook,
  viewerIsOwner,
}: {
  name: string;
  username: string;
  joinedAt: string;
  headline: string;
  persona: Persona;
  /** The default outfit: the only look ever drawn whole. */
  outfitLook: Look | null;
  /** The header's look (outfit, else the game's head-only look), for the chathead. */
  headLook: Look | null;
  viewerIsOwner: boolean;
}) {
  const mode = cardMode({ hasOutfit: outfitLook !== null, headline, pages: persona.dialogue });
  const rows = sheetRows(persona);
  return (
    <section className="al-header al-card al-box">
      <h1 className="al-title">{name}</h1>
      {persona.title ? <p className="al-persona-title">{persona.title}</p> : null}

      {mode === "figure" && outfitLook ? (
        <CardFigure name={name} look={outfitLook} headline={headline} colour={persona.colour} effect={persona.effect} />
      ) : mode === "strip" ? (
        headline ? (
          <p className="al-chat-strip">
            <ChatText className="al-overhead al-headline" text={headline} colour={persona.colour} effect={persona.effect} />
          </p>
        ) : null
      ) : (
        <div className="al-chathead">
          <Chathead look={headLook} label={`${name}'s chathead`} />
        </div>
      )}

      {persona.examine ? <p className="al-examine">{persona.examine}</p> : null}

      {rows.length > 0 ? (
        <dl className="al-sheet">
          {rows.map((row) => (
            <div key={row.key} className={`al-sheet-row al-sheet--${row.key}`}>
              <dt>{row.label}</dt>
              <dd>
                {Array.isArray(row.value) ? (
                  <ul className="al-goals">{row.value.map((goal, i) => <li key={i}>{goal}</li>)}</ul>
                ) : (
                  row.value
                )}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}

      <p className="al-joined">Adventuring since {formatMonth(joinedAt)}</p>
      <p className="al-links">
        <a href={`/hiscores/player/${encodeURIComponent(username)}`}>Hiscores</a>
        {viewerIsOwner ? (
          <>
            {" - "}
            {/* Ruling R6: points at the existing settings page until W5 ships
                /account/adventurer-log/character. W5 repoints it. */}
            <a href="/account/adventurer-log">Edit your character</a>
          </>
        ) : null}
      </p>
    </section>
  );
}
