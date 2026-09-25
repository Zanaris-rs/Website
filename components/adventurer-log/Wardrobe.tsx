import Chathead from "@/components/game/Chathead";
import type { WardrobeOutfit } from "@/lib/adventurer-log/wardrobe";

/**
 * Every outfit the owner has saved, for anyone reading their log: its name,
 * its chathead, and a star on the one that is their picture. Only saved
 * outfits - never the look the game last saved, which the header falls back
 * to - so nothing here is something the owner did not choose to make.
 *
 * Its `al-` classes are part of the styling contract, like the rest of the
 * log: `.al-wardrobe`, `.al-outfits`, `.al-outfit` (`.al-outfit--default`
 * for the picture) and `.al-outfit-name`.
 */
export default function Wardrobe({ name, outfits }: { name: string; outfits: readonly WardrobeOutfit[] }) {
  if (outfits.length === 0) return null;

  return (
    <section className="al-wardrobe al-box">
      <h2>{name}&rsquo;s Wardrobe</h2>
      <div className="al-box-body">
        <ul className="al-outfits">
          {outfits.map((outfit) => (
            <li
              key={outfit.slot}
              className={outfit.isDefault ? "al-outfit al-outfit--default" : "al-outfit"}
            >
              <Chathead look={outfit.look} scale={0.75} label={`${name}'s outfit: ${outfit.name}`} />
              <span className="al-outfit-name">
                {outfit.isDefault ? <span title={`${name}'s picture`}>&#9733; </span> : null}
                {outfit.name}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
