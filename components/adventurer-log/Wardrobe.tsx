"use client";

import Figure from "@/components/game/Figure";
import type { WardrobeOutfit } from "@/lib/adventurer-log/wardrobe";
import { type Look, lookKey } from "@/lib/chathead/look";
import { prefersReducedMotion } from "@/lib/game-chat/clock";

import { usePersonaStage } from "./PersonaStage";

/**
 * Every outfit the owner has saved, for anyone reading their log, under
 * their card: its name, the whole figure wearing it, and a star on the one
 * they usually wear. Only saved outfits - never the look the game last
 * saved, which the header falls back to as a chathead - so no figure here
 * is something the owner did not choose to make, and nothing they wear in
 * game is drawn whole.
 *
 * When the card draws the owner's figure (`interactive`), each outfit is a
 * button. Clicking one has the card's figure and the dialogue's chathead
 * wear it (`PersonaStage`'s `tryOn`) and plays the current emote in it
 * (unless the reader prefers reduced motion), and
 * the card says so, with a way back (`CardFigure`). Clicking the outfit they
 * usually wear, or the one being tried on, goes back to usual. Nothing is
 * saved. Without a figure on the card there is nothing to try an outfit on,
 * and the outfits are plain pictures.
 *
 * The figures are the plain figure at half size: never turned, so they stay
 * the golden pictures.
 *
 * Its `al-` classes are part of the styling contract, like the rest of the
 * log: `.al-wardrobe`, `.al-wardrobe-hint`, `.al-outfits`, `.al-outfit`
 * (`.al-outfit--default` for the one they usually wear, `.al-outfit--shown`
 * for the one the card shows now), `.al-outfit-button` and
 * `.al-outfit-name`.
 */
export default function Wardrobe({
  name,
  outfits,
  interactive = false,
}: {
  name: string;
  outfits: readonly WardrobeOutfit[];
  /** Whether a click tries an outfit on: only when the card draws a figure. */
  interactive?: boolean;
}) {
  const stage = usePersonaStage();
  if (outfits.length === 0) return null;

  const usual = outfits.find((outfit) => outfit.isDefault)?.look ?? null;
  const shown = stage.tryOn ?? usual;
  const shownKey = shown ? lookKey(shown) : null;

  const pick = (look: Look, isUsual: boolean) => {
    if (isUsual || lookKey(look) === shownKey) {
      stage.setTryOn(null);
      return;
    }
    stage.setTryOn(look);
    // A pick only plays the emote for a reader who has not asked for less motion.
    if (!prefersReducedMotion()) stage.replayEmote();
  };

  return (
    <section className="al-wardrobe al-box">
      <h2>{name}&rsquo;s Wardrobe</h2>
      <div className="al-box-body">
        {interactive ? (
          <p className="al-wardrobe-hint">
            Click an outfit to see {name} wear it. Click it again, or the usual one, to go back.
          </p>
        ) : null}
        <ul className="al-outfits">
          {outfits.map((outfit) => {
            const isShown = interactive && lookKey(outfit.look) === shownKey;
            const classes = `al-outfit${outfit.isDefault ? " al-outfit--default" : ""}${isShown ? " al-outfit--shown" : ""}`;
            const picture = (
              <>
                <Figure look={outfit.look} label={`${name}'s outfit: ${outfit.name}`} scale={0.5} />
                <span className="al-outfit-name">
                  {outfit.isDefault ? <span title={`${name}'s picture`}>&#9733; </span> : null}
                  {outfit.name}
                </span>
              </>
            );
            return (
              <li key={outfit.slot} className={classes}>
                {interactive ? (
                  <button
                    type="button"
                    className="al-outfit-button"
                    aria-pressed={isShown}
                    aria-label={outfit.isDefault ? `${outfit.name}, the usual outfit` : outfit.name}
                    onClick={() => pick(outfit.look, outfit.isDefault)}
                  >
                    {picture}
                  </button>
                ) : (
                  picture
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
