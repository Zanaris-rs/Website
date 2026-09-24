import type { ReactNode } from "react";

import ChatheadFace from "@/components/game/ChatheadFace";
import ItemIcon from "@/components/game/ItemIcon";
import SkillIcon from "@/components/game/SkillIcon";
import { formatWhen } from "@/lib/adventurer-log/format";
import type { EntryView, ReplyView } from "@/lib/adventurer-log/view";
import type { Look } from "@/lib/chathead/look";

import Body from "./Body";

/**
 * One line of a log's timeline: an adventure the game recorded, or an update
 * the owner posted with its replies. Every element carries a stable `al-`
 * class - those names are the log's styling contract (the owner's CSS
 * targets them), so they are plain class names, never CSS-module hashes.
 *
 * `updateActions` and `replyActions` let the interactive timeline add its
 * buttons without this file knowing about requests.
 */
export default function Entry({
  entry,
  ownerName,
  ownerLook,
  looks,
  updateActions,
  replyActions,
  replyForm,
}: {
  entry: EntryView;
  ownerName: string;
  ownerLook: Look | null;
  looks: Readonly<Record<string, Look>>;
  updateActions?: (entry: EntryView & { kind: "update" }) => ReactNode;
  replyActions?: (reply: ReplyView, updateId: number) => ReactNode;
  replyForm?: (entry: EntryView & { kind: "update" }) => ReactNode;
}) {
  if (entry.kind === "event") {
    return (
      <li className={`al-event al-event--${entry.slug}`}>
        <span className="al-event-icon" aria-hidden>
          {entry.icon?.type === "skill" ? (
            <SkillIcon stat={entry.icon.stat} size={25} />
          ) : entry.icon?.type === "item" ? (
            <ItemIcon id={entry.icon.id} size={25} />
          ) : null}
        </span>
        <span className="al-event-text">{entry.text}</span>
        <time className="al-time" dateTime={entry.at}>
          {formatWhen(entry.at)}
        </time>
      </li>
    );
  }

  return (
    <li className="al-update" id={`update-${entry.id}`}>
      <div className="al-update-head">
        <ChatheadFace look={ownerLook} size={48} label={`${ownerName}'s chathead`} className="al-avatar" />
        <div className="al-update-main">
          <div className="al-update-meta">
            <b className="al-name">{ownerName}</b>{" "}
            <time className="al-time" dateTime={entry.at}>
              {formatWhen(entry.at)}
            </time>
          </div>
          <p className="al-update-body">
            <Body tokens={entry.tokens} />
          </p>
          {updateActions ? <div className="al-actions">{updateActions(entry)}</div> : null}
        </div>
      </div>

      {entry.replies.length > 0 || replyForm ? (
        <ul className="al-replies">
          {entry.replies.map((reply) => (
            <li className="al-reply" key={reply.id} id={`reply-${reply.id}`}>
              <ChatheadFace
                look={looks[reply.author] ?? null}
                size={32}
                label={`${reply.authorName}'s chathead`}
                className="al-avatar"
              />
              <div className="al-reply-main">
                <div className="al-reply-meta">
                  <a className="al-name" href={`/adventurer-log/${encodeURIComponent(reply.author)}`}>
                    {reply.authorName}
                  </a>{" "}
                  <time className="al-time" dateTime={reply.at}>
                    {formatWhen(reply.at)}
                  </time>
                </div>
                <p className="al-reply-body">
                  <Body tokens={reply.tokens} />
                </p>
                {replyActions ? <div className="al-actions">{replyActions(reply, entry.id)}</div> : null}
              </div>
            </li>
          ))}
          {replyForm ? <li className="al-reply-form">{replyForm(entry)}</li> : null}
        </ul>
      ) : null}
    </li>
  );
}
