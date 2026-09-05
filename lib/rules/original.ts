/**
 * The twelve rules of conduct, transcribed from the 2004 rules page recovered
 * from the engine repo's history (`view/guides/rules.ejs` at `f2c4d3ed^`).
 *
 * Three of them named the company that ran the game rather than the game
 * itself, and those are the three that say Zanaris here: exploits are reported
 * to **our** staff (4), it is **our** staff you must not impersonate (5), and
 * it is **our** customer support you must not misuse (10). Everywhere the text
 * names the *game* — "RuneScape items", "the RuneScape rules" — it is left
 * alone, because that is still the name of the game.
 *
 * `height` is the original card height in pixels; it is what keeps a row of
 * two cards level.
 */
export type Rule = {
  n: number;
  caption: string;
  image: string;
  text: string[];
  height: number;
};

export const ORIGINAL_RULES: Rule[] = [
  {
    n: 1,
    caption: "Offensive Language",
    image: "lang",
    height: 190,
    text: [
      "You must not use any language which may be considered by others to be offensive, racist or obscene.",
    ],
  },
  {
    n: 2,
    caption: "Item Scamming",
    image: "itemscam",
    height: 190,
    text: [
      "You must not scam or deceive other players.",
      "Lying to other players for your own personal gain is not in the spirit of the game.",
    ],
  },
  {
    n: 3,
    caption: "Password Scamming",
    image: "passscam",
    height: 220,
    text: [
      "Asking or trying to persuade another player to give you their password for any reason is against the rules and will not be tolerated.",
    ],
  },
  {
    n: 4,
    caption: "Cheating/Bug Abuse",
    image: "cheating",
    height: 220,
    text: [
      "You must not use or attempt to use any cheats or errors which you find in our software.",
      "Any exploits which you find must be reported to the Zanaris staff immediately, through the message centre.",
    ],
  },
  {
    n: 5,
    caption: "Staff impersonation",
    image: "impstaff",
    height: 250,
    text: [
      "You should not attempt to impersonate Zanaris staff in any way, for any reason.",
      "The names of Zanaris staff appear in white when they speak in-game. Anyone whose name is not white in-game is not staff.",
    ],
  },
  {
    n: 6,
    caption: "Account Sharing/Trading",
    image: "sharing",
    height: 250,
    text: [
      "Each account should only be used by ONE person. Account sharing is NOT allowed.",
      "You may not sell, transfer or lend your account to anyone else, or permit anyone else to use your account, and you may not accept an account that anybody else offers you.",
    ],
  },
  {
    n: 7,
    caption: "Macroing",
    image: "macros",
    height: 235,
    text: [
      "You must not attempt to use other programs (e.g. bots, macros or autominers) in conjunction with our games to give yourself an unfair advantage at the game.",
      "You also may not circumvent any of our mechanisms designed to log out inactive users automatically.",
    ],
  },
  {
    n: 8,
    caption: "Multiple Logging In",
    image: "multilog",
    height: 235,
    text: [
      "You may create more than one RuneScape account, but if you do, you may not log in more than one account at any time, and they must not interact with each other in any way.",
    ],
  },
  {
    n: 9,
    caption: "Encouraging Others to Break Rules",
    image: "scamsite",
    height: 190,
    text: ["You must not encourage others to break any of the RuneScape rules."],
  },
  {
    n: 10,
    caption: "Misuse Of Customer Support",
    image: "misuse",
    height: 190,
    text: [
      "You must not misuse the Zanaris customer support. This includes threatening or reporting an innocent person, or supplying false information.",
    ],
  },
  {
    n: 11,
    caption: "Advertising/Website",
    image: "noadv",
    height: 230,
    text: [
      "You are not allowed to actively advertise in the RuneScape game or RuneScape forums.",
      "This includes advertising any website or product, and no web addresses are allowed. Telling other players any web-address is not allowed.",
    ],
  },
  {
    n: 12,
    caption: "Real World Item Trading",
    image: "rule12",
    height: 230,
    text: [
      "RuneScape items must only be exchanged for other items/services within the game.",
      "Exchanging RuneScape items for real-life money or other real-life benefits is not allowed.",
    ],
  },
];

/** Where a rule's 100x75 illustration lives. */
export function ruleImage(rule: Rule): string {
  return `/img/rules/${rule.image}.jpg`;
}
