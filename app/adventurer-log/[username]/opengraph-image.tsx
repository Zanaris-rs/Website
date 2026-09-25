import { ImageResponse } from "next/og";

import { logLook } from "@/lib/adventurer-log/page-data";
import { logStatement, parseLog } from "@/lib/adventurer-log/queries";
import { INVALID_NAME, toSafeName } from "@/lib/base37";
import type { HeadTables } from "@/lib/chathead/head";
import heads from "@/lib/chathead/heads.json";
import { chatheadPng } from "@/lib/chathead/server";
import { isConfigured, query } from "@/lib/db";
import { displayName, formatNumber } from "@/lib/hiscores/format";
import { DEFAULT_PROFILE } from "@/lib/hiscores/params";
import { playerQuery, type PlayerRow } from "@/lib/hiscores/queries";

/**
 * A log's link preview: the card a chat app or a social site shows when
 * someone pastes `/adventurer-log/<name>`. Next puts its URL in the page's
 * `og:image` and `twitter:image` itself; `generateMetadata` in `page.tsx`
 * says the card is a large one.
 *
 * The card is the log's header, drawn: the chathead at three times its size
 * (each game pixel a solid block, drawn on the server by the page's own
 * renderer — `lib/chathead/server.ts`), the name, the headline, the total
 * level and the site. The look is the page's (`logLook`), so a preview never
 * shows more of the player than the log does.
 *
 * A log that cannot be shown — no such log, a banned owner, no database —
 * gets the site's plain card, which says nothing about the name asked for.
 *
 * Node, not edge: the renderer and its models are files read from disk, and
 * the database is the site's `pg` pool.
 */

export const runtime = "nodejs";
// Drawn per request from the database; the Cache-Control below is what keeps
// that cheap. Without this Next may cache the first drawing indefinitely.
export const dynamic = "force-dynamic";

export const alt = "An Adventurer Log on Zanaris";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Ten minutes in a reader's cache, an hour at the edge, a day stale behind that. */
const CACHE = "public, max-age=600, s-maxage=3600, stale-while-revalidate=86400";
/** A failure is not cached anywhere, so the next request tries again. */
const NO_CACHE = "no-store";

const SCALE = 3;

const STONE = "#1c1c1c";
const BORDER = "6px solid #5a5a5a";
const GOLD = "#ffb000";
const TEXT = "#e0e0e0";
const GREEN = "#90c040";

/** The site's dark stone: a solid panel in a grey border. */
const frame = {
  display: "flex",
  width: "100%",
  height: "100%",
  background: STONE,
  border: BORDER,
} as const;

/** The chathead's size on the card: its frame, each pixel a SCALE block. */
const HEAD = {
  width: (heads as HeadTables).frame.width * SCALE,
  height: (heads as HeadTables).frame.height * SCALE,
};

type Params = {
  params: Promise<{ username: string }>;
};

type Card = {
  name: string;
  headline: string;
  totalLevel: number | null;
  /** The chathead as a data URL, or null to leave it out. */
  head: string | null;
};

function nameFrom(raw: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return null;
  }
  const safe = toSafeName(decoded);
  return safe === INVALID_NAME ? null : safe;
}

/** What the card shows for a log, or null for the plain card. */
async function cardFor(username: string): Promise<Card | null> {
  const statement = logStatement(username, null);
  const header = parseLog(
    await query<Record<string, unknown>>(statement.text, statement.values),
  );
  if (header.result !== "ok") return null;

  const look = await logLook(header);

  const hiscores = playerQuery({ profile: DEFAULT_PROFILE, username });
  const rows = await query<PlayerRow>(hiscores.text, hiscores.values);
  const overall = rows.find((row) => row.category === 0);

  // A chathead that fails to draw leaves the card without one, not without
  // a card: the name and the rest still make a preview.
  let head: string | null = null;
  if (look) {
    try {
      const png = await chatheadPng(look, SCALE);
      if (png) head = `data:image/png;base64,${png.toString("base64")}`;
    } catch (error) {
      console.error("[adventurer-log] preview chathead failed", error);
    }
  }

  return {
    name: displayName(header.username),
    headline: header.headline,
    totalLevel: overall ? overall.level : null,
    head,
  };
}

export default async function Image({ params }: Params) {
  const username = nameFrom((await params).username);
  if (!username || !isConfigured()) return plainCard(CACHE);

  let card: Card | null;
  try {
    card = await cardFor(username);
  } catch (error) {
    console.error("[adventurer-log] preview read failed", error);
    return plainCard(NO_CACHE);
  }
  if (!card) return plainCard(CACHE);

  return new ImageResponse(
    (
      <div style={{ ...frame, alignItems: "center" }}>
        {card.head ? (
          <img
            src={card.head}
            alt=""
            width={HEAD.width}
            height={HEAD.height}
            style={{ marginLeft: 24 }}
          />
        ) : null}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            height: "100%",
            padding: card.head ? "48px 56px 40px 32px" : "48px 72px 40px",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              flex: 1,
              justifyContent: "center",
            }}
          >
            <div style={{ fontSize: 72, color: GOLD }}>{card.name}</div>
            {card.headline ? (
              <div style={{ fontSize: 36, color: TEXT, marginTop: 20 }}>
                {`“${card.headline}”`}
              </div>
            ) : null}
            {card.totalLevel !== null ? (
              <div style={{ fontSize: 36, color: TEXT, marginTop: 28 }}>
                {`Total level ${formatNumber(card.totalLevel)}`}
              </div>
            ) : null}
          </div>
          <div style={{ fontSize: 28, color: GREEN }}>Adventurer Log · zanaris.rs</div>
        </div>
      </div>
    ),
    { ...size, headers: { "Cache-Control": CACHE } },
  );
}

/** The site's card, for a log there is nothing to show of. */
function plainCard(cacheControl: string) {
  return new ImageResponse(
    (
      <div style={{ ...frame, alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontSize: 72, color: GOLD }}>Zanaris Adventurer Logs</div>
      </div>
    ),
    { ...size, headers: { "Cache-Control": cacheControl } },
  );
}
