import { ITEM_ICON_SIZE, itemIconSrc } from "@/lib/items/icons";
import { SKILL_ICON_SIZE, SKILLS, skillIconSrc } from "@/lib/skills/icons";
import { TEXTURES, textureSrc } from "@/lib/textures/textures";

/**
 * The pictures an Adventurer Log's stylesheet can use, for the settings
 * page's "Insert a picture". Every one is the site's own, under `/img/`,
 * because that is all the sanitiser lets through (`lib/adventurer-log/css.ts`):
 * a picture from anywhere else would tell its host who reads the log, and
 * could change after staff had looked at it. The picker inserts exactly
 * `cssUrl(src)`, and `pictures.test.ts` checks every one of those against the
 * sanitiser.
 *
 * Items are a search (the assets route keeps the item tables on the server),
 * so only their URL is built here; the rest are short lists.
 */

export type Picture = {
  src: string;
  name: string;
  width: number;
  height: number;
};

/**
 * The 2004 site's own art ("2004 assets" in the README): its backgrounds and
 * stone, the chains, the stone frame's pieces, the main menu's pictures and
 * the paging buttons. `blank.gif` is left out: it is a spacer.
 */
export const SITE_ART: readonly Picture[] = [
  { src: "/img/background.jpg", name: "Cobbles", width: 518, height: 488 },
  { src: "/img/background2.jpg", name: "Cobbles and chains", width: 600, height: 244 },
  { src: "/img/stoneback.gif", name: "Stone", width: 104, height: 104 },
  { src: "/img/title/ssgreybright.png", name: "Grey stone", width: 104, height: 104 },
  { src: "/img/title/ssredbright.jpg", name: "Red stone", width: 104, height: 104 },
  { src: "/img/title/shinystonered.jpg", name: "Shiny red stone", width: 104, height: 104 },
  { src: "/img/edge_a.jpg", name: "Chain", width: 100, height: 43 },
  { src: "/img/edge_d.jpg", name: "Chain, other end", width: 100, height: 43 },
  { src: "/img/edge_c.jpg", name: "Chain and gem", width: 400, height: 42 },
  { src: "/img/edge_g2.jpg", name: "Chain bracket", width: 100, height: 77 },
  { src: "/img/edge_h2.jpg", name: "Chain bracket, other side", width: 100, height: 77 },
  { src: "/img/title/fm_topleft.gif", name: "Frame, top left", width: 6, height: 6 },
  { src: "/img/title/fm_top.gif", name: "Frame, top", width: 500, height: 6 },
  { src: "/img/title/fm_top2.gif", name: "Frame, top (short)", width: 18, height: 6 },
  { src: "/img/title/fm_topright.gif", name: "Frame, top right", width: 6, height: 6 },
  { src: "/img/title/fm_left.gif", name: "Frame, left", width: 6, height: 25 },
  { src: "/img/title/fm_middle.gif", name: "Frame, middle", width: 6, height: 500 },
  { src: "/img/title/fm_right.gif", name: "Frame, right", width: 6, height: 25 },
  { src: "/img/title/fm_bottomleft.gif", name: "Frame, bottom left", width: 6, height: 6 },
  { src: "/img/title/fm_bottom.gif", name: "Frame, bottom", width: 500, height: 6 },
  { src: "/img/title/fm_bottom2.gif", name: "Frame, bottom (short)", width: 18, height: 6 },
  { src: "/img/title/fm_bottomright.gif", name: "Frame, bottom right", width: 6, height: 6 },
  { src: "/img/title/mm2_rs2b.jpg", name: "Book", width: 77, height: 120 },
  { src: "/img/title/mm_accman.jpg", name: "Scales", width: 77, height: 120 },
  { src: "/img/title/mm_chalice.jpg", name: "Chalice", width: 77, height: 120 },
  { src: "/img/title/mm_message.jpg", name: "Bookcase", width: 77, height: 120 },
  { src: "/img/title/mm_player.jpg", name: "Knight", width: 77, height: 120 },
  { src: "/img/title/mm_rules.jpg", name: "Books", width: 77, height: 120 },
  { src: "/img/title/mm_scroll.jpg", name: "Scroll", width: 77, height: 120 },
  { src: "/img/title/mm_security.jpg", name: "Shield", width: 77, height: 120 },
  { src: "/img/title/mm_sword.jpg", name: "Sword", width: 77, height: 120 },
  { src: "/img/title/mm_vote.jpg", name: "Ballot box", width: 77, height: 120 },
  { src: "/img/prevpage.gif", name: "Prev Page", width: 74, height: 35 },
  { src: "/img/nextpage.gif", name: "Next Page", width: 74, height: 35 },
];

/** The fifty textures the game paints its world with (`lib/textures/textures.ts`). */
export const TEXTURE_PICTURES: readonly Picture[] = TEXTURES.flatMap((texture) => {
  const src = textureSrc(texture.id);
  const name = texture.name ? texture.name.replace(/_/g, " ") : `Texture ${texture.id}`;
  return src ? [{ src, name, width: texture.size, height: texture.size }] : [];
});

/** The stats tab's skill icons. */
export const SKILL_PICTURES: readonly Picture[] = SKILLS.flatMap((skill) => {
  const src = skillIconSrc(skill.id);
  return src ? [{ src, name: skill.name, width: SKILL_ICON_SIZE, height: SKILL_ICON_SIZE }] : [];
});

/** An item's inventory icon, for a match from the assets search. */
export function itemPicture(id: number, name: string): Picture | null {
  const src = itemIconSrc(id);
  return src ? { src, name, width: ITEM_ICON_SIZE, height: ITEM_ICON_SIZE } : null;
}

/** What the picker puts in the stylesheet. */
export function cssUrl(src: string): string {
  return `url(${src})`;
}
