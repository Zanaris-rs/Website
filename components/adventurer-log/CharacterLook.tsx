"use client";

import { useId, useMemo, useState } from "react";

import Figure from "@/components/game/Figure";
import Tile from "@/components/site/Tile";
import { SAVE_MESSAGES } from "@/lib/adventurer-log/character-draft";
import { send } from "@/lib/adventurer-log/client";
import { outfitEditHref, outfitImportHref } from "@/lib/adventurer-log/href";
import type { Persona } from "@/lib/adventurer-log/persona";
import { type StageInput, stageOf } from "@/lib/adventurer-log/persona-input";
import { FACING_NAMES, nearestFacing } from "@/lib/chathead/facing";
import type { Look } from "@/lib/chathead/look";
import { firstEmptySlot, keepSame, type SavedOutfits } from "@/lib/chathead/outfit-store";
import { apiStore } from "@/lib/outfits/api-store";
import { SCENES, sceneOf, sceneSrc } from "@/lib/scenes/spots";

import styles from "./Character.module.css";
import CharacterTabs from "./CharacterTabs";
import CharacterWorkspace from "./CharacterWorkspace";
import { usePersonaStage } from "./PersonaStage";

const STAGE_URL = "/api/adventurer-log/persona/stage";

/** The stage save's refusals, where the Look tab has no field to highlight. */
const STAGE_MESSAGES: Readonly<Record<string, string>> = {
  ...SAVE_MESSAGES,
  bad_key: "That scene is not on the list any more. Pick another.",
  bad_facing: "Your figure cannot face that way.",
};

type Status = { kind: "done" | "error"; message: string } | null;

/**
 * Character › Look: what you wear, where you stand and which way you face.
 * Nothing here waits for a Save:
 *
 * - Clicking an outfit wears it (`outfit_set_default`): the stage's figure
 *   and chathead change at once, and so does the log.
 * - Clicking a scene stands you in it (`adventure_persona_save_stage`).
 * - "Face this way" keeps the way the stage's figure is turned now, as the
 *   way it faces when someone opens the log.
 *
 * Each outfit has an Edit link to the outfit editor; an empty slot links to
 * a new one there, and "Import your in-game look" opens the first empty
 * slot with the game's look in it.
 */
