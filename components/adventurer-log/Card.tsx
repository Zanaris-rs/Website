import RankIcon from "@/components/clans/RankIcon";
import Chathead from "@/components/game/Chathead";
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
import Overhead from "./Overhead";

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
 *
 * With no outfit, the chathead lives in the dialogue box; when the owner
 * hides that box (`chatheadInCard`), the card draws it under the strip
 * instead, so the card still shows who they are.
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
  chatheadInCard = false,
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
  /** With no outfit, draw the chathead under the strip too: the log passes it when Dialogue is hidden. */
  chatheadInCard?: boolean;
}) {
  const mode = cardMode({ hasOutfit: outfitLook !== null, pages: persona.dialogue });
  const rows = sheetRows(persona);
  const scene = sceneOf(persona.scene);
  const chathead = (
    <div className="al-chathead">
      <Chathead look={headLook} label={`${name}'s chathead`} />
    </div>
  );
  return (
    <section className="al-header al-card al-box">
      <h1 className="al-title">{name}</h1>
      {persona.title ? <p className="al-persona-title">{persona.title}</p> : null}

      {mode === "figure" && outfitLook ? (
        <CardFigure
          name={name}
          look={outfitLook}
          scene={scene}
          outfits={outfits}
        />
      ) : mode === "strip" ? (
        // No outfit to stand over: the page's lines are said in a strip here
        // instead, the same way; no strip while there is nothing to say. With
        // the dialogue box hidden, its chathead comes here, under the strip.
        <>
          <Overhead strip />
          {chatheadInCard ? chathead : null}
        </>
      ) : (
        chathead
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
