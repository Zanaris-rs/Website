import RankIcon from "@/components/clans/RankIcon";
import Chathead from "@/components/game/Chathead";
import ChatText from "@/components/game/ChatText";
import { cardMode, type SheetRow, sheetRows } from "@/lib/adventurer-log/card";
import { formatMonth } from "@/lib/adventurer-log/format";
import { CHARACTER_HREF, logHref } from "@/lib/adventurer-log/href";
import type { Persona } from "@/lib/adventurer-log/persona";
import type { WardrobeOutfit } from "@/lib/adventurer-log/wardrobe";
import type { Look } from "@/lib/chathead/look";
import { clanHref } from "@/lib/clans/href";
import type { ClanOf } from "@/lib/clans/queries";
import { sceneOf } from "@/lib/scenes/spots";

import CardFigure from "./CardFigure";

/** One row of the character sheet, as `sheetRows` gives it. */
function sheetRow(row: SheetRow) {
  return (
    <div key={row.key} className={`al-sheet-row al-sheet--${row.key}`}>
      <dt>{row.label}</dt>
      <dd>
        {Array.isArray(row.value) ? (
          <ul className="al-goals">
            {row.value.map((goal, i) => (
              <li key={i}>{goal}</li>
            ))}
          </ul>
        ) : (
          row.value
        )}
      </dd>
    </div>
  );
}

/**
 * The top of the left column: who this adventurer is. It keeps the classes
 * today's header had (al-header, al-title, al-chathead, al-headline,
 * al-joined, al-links), so skins written for it still land.
 *
 * A figure stands in the owner's scene when they picked one that has a
 * backdrop (`lib/scenes/spots.ts`); an unknown key draws the plain figure.
 *
 * The sheet's Clan row (`al-sheet--clan`) is the owner's real clan
 * (`clan_of`): their rank's icon and the clan's name, linked to its page.
 */
export default function Card({
  name,
  username,
  joinedAt,
  persona,
  outfitLook,
  headLook,
  viewerIsOwner,
  outfits = [],
  clan,
}: {
  name: string;
  username: string;
  joinedAt: string;
  persona: Persona;
  /** The default outfit: the only look ever drawn whole. */
  outfitLook: Look | null;
  /** The header's look (outfit, else the game's head-only look), for the chathead. */
  headLook: Look | null;
  viewerIsOwner: boolean;
  /** The Wardrobe's outfits: the card names the one a reader tries on. */
  outfits?: readonly WardrobeOutfit[];
  /** The owner's clan and rank, for the sheet's Clan row; null for none. */
  clan: ClanOf | null;
}) {
  const mode = cardMode({ hasOutfit: outfitLook !== null, pages: persona.dialogue });
  const rows = sheetRows(persona);
  const scene = sceneOf(persona.scene);
  // The greeting: page 1's first line, in page 1's colour and effect.
  const first = persona.dialogue[0];
  const greeting = first ? { text: first.lines[0] ?? "", colour: first.colour, effect: first.effect } : null;
  return (
    <section className="al-header al-card al-box">
      <h1 className="al-title">{name}</h1>
      {persona.title ? <p className="al-persona-title">{persona.title}</p> : null}

      {mode === "figure" && outfitLook ? (
        <CardFigure
          name={name}
          look={outfitLook}
          headline={greeting?.text ?? ""}
          colour={greeting?.colour ?? 0}
          effect={greeting?.effect ?? 0}
          scene={scene}
          outfits={outfits}
        />
      ) : mode === "strip" ? (
        greeting?.text ? (
          <p className="al-chat-strip">
            <ChatText className="al-overhead al-headline" text={greeting.text} colour={greeting.colour} effect={greeting.effect} />
          </p>
        ) : null
      ) : (
        <div className="al-chathead">
          <Chathead look={headLook} label={`${name}'s chathead`} />
        </div>
      )}

      {persona.examine ? <p className="al-examine">{persona.examine}</p> : null}

      {rows.length > 0 || clan ? (
        <dl className="al-sheet">
          {rows.filter((row) => row.key !== "goals").map(sheetRow)}
          {clan ? (
            <div className="al-sheet-row al-sheet--clan">
              <dt>Clan</dt>
              <dd>
                <RankIcon rank={clan.rank} className="al-rank" />{" "}
                <a className="al-clan-link" href={clanHref(clan.slug)}>
                  {clan.name}
                </a>
              </dd>
            </div>
          ) : null}
          {rows.filter((row) => row.key === "goals").map(sheetRow)}
        </dl>
      ) : null}

      <p className="al-joined">Adventuring since {formatMonth(joinedAt)}</p>
      <p className="al-links">
        <a href={`${logHref(username)}#skills`}>Hiscores</a>
        {viewerIsOwner ? (
          <>
            {" - "}
            <a href={CHARACTER_HREF}>Edit your character</a>
          </>
        ) : null}
      </p>
    </section>
  );
}