export default function CharacterLook({
  name,
  username,
  joinedAt,
  headline,
  persona,
  initialOutfits,
  headLook: firstHead,
}: {
  name: string;
  username: string;
  joinedAt: string;
  headline: string;
  /** The saved persona. */
  persona: Persona;
  initialOutfits: SavedOutfits;
  /** The chathead's look as the page was read: the worn outfit, else the game's head. */
  headLook: Look | null;
}) {
  const [store] = useState(apiStore);
  const [outfits, setOutfits] = useState(initialOutfits);
  const [stage, setStage] = useState<StageInput>(() => stageOf(persona));
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status>(null);
  const wearingId = useId();
  const standId = useId();

  const worn = outfits.defaultSlot === null ? null : outfits.outfits[outfits.defaultSlot];
  const outfitLook = worn?.look ?? null;
  // With an outfit worn, the chathead is its head; with none (there is
  // nothing to wear yet), the game's, as the page read it.
  const headLook = outfitLook ?? firstHead;
  const shown = useMemo<Persona>(() => ({ ...persona, scene: stage.scene, facing: stage.facing }), [persona, stage]);
  const turns = sceneOf(stage.scene)?.turns ?? null;
  const empty = firstEmptySlot(outfits);

  async function wear(slot: number) {
    if (busy || slot === outfits.defaultSlot) return;
    setBusy(true);
    setStatus(null);
    try {
      const next = await store.setDefault(slot);
      setOutfits((current) => keepSame(current, next));
      setStatus({ kind: "done", message: `You're wearing ${next.outfits[slot]?.name ?? "it"}.` });
    } catch (error) {
      setStatus({ kind: "error", message: error instanceof Error ? error.message : "Something went wrong." });
    } finally {
      setBusy(false);
    }
  }

  async function saveStage(next: StageInput, done: string) {
    setBusy(true);
    setStatus(null);
    const result = await send(STAGE_URL, next, "POST", STAGE_MESSAGES);
    setBusy(false);
    if (!result.ok) {
      setStatus({ kind: "error", message: result.message });
      return;
    }
    setStage(next);
    setStatus({ kind: "done", message: done });
  }

  function stand(scene: string | null, where: string) {
    if (busy || scene === stage.scene) return;
    void saveStage({ scene, facing: stage.facing }, where);
  }

  return (
    <CharacterWorkspace
      name={name}
      username={username}
      joinedAt={joinedAt}
      headline={headline}
      persona={shown}
      outfitLook={outfitLook}
      headLook={headLook}
      stageKey={stage.scene ?? "none"}
      below={
        outfitLook ? (
          <FaceThisWay
            saved={stage.facing}
            turns={turns}
            busy={busy}
            onFace={(facing) =>
              void saveStage({ ...stage, facing }, "Saved: you face this way when someone opens your log.")
            }
          />
        ) : null
      }
    >
      <CharacterTabs current="look" />

      <section className={styles.section} aria-labelledby={wearingId}>
        <h2 id={wearingId} className={styles.sectionTitle}>
          Wearing
        </h2>
        <ul className={styles.outfits} aria-label="Your outfits">
          {outfits.outfits.map((outfit, slot) => {
            const isWorn = slot === outfits.defaultSlot;
            return (
              <li key={slot} className={styles.outfitCell}>
                {outfit ? (
                  <>
                    <button
                      type="button"
                      className={styles.outfit}
                      aria-pressed={isWorn}
                      aria-label={isWorn ? `${outfit.name}: wearing` : `Wear ${outfit.name}`}
                      disabled={busy && !isWorn}
                      onClick={() => void wear(slot)}
                    >
                      <Figure look={outfit.look} scale={0.5} label={outfit.name} />
                      <span className={styles.outfitName}>{outfit.name}</span>
                      <span className={styles.wearing}>{isWorn ? "Wearing" : " "}</span>
                    </button>
                    <a className={styles.edit} href={outfitEditHref(slot)} aria-label={`Edit ${outfit.name}`}>
                      Edit
                    </a>
                  </>
                ) : (
                  <a className={styles.newOutfit} href={outfitEditHref(slot)}>
                    + New outfit
                  </a>
                )}
              </li>
            );
          })}
        </ul>
        <div className={styles.importRow}>
          <button
            type="button"
            disabled={empty === null}
            onClick={() => {
              if (empty !== null) window.location.assign(outfitImportHref(empty));
            }}
          >
            Import your in-game look
          </button>
          <span className={styles.hint}>
            {empty === null
              ? "All ten slots are full. Delete an outfit in the editor to import another."
              : "It opens in the editor, in an empty slot, for you to save."}
          </span>
        </div>
      </section>

      <section className={styles.section} aria-labelledby={standId}>
        <h2 id={standId} className={styles.sectionTitle}>
          Where you stand
        </h2>
        <div className={styles.scenes} role="group" aria-label="Scene">
          <button
            type="button"
            className={styles.scene}
            aria-pressed={stage.scene === null}
            disabled={!outfitLook || busy}
            onClick={() => stand(null, "You stand in no scene.")}
          >
            <span className={`${styles.thumb} ${styles.noScene}`} aria-hidden="true" />
            <span className={styles.sceneName}>No scene</span>
          </button>
          {SCENES.spots.map((spot) => (
            <button
              key={spot.key}
              type="button"
              className={styles.scene}
              aria-pressed={stage.scene === spot.key}
              disabled={!outfitLook || busy}
              onClick={() => stand(spot.key, `You stand at ${spot.name}.`)}
            >
              <Tile src={sceneSrc(spot)} width={spot.width / 2} height={spot.height / 2} className={styles.thumb} />
              <span className={styles.sceneName}>{spot.name}</span>
            </button>
          ))}
        </div>
        <p className={styles.hint}>
          {outfitLook ? "Clicking a scene saves it at once." : "Save an outfit to stand in a scene."}
        </p>
      </section>

      <p role="status" className={status?.kind === "error" ? `${styles.status} ${styles.error}` : styles.status}>
        {busy ? "Saving…" : (status?.message ?? "")}
      </p>
    </CharacterWorkspace>
  );
}

/**
 * Under the stage: which way the figure faces when someone opens the log,
 * and "Face this way", to keep the way it is turned now. Inside the stage,
 * so it reads the stage's facing. The saved facing shows as the nearest the
 * scene allows, which is how the log will draw it.
 */
function FaceThisWay({
  saved,
  turns,
  busy,
  onFace,
}: {
  saved: number;
  turns: readonly number[] | null;
  busy: boolean;
  onFace(facing: number): void;
}) {
  const stage = usePersonaStage();
  const opens = nearestFacing(saved, turns);
  return (
    <div className={styles.facing}>
      <p className={styles.hint}>
        When someone opens your log you face: <b>{FACING_NAMES[opens]}</b>
      </p>
      <button type="button" disabled={busy || stage.facing === opens} onClick={() => onFace(stage.facing)}>
        Face this way
      </button>
    </div>
  );
}
