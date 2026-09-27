/**
 * What the Clan tab says when a clan write is refused: one sentence per
 * code (`CLAN_WRITE_RESULTS`), and a few that depend on what was being done
 * (a `self` when inviting is not a `self` when removing). Passed to `send()`
 * (lib/adventurer-log/client.ts), whose own sentences cover the rest -
 * signed out, another site, unavailable.
 */

export type ClanAction =
  | "create"
  | "page"
  | "perms"
  | "invite"
  | "cancel"
  | "answer"
  | "rank"
  | "remove"
  | "leave"
  | "handOver"
  | "disband"
  | "notice"
  | "unnotice";

export const CLAN_MESSAGES: Readonly<Record<string, string>> = {
  // Every clan write asks who is writing first, so this is the caller.
  not_found: "Your account could not be found.",
  banned: "Your account is banned.",
  muted: "You are muted, so you can change your clan's picks but not its words: the name, motto, About and notices.",
  not_member: "You are not in a clan any more. Reload the page.",
  forbidden: "Your rank does not allow that.",
  leader: "The Leader cannot leave while others remain: hand over or disband first.",
  bad_name:
    'A clan\'s name is 1 to 20 letters, digits and single spaces, starting and ending with a letter or digit, and cannot look like "Clan 123".',
  bad_motto: "The motto is at most 80 characters, on one line.",
  bad_crest: "Pick a crest: any item that is not a note.",
  bad_world: "Pick one of the worlds, or none.",
  bad_about: "About is at most 600 characters.",
  bad_perm: "Pick who can do each thing from the list.",
  bad_rank: "Pick a rank below your own.",
  bad_title: "A notice's title is 1 to 40 characters, on one line.",
  bad_body: "A notice is 1 to 280 characters.",
  self: "That is you.",
  no_such_player: "There is no player by that name.",
  no_such_member: "That player is not in your clan.",
  no_invite: "That invitation is not there any more.",
  no_notice: "That notice is not there any more.",
  taken: "Another clan already has that name.",
  in_clan: "That player is already in a clan.",
  already: "That player already has an invitation from your clan.",
  full: "The clan is full: 50 members.",
  too_many: "Your clan already has 20 invitations waiting for an answer.",
  // Deleted notices still count towards the ten, so this never says to delete one.
  rate_limited: "Your clan has posted 10 notices today. Try again tomorrow.",
};

const OVERRIDES: Record<ClanAction, Readonly<Record<string, string>>> = {
  create: {
    in_clan: "You are already in a clan. Leave it before starting one.",
    muted: "You are muted, so you cannot start a clan: its name is words.",
  },
  page: {},
  perms: { forbidden: "Only the Leader sets who can do what." },
  invite: { self: "You cannot invite yourself." },
  cancel: {},
  answer: { in_clan: "You are already in a clan. Leave it before joining another.", full: "That clan is full: 50 members." },
  // clan_set_rank has no `self`: your own rank is not below you, so it is `forbidden`.
  rank: { forbidden: "You can only change the rank of members below you." },
  remove: { self: "You cannot remove yourself: use Leave the clan.", forbidden: "You can only remove members below your rank." },
  leave: {},
  handOver: { self: "You already lead the clan.", forbidden: "Only the Leader can hand over the clan." },
  disband: { forbidden: "Only the Leader can disband the clan." },
  notice: {},
  unnotice: { forbidden: "You can only delete your own notices, unless your rank may post them." },
};

export function clanMessages(action: ClanAction): Readonly<Record<string, string>> {
  return { ...CLAN_MESSAGES, ...OVERRIDES[action] };
}
