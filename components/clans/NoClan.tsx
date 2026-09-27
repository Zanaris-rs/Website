"use client";

import { useState } from "react";

import ChatText from "@/components/game/ChatText";
import Panel from "@/components/site/Panel";
import { send } from "@/lib/adventurer-log/client";
import { formatWhen } from "@/lib/adventurer-log/format";
import { toDisplayName } from "@/lib/base37";
import { type ClanAction, type ClanField, clanFieldOf, clanMessages } from "@/lib/clans/client";
import { CLANS_HREF, clanHref } from "@/lib/clans/href";
import type { ClanInvite } from "@/lib/clans/queries";

import ClanFields, { type ClanFieldsValue } from "./ClanFields";
import styles from "./Clans.module.css";
import Crest from "./Crest";
import RankIcon from "./RankIcon";

type Box = "invites" | "start";

/**
 * The Clan tab for a player in no clan. It shows the invitations they hold,
 * each with the clan's crest, name, size and motto and who asked, to accept
 * or decline. Then it offers "Start a clan". A successful answer or start
 * reads the page again, which then shows the clan.
 *
 * While a request is out every button is `aria-disabled` and ignores
 * presses (it keeps its focus); `disabled` is only for "Start the clan"
 * with no name. A refusal is said in its own box's status line, and marks
 * the field it was about.
 */
export default function NoClan({
  invites,
  defaultCrest,
  defaultCrestName,
}: {
  invites: ClanInvite[];
  /** Where a new clan's crest starts: the curated list's first. */
  defaultCrest: number;
  defaultCrestName: string;
}) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ box: Box; text: string; field: ClanField | null } | null>(null);
  const [fields, setFields] = useState<ClanFieldsValue>({
    name: "",
    motto: "",
    crest: defaultCrest,
    world: null,
    about: "",
  });

  async function act(box: Box, action: ClanAction, url: string, body: unknown) {
    if (busy) return;
    setBusy(true);
    setStatus(null);
    const result = await send(url, body, "POST", clanMessages(action));
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

  return (
    <>
      <Panel align="left" width="100%" className={styles.tab}>
        <h2 className={styles.tabTitle}>Invitations</h2>
        {invites.length === 0 ? (
          <p className={styles.hint}>
            No invitations. Clans are invite-only: a member whose rank may invite can ask you by name.
          </p>
        ) : (
          <ul className={styles.invites}>
            {invites.map((invite) => (
              <li key={invite.clanId} className={styles.invite}>
                <Crest id={invite.crest} size="m" label={`Crest of ${invite.name}`} />
                <div className={styles.inviteMain}>
                  <a className={styles.inviteName} href={clanHref(invite.slug)}>
                    {invite.name}
                  </a>{" "}
                  <span className={styles.muted}>
                    {invite.members} {invite.members === 1 ? "member" : "members"}
                  </span>
                  {invite.motto ? (
                    <p className={styles.motto}>
                      <ChatText text={invite.motto} colour={0} effect={0} />
                    </p>
                  ) : null}
                  <p className={styles.muted}>
                    Invited by{" "}
                    {invite.invitedByRank ? <RankIcon rank={invite.invitedByRank} className={styles.rankIcon} /> : null}{" "}
                    {toDisplayName(invite.invitedBy)} &middot; {formatWhen(invite.createdAt)}
                  </p>
                  <div className={styles.row}>
                    <button
                      type="button"
                      aria-disabled={busy || undefined}
                      onClick={() =>
                        void act("invites", "answer", "/api/clans/invites/answer", { clanId: invite.clanId, accept: true })
                      }
                    >
                      Accept
                    </button>
                    <button
                      type="button"
                      aria-disabled={busy || undefined}
                      onClick={() =>
                        void act("invites", "answer", "/api/clans/invites/answer", { clanId: invite.clanId, accept: false })
                      }
                    >
                      Decline
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
        {said("invites")}
      </Panel>

      <Panel align="left" width="100%" className={styles.tab}>
        <h2 className={styles.tabTitle}>Start a clan</h2>
        <p className={styles.hint}>
          You lead the clan you start, and you can be in one clan at a time. <a href={CLANS_HREF}>All clans</a>
        </p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void act("start", "create", "/api/clans", {
              name: fields.name,
              motto: fields.motto,
              crest: fields.crest,
              world: fields.world,
            });
          }}
        >
          <ClanFields
            idPrefix="clan-start"
            value={fields}
            onChange={(next) => {
              setFields(next);
              // A mark is about what was sent; editing clears it, as on the Sheet.
              if (status?.box === "start") setStatus(null);
            }}
            withAbout={false}
            crestName={defaultCrestName}
            invalid={status?.box === "start" ? status.field : null}
          />
          <button type="submit" disabled={fields.name.trim() === ""} aria-disabled={busy || undefined}>
            Start the clan
          </button>
        </form>
        {said("start")}
      </Panel>
    </>
  );
}
