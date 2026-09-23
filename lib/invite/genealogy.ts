import type { GenealogyRow } from "./queries";

/**
 * The flat rows of `accounts.staff_invite_genealogy`, as a family tree.
 *
 * A progenitor is an account nobody invited: the accounts from before
 * invite-only registration, and any made at the engine's CLI since. They are
 * the roots, oldest citizen first. Under each account are the accounts it let
 * in, in the order they joined.
 *
 * An account whose inviter is not in the rows is shown as a root rather than
 * dropped. The database cannot produce a loop (an account claims its link as
 * it is made, so its inviter is always older), but if one ever arrived its
 * members would have no root to hang from, so they are made roots too instead
 * of vanishing from the page.
 */

export type GenealogyNode = GenealogyRow & {
  readonly children: readonly GenealogyNode[];
  /** Everybody below this account, at every depth. */
  readonly descendants: number;
};

type Draft = GenealogyRow & { children: Draft[]; descendants: number };

function byJoined(a: GenealogyRow, b: GenealogyRow): number {
  const at = a.joinedAt ?? "";
  const bt = b.joinedAt ?? "";
  if (at !== bt) return at < bt ? -1 : 1;
  return a.citizenNumber - b.citizenNumber;
}

export function buildGenealogy(rows: readonly GenealogyRow[]): GenealogyNode[] {
  const drafts = new Map<number, Draft>();
  for (const row of rows) {
    drafts.set(row.citizenNumber, { ...row, children: [], descendants: 0 });
  }

  const roots: Draft[] = [];
  for (const draft of drafts.values()) {
    const parent = draft.invitedBy === null ? undefined : drafts.get(draft.invitedBy);
    if (parent && parent !== draft) {
      parent.children.push(draft);
    } else {
      roots.push(draft);
    }
  }

  // Walk down from the roots. Anything not reached sits in a loop; each loop
  // gets one root (its oldest citizen) and the walk carries on from there.
  const reached = new Set<number>();
  const walk = (node: Draft): number => {
    reached.add(node.citizenNumber);
    node.children = node.children.filter((child) => !reached.has(child.citizenNumber));
    node.children.sort(byJoined);
    node.descendants = node.children.reduce((sum, child) => sum + 1 + walk(child), 0);
    return node.descendants;
  };

  roots.sort((a, b) => a.citizenNumber - b.citizenNumber);
  roots.forEach(walk);

  for (const draft of [...drafts.values()].sort((a, b) => a.citizenNumber - b.citizenNumber)) {
    if (!reached.has(draft.citizenNumber)) {
      roots.push(draft);
      walk(draft);
    }
  }

  return roots;
}
