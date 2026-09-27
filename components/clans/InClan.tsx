"use client";

import { type FormEvent, useState } from "react";

import ChatheadFace from "@/components/game/ChatheadFace";
import ChatText from "@/components/game/ChatText";
import Panel from "@/components/site/Panel";
import { send } from "@/lib/adventurer-log/client";
import { formatMonth, formatWhen } from "@/lib/adventurer-log/format";
import { logHref } from "@/lib/adventurer-log/href";
import { INVALID_NAME, toDisplayName, toSafeName } from "@/lib/base37";
import type { Look } from "@/lib/chathead/look";
import { type ClanAction, type ClanField, clanFieldOf, clanMessages } from "@/lib/clans/client";
import { clanHref } from "@/lib/clans/href";
import { CLAN_LIMITS } from "@/lib/clans/names";
import type { ClanNotice, ClanPage, SentInvite } from "@/lib/clans/queries";
import {
  may,
  outranks,
  PERM_ACTIONS,
  PERM_KEYS,
  PERM_LABELS,
  type Perms,
  RANK_NAMES,
  type Rank,
  ranksBelow,
  youAre,
} from "@/lib/clans/ranks";
import { listedWorld } from "@/lib/clans/worlds";

import ClanFields, { type ClanFieldsValue } from "./ClanFields";
import styles from "./Clans.module.css";
import Crest from "./Crest";
import RankIcon from "./RankIcon";

export type TabMember = { username: string; rank: Rank; joinedAt: string; look: Look | null };

type Box = "members" | "invites" | "notices" | "page" | "perms" | "leadership" | "leave";

/**
 * The Clan tab for a member. The header comes first, then a box for each
 * thing their rank allows (`may`, `outranks`: the database checks the same
 * and refuses the rest). Everyone sees the roster, the pending invitations
 * and the notices. The Leader also sees "Who can…" and Leadership. Every
 * write reads the page again when it succeeds; a refusal stays in its box's
 * status line.
 *
 * While a request is out, every button and rank select is `aria-disabled`
 * and ignores presses (it keeps its focus); a confirm is asked only when
 * nothing is out. `disabled` is only for what cannot be done at all (Send
 * with no name, Post with no title or text).
 */
