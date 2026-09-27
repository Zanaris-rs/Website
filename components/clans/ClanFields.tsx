"use client";

import type { ClanField } from "@/lib/clans/client";
import { CLAN_LIMITS } from "@/lib/clans/names";
import { CLAN_WORLDS } from "@/lib/clans/worlds";

import styles from "./Clans.module.css";
import CrestPicker from "./CrestPicker";

export type ClanFieldsValue = { name: string; motto: string; crest: number; world: number | null; about: string };

/**
 * What a clan says about itself: name, motto, crest and world, and About
 * when `withAbout`. It is shared by "Start a clan" and the Clan page form.
 * The limits are the database's (`CLAN_LIMITS`); the route checks the rest.
 *
 * The World select offers the site's list and None, nothing else: the route
 * takes no other world, so a caller whose stored world is off the list
 * passes None (`listedWorld`). `invalid` is the field the last refusal was
 * about (`clanFieldOf`), marked `aria-invalid`.
 */
export default function ClanFields({
  idPrefix,
  value,
  onChange,
  withAbout,
  crestName,
  invalid = null,
}: {
  idPrefix: string;
  value: ClanFieldsValue;
  onChange(next: ClanFieldsValue): void;
  withAbout: boolean;
  /** The current crest's name, for the picker's label. */
  crestName?: string;
  invalid?: ClanField | null;
}) {
  const set = <K extends keyof ClanFieldsValue>(key: K, next: ClanFieldsValue[K]) => onChange({ ...value, [key]: next });
  const marked = (field: ClanField) => (invalid === field ? true : undefined);

  return (
    <div className={styles.fields}>
      <label className={styles.field} htmlFor={`${idPrefix}-name`}>
        <span className={styles.fieldLabel}>Name</span>
        <input
          id={`${idPrefix}-name`}
          type="text"
          maxLength={CLAN_LIMITS.name}
          autoComplete="off"
          aria-invalid={marked("name")}
          value={value.name}
          onChange={(event) => set("name", event.target.value)}
        />
        <span className={styles.count}>Letters, digits and single spaces, up to {CLAN_LIMITS.name}.</span>
      </label>

      <label className={styles.field} htmlFor={`${idPrefix}-motto`}>
        <span className={styles.fieldLabel}>Motto</span>
        <input
          id={`${idPrefix}-motto`}
          type="text"
          maxLength={CLAN_LIMITS.motto}
          autoComplete="off"
          aria-invalid={marked("motto")}
          value={value.motto}
          onChange={(event) => set("motto", event.target.value)}
        />
        <span className={styles.count}>
          {value.motto.length}/{CLAN_LIMITS.motto}
        </span>
      </label>

      <div className={styles.field}>
        <span className={styles.fieldLabel}>Crest</span>
        <CrestPicker
          value={value.crest}
          name={crestName}
          invalid={invalid === "crest"}
          onChange={(id) => set("crest", id)}
        />
      </div>

      <label className={styles.field} htmlFor={`${idPrefix}-world`}>
        <span className={styles.fieldLabel}>World</span>
        <select
          id={`${idPrefix}-world`}
          aria-invalid={marked("world")}
          value={value.world ?? ""}
          onChange={(event) => set("world", event.target.value === "" ? null : Number(event.target.value))}
        >
          <option value="">None</option>
          {CLAN_WORLDS.map((world) => (
            <option key={world.id} value={world.id}>
              {world.name} ({world.region})
            </option>
          ))}
        </select>
      </label>

      {withAbout ? (
        <label className={styles.field} htmlFor={`${idPrefix}-about`}>
          <span className={styles.fieldLabel}>About</span>
          <textarea
            id={`${idPrefix}-about`}
            rows={5}
            maxLength={CLAN_LIMITS.about}
            aria-invalid={marked("about")}
            value={value.about}
            onChange={(event) => set("about", event.target.value)}
          />
          <span className={styles.count}>
            {value.about.length}/{CLAN_LIMITS.about}
          </span>
        </label>
      ) : null}
    </div>
  );
}
