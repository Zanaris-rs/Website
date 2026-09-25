import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import iconManifest from "@/lib/items/icons.json";

import { sanitizeCss } from "./css";
import { cssUrl, itemPicture, type Picture, SITE_ART, SKILL_PICTURES, TEXTURE_PICTURES } from "./pictures";

const PUBLIC = path.join(__dirname, "../../public");

/** Width and height from a GIF, PNG or JPEG header: enough to keep the list honest. */
function imageSize(bytes: Buffer): [number, number] {
  if (bytes.toString("latin1", 0, 3) === "GIF") return [bytes.readUInt16LE(6), bytes.readUInt16LE(8)];
  if (bytes.toString("latin1", 1, 4) === "PNG") return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
  // JPEG: walk the segments to the first start-of-frame.
  for (let at = 2; at + 9 < bytes.length; ) {
    const marker = bytes[at + 1];
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return [bytes.readUInt16BE(at + 7), bytes.readUInt16BE(at + 5)];
    }
    at += 2 + bytes.readUInt16BE(at + 2);
  }
  throw new Error("not a picture this test reads");
}

/** Every item the search can offer: each id with an icon. */
function everyItem(): Picture[] {
  const out: Picture[] = [];
  for (let id = 0; id < iconManifest.count; id++) {
    const picture = itemPicture(id, String(id));
    if (picture) out.push(picture);
  }
  return out;
}

describe("the picture picker", () => {
  it("lists the 2004 site's art as it is on disk", () => {
    for (const picture of SITE_ART) {
      const bytes = readFileSync(path.join(PUBLIC, picture.src));
      expect(imageSize(bytes), picture.src).toEqual([picture.width, picture.height]);
    }
  });

  it("offers all of the site's own art but the spacers", () => {
    const onDisk = [
      ...readdirSync(path.join(PUBLIC, "img")).map((name) => `/img/${name}`),
      ...readdirSync(path.join(PUBLIC, "img/title")).map((name) => `/img/title/${name}`),
    ].filter((src) => /\.(jpe?g|gif|png)$/.test(src) && !src.endsWith("/blank.gif"));
    expect(SITE_ART.map((picture) => picture.src).sort()).toEqual(onDisk.sort());
  });

  it("offers every texture and skill", () => {
    expect(TEXTURE_PICTURES).toHaveLength(50);
    expect(SKILL_PICTURES).toHaveLength(19);
    expect(TEXTURE_PICTURES[1]).toMatchObject({ name: "water", width: 128, height: 128 });
  });

  it("builds an item's URL the way its icon is drawn everywhere else", () => {
    expect(itemPicture(995, "Coins")).toEqual({
      src: `/img/game/items/995.png?v=${iconManifest.version}`,
      name: "Coins",
      width: 32,
      height: 32,
    });
    expect(itemPicture(1649, "Invisible")).toBeNull();
  });

  it("inserts only URLs the sanitiser keeps, exactly as inserted", () => {
    const every = [...SITE_ART, ...TEXTURE_PICTURES, ...SKILL_PICTURES, ...everyItem()];
    expect(every.length).toBeGreaterThan(3000);
    for (const picture of every) {
      const out = sanitizeCss(`.al-page { background: ${cssUrl(picture.src)} }`, "hero");
      expect(out.dropped, picture.src).toEqual([]);
      expect(out.css, picture.src).toContain(`background:${cssUrl(picture.src)}`);
    }
  });
});
