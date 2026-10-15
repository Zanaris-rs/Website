import ChatheadFace from "@/components/game/ChatheadFace";
import frame from "@/components/site/Frame.module.css";
import { formatWhen } from "@/lib/account/profile";
import { toDisplayName } from "@/lib/base37";
import { formatCitizen } from "@/lib/invite/format";
import type { Look } from "@/lib/chathead/look";
import type { GenealogyNode } from "@/lib/invite/genealogy";

import styles from "./Genealogy.module.css";

/**
 * The invite tree: every account, under the account that let it in, with the
 * progenitors - the accounts nobody invited - at the top. Drawn the same on
 * the public page and the staff one; only where a name goes and whether the
 * staff tags show differ.
 *
 * A branch with children is a `<details>`, open to start with, so a large line
 * can be folded away without any script.
 *
 * Given `looks`, each name has its chathead before it: their saved outfit,
 * else their last look in the game, else the new-character face
 * (`ChatheadFace`'s fallback).
 */

type Shared = {
  /** Where a name goes. */
  href: (node: GenealogyNode) => string;
  /** The staff tags: banned, can invite. */
  staff: boolean;
  /** Chatheads by username; leave out for no faces. */
  looks?: ReadonlyMap<string, Look>;
};

function Person({ node, href, staff, looks }: { node: GenealogyNode } & Shared) {
  const title = `Joined ${formatWhen(node.joinedAt)}`;
  const banned = staff && node.banned;
  return (
    <span className={styles.person} title={title}>
      {looks ? (
        <ChatheadFace
          look={looks.get(node.username) ?? null}
          size={20}
          label={`${toDisplayName(node.username)}'s chathead`}
          className={styles.face}
        />
      ) : null}
      <a className={`${frame.link} ${banned ? styles.banned : ""}`} href={href(node)}>
        {toDisplayName(node.username)}
      </a>{" "}
      <span className={styles.citizen}>{formatCitizen(node.citizenNumber)}</span>
      {banned ? <span className={styles.bannedTag}> banned</span> : null}
      {staff && node.invitesEnabled ? <span className={styles.inviter}> can invite</span> : null}
      {node.descendants > 0 ? (
        <span className={styles.count}>
          {" "}
          · {node.descendants} below
        </span>
      ) : null}
    </span>
  );
}

function Branch({ node, ...shared }: { node: GenealogyNode } & Shared) {
  if (node.children.length === 0) {
    return (
      <li>
        <div className={styles.leaf}>
          <Person node={node} {...shared} />
        </div>
      </li>
    );
  }
  return (
    <li>
      <details open className={styles.branch}>
        <summary>
          <Person node={node} {...shared} />
        </summary>
        <ul>
          {node.children.map((child) => (
            <Branch key={child.citizenNumber} node={child} {...shared} />
          ))}
        </ul>
      </details>
    </li>
  );
}

export default function GenealogyTree({ tree, ...shared }: { tree: readonly GenealogyNode[] } & Shared) {
  return (
    <ul className={styles.tree}>
      {tree.map((node) => (
        <Branch key={node.citizenNumber} node={node} {...shared} />
      ))}
    </ul>
  );
}