export default function InClan({
  me,
  myRank,
  clan,
  crestName,
  members,
  notices,
  sent,
}: {
  me: string;
  myRank: Rank;
  clan: ClanPage;
  crestName: string;
  members: TabMember[];
  notices: ClanNotice[];
  sent: SentInvite[];
}) {
  const others = members.filter((member) => member.username !== me);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ box: Box; text: string; field: ClanField | null } | null>(null);
  const [target, setTarget] = useState("");
  const [notice, setNotice] = useState({ title: "", body: "" });
  // A world the site no longer lists reads as None: the route takes only listed worlds.
  const [page, setPage] = useState<ClanFieldsValue>({
    name: clan.name,
    motto: clan.motto,
    crest: clan.crest,
    world: listedWorld(clan.world),
    about: clan.about,
  });
  const [perms, setPerms] = useState<Perms>(clan.perms);
  const [heir, setHeir] = useState(others[0]?.username ?? "");

  const leader = myRank === "leader";
  const mayInvite = may("invite", myRank, clan.perms);
  const mayRemove = may("remove", myRank, clan.perms);
  const mayRanks = may("ranks", myRank, clan.perms);
  const mayPage = may("page", myRank, clan.perms);
  const unlistedWorld = clan.world !== null && listedWorld(clan.world) === null ? clan.world : null;

  /**
   * One write. Nothing happens while another is out; `question`, when
   * given, is asked first and a "no" sends nothing.
   */
  async function act(
    box: Box,
    action: ClanAction,
    url: string,
    body: unknown,
    method: "POST" | "DELETE" = "POST",
    question?: string,
  ) {
    if (busy) return;
    if (question !== undefined && !window.confirm(question)) return;
    setBusy(true);
    setStatus(null);
    const result = await send(url, body, method, clanMessages(action));
    if (result.ok) {
      window.location.reload();
      return;
    }
    setBusy(false);
    setStatus({ box, text: result.message, field: clanFieldOf(result.code) });
  }

  const said = (box: Box) => (
    <p role="status" className={styles.error}>
      {status?.box === box ? status.text : ""}
    </p>
  );

  function invite(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const username = toSafeName(target);
    if (username === INVALID_NAME) {
      setStatus({ box: "invites", text: clanMessages("invite").no_such_player, field: null });
      return;
    }
    void act("invites", "invite", "/api/clans/invites", { target: username });
  }

  return (
    <>
      <Panel align="left" width="100%" className={styles.tab}>
        <div className={styles.clanHead}>
          <Crest id={clan.crest} size="m" label={`Crest: ${crestName}`} />
          <div>
            <h2 className={styles.clanHeadName}>{clan.name}</h2>
            {clan.motto ? (
              <p className={styles.motto}>
                <ChatText text={clan.motto} colour={0} effect={0} />
              </p>
            ) : null}
            <p className={styles.muted}>
              <RankIcon rank={myRank} className={styles.rankIcon} /> {youAre(myRank)} &middot;{" "}
              <a href={clanHref(clan.slug)}>The clan page</a>
            </p>
          </div>
        </div>
      </Panel>

      <Panel align="left" width="100%" className={styles.tab}>
        <h2 className={styles.tabTitle}>
          Members ({clan.members} of {CLAN_LIMITS.members})
        </h2>
        <ul className={styles.roster}>
          {members.map((member) => {
            const name = toDisplayName(member.username);
            const canRank = mayRanks && outranks(myRank, member.rank);
            const canRemove = mayRemove && outranks(myRank, member.rank);
            return (
              <li key={member.username} className={styles.rosterRow}>
                <ChatheadFace look={member.look} size={32} label={`${name}'s chathead`} className={styles.face} />
                <a className={styles.rosterName} href={logHref(member.username)}>
                  {name}
                </a>
                <span className={styles.rank}>
                  <RankIcon rank={member.rank} className={styles.rankIcon} />{" "}
                  {canRank ? (
                    <select
                      aria-label={`${name}'s rank`}
                      aria-disabled={busy || undefined}
                      value={member.rank}
                      onChange={(event) =>
                        void act("members", "rank", "/api/clans/members/rank", {
                          target: member.username,
                          rank: event.target.value,
                        })
                      }
                    >
                      {ranksBelow(myRank).map((rank) => (
                        <option key={rank} value={rank}>
                          {RANK_NAMES[rank]}
                        </option>
                      ))}
                    </select>
                  ) : (
                    RANK_NAMES[member.rank]
                  )}
                </span>
                <span className={styles.muted}>joined {formatMonth(member.joinedAt)}</span>
                {canRemove ? (
                  <button
                    type="button"
                    aria-disabled={busy || undefined}
                    onClick={() =>
                      void act(
                        "members",
                        "remove",
                        "/api/clans/members",
                        { target: member.username },
                        "DELETE",
                        `Remove ${name} from ${clan.name}?`,
                      )
                    }
                  >
                    Remove
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
        {said("members")}
      </Panel>

      <Panel align="left" width="100%" className={styles.tab}>
        <h2 className={styles.tabTitle}>{mayInvite ? "Invite someone" : "Invitations"}</h2>
        {mayInvite ? (
          <form className={styles.row} onSubmit={invite}>
            <label htmlFor="clan-invite">Player&rsquo;s name</label>
            <input
              id="clan-invite"
              type="text"
              maxLength={12}
              autoComplete="off"
              value={target}
              onChange={(event) => setTarget(event.target.value)}
            />
            <button type="submit" disabled={target.trim() === ""} aria-disabled={busy || undefined}>
              Send
            </button>
          </form>
        ) : null}
        <h3 className={styles.subtitle}>Waiting for an answer</h3>
        {sent.length === 0 ? (
          <p className={styles.hint}>Nobody.</p>
        ) : (
          <ul className={styles.people}>
            {sent.map((pending) => (
              <li key={pending.username}>
                <a href={logHref(pending.username)}>{toDisplayName(pending.username)}</a>{" "}
                <span className={styles.muted}>
                  invited by {toDisplayName(pending.invitedBy)} &middot; {formatWhen(pending.createdAt)}
                </span>
                {mayInvite ? (
                  <button
                    type="button"
                    aria-disabled={busy || undefined}
                    onClick={() =>
                      void act("invites", "cancel", "/api/clans/invites", { target: pending.username }, "DELETE")
                    }
                  >
                    Cancel
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {said("invites")}
      </Panel>

      <Panel align="left" width="100%" className={styles.tab}>
        <h2 className={styles.tabTitle}>Notices</h2>
        {notices.length === 0 ? (
          <p className={styles.hint}>No notices yet.</p>
        ) : (
          <ul className={styles.notices}>
            {notices.map((item) => (
              <li key={item.id} className={styles.notice}>
                <div className={styles.noticeHead}>
                  <b>{item.title}</b>
                  <span className={styles.muted}>
                    {item.authorRank ? <RankIcon rank={item.authorRank} className={styles.rankIcon} /> : null}{" "}
                    {toDisplayName(item.author)} &middot; {formatWhen(item.createdAt)}
                  </span>
                  {mayPage || item.author === me ? (
                    <button
                      type="button"
                      aria-disabled={busy || undefined}
                      onClick={() =>
                        void act(
                          "notices",
                          "unnotice",
                          `/api/clans/notices/${item.id}`,
                          undefined,
                          "DELETE",
                          `Delete the notice "${item.title}"?`,
                        )
                      }
                    >
                      Delete
                    </button>
                  ) : null}
                </div>
                <p className={styles.noticeBody}>{item.body}</p>
              </li>
            ))}
          </ul>
        )}
        {mayPage ? (
          <form
            className={styles.fields}
            onSubmit={(event) => {
              event.preventDefault();
              void act("notices", "notice", "/api/clans/notices", notice);
            }}
          >
            <h3 className={styles.subtitle}>Post a notice</h3>
            <p className={styles.hint}>
              Your clan can post 10 notices a day, and a deleted notice still counts towards them. The newest 20
              stay on the board.
            </p>
            <label className={styles.field} htmlFor="clan-notice-title">
              <span className={styles.fieldLabel}>Title</span>
              <input
                id="clan-notice-title"
                type="text"
                maxLength={CLAN_LIMITS.noticeTitle}
                value={notice.title}
                onChange={(event) => setNotice({ ...notice, title: event.target.value })}
              />
            </label>
            <label className={styles.field} htmlFor="clan-notice-body">
              <span className={styles.fieldLabel}>Notice</span>
              <textarea
                id="clan-notice-body"
                rows={3}
                maxLength={CLAN_LIMITS.noticeBody}
                value={notice.body}
                onChange={(event) => setNotice({ ...notice, body: event.target.value })}
              />
              <span className={styles.count}>
                {notice.body.length}/{CLAN_LIMITS.noticeBody}
              </span>
            </label>
            <button
              type="submit"
              disabled={notice.title.trim() === "" || notice.body.trim() === ""}
              aria-disabled={busy || undefined}
            >
              Post
            </button>
          </form>
        ) : null}
        {said("notices")}
      </Panel>

      {mayPage ? (
        <Panel align="left" width="100%" className={styles.tab}>
          <h2 className={styles.tabTitle}>Clan page</h2>
          <p className={styles.hint}>
            The clan photo shows members in their worn outfits, standing in the Leader&rsquo;s scene. A new name is a
            new address: the old one stops working.
          </p>
          {unlistedWorld !== null ? (
            <p className={styles.hint}>
              Your clan&rsquo;s world, World {unlistedWorld}, is no longer on the site&rsquo;s list, so the form shows
              None, and Save stores None.
            </p>
          ) : null}
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void act("page", "page", "/api/clans/page", { ...page, world: listedWorld(page.world) });
            }}
          >
            <ClanFields
              idPrefix="clan-page"
              value={page}
              onChange={(next) => {
                setPage(next);
                // A mark is about what was sent; editing clears it, as on the Sheet.
                if (status?.box === "page") setStatus(null);
              }}
              withAbout
              crestName={crestName}
              invalid={status?.box === "page" ? status.field : null}
            />
            <button type="submit" aria-disabled={busy || undefined}>
              Save
            </button>
          </form>
          {said("page")}
        </Panel>
      ) : null}

      {leader ? (
        <Panel align="left" width="100%" className={styles.tab}>
          <h2 className={styles.tabTitle}>Who can&hellip;</h2>
          <form
            className={styles.fields}
            onSubmit={(event) => {
              event.preventDefault();
              void act("perms", "perms", "/api/clans/perms", perms);
            }}
          >
            {PERM_KEYS.map((key) => (
              <label key={key} className={styles.field} htmlFor={`clan-perm-${key}`}>
                <span className={styles.fieldLabel}>{PERM_ACTIONS[key]}</span>
                <select
                  id={`clan-perm-${key}`}
                  value={perms[key]}
                  onChange={(event) => setPerms({ ...perms, [key]: Number(event.target.value) })}
                >
                  {PERM_LABELS.map((label, level) => (
                    <option key={level} value={level}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            ))}
            <button type="submit" aria-disabled={busy || undefined}>
              Save
            </button>
          </form>
          {said("perms")}
        </Panel>
      ) : null}

      {leader ? (
        <Panel align="left" width="100%" className={styles.tab}>
          <h2 className={styles.tabTitle}>Leadership</h2>
          {others.length === 0 ? (
            <p className={styles.hint}>There is nobody to hand the clan to yet.</p>
          ) : (
            <div className={styles.row}>
              <label htmlFor="clan-heir">Hand over to</label>
              <select id="clan-heir" value={heir} onChange={(event) => setHeir(event.target.value)}>
                {others.map((member) => (
                  <option key={member.username} value={member.username}>
                    {toDisplayName(member.username)} ({RANK_NAMES[member.rank]})
                  </option>
                ))}
              </select>
              <button
                type="button"
                aria-disabled={busy || undefined}
                onClick={() =>
                  void act(
                    "leadership",
                    "handOver",
                    "/api/clans/hand-over",
                    { target: heir },
                    "POST",
                    `Hand ${clan.name} to ${toDisplayName(heir)}? They take the key, and you become a General.`,
                  )
                }
              >
                Hand over
              </button>
            </div>
          )}
          <p className={styles.row}>
            <button
              type="button"
              className={styles.danger}
              aria-disabled={busy || undefined}
              onClick={() =>
                void act(
                  "leadership",
                  "disband",
                  "/api/clans/disband",
                  {},
                  "POST",
                  `Disband ${clan.name}? Everyone leaves, its invitations and notices are deleted, and its page is gone. This cannot be undone.`,
                )
              }
            >
              Disband the clan
            </button>
          </p>
          {said("leadership")}
        </Panel>
      ) : null}

      <Panel align="left" width="100%" className={styles.tab}>
        <h2 className={styles.tabTitle}>Leave the clan</h2>
        {leader ? (
          <p className={styles.hint}>You lead {clan.name}: hand over or disband first.</p>
        ) : (
          <button
            type="button"
            aria-disabled={busy || undefined}
            onClick={() => void act("leave", "leave", "/api/clans/leave", {}, "POST", `Leave ${clan.name}?`)}
          >
            Leave {clan.name}
          </button>
        )}
        {said("leave")}
      </Panel>
    </>
  );
}
