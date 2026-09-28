"use client";

import type { ClanField } from "@/lib/clans/client";
import { CLAN_LIMITS } from "@/lib/clans/names";
import { CLAN_WORLDS } from "@/lib/clans/worlds";
import { describedBy } from "@/lib/clans/write-status";

import styles from "./Clans.module.css";
import CrestPicker from "./CrestPicker";

export type ClanFieldsValue = { name: string; motto: string; crest: number; world: number | null; about: string };

/**
 * What a clan says about itself: name, motto, crest and world, and About
 * when `withAbout`. It is shared by "Start a clan" and the Clan page form.
 * The limits are the database's (`CLAN_LIMITS`); the route checks the rest.
 *
 * Each label is only the field's name; its hint or count sits outside the
 * label and describes the control (`aria-describedby`). `invalid` is the
 * field the last refusal was about (`clanFieldOf`): it is `aria-invalid`,
 * and also described by the box's status line, `errorId`.
 *
 * The World select offers the site's list and None, nothing else: the route
 * takes no other world, so a caller whose stored world is off the list
 * passes None (`listedWorld`).
 */
export default function ClanFields({
  idPrefix,
  value,
  onChange,
  withAbout,
  crestName,
  invalid = null,
  errorId,
}: {
  idPrefix: string;
  value: ClanFieldsValue;
  onChange(next: ClanFieldsValue): void;
  withAbout: boolean;
  /** The current crest's name, for the picker's label. */
  crestName?: string;
  invalid?: ClanField | null;
  /** The id of the status line that says what `invalid` is about. */
  errorId?: string;
}) {
  const set = <K extends keyof ClanFieldsValue>(key: K, next: ClanFieldsValue[K]) => onChange({ ...value, [key]: next });
  const id = (field: ClanField) => `${idPrefix}-${field}`;
  const marked = (field: ClanField) => (invalid === field ? true : undefined);
  const error = (field: ClanField) => invalid === field && errorId;

  return (
    <div className={styles.fields}>
      <div className={styles.field}>
        <label className={styles.fieldLabel} htmlFor={id("name")}>
          Name
        </label>
        <input
          id={id("name")}
          type="text"
          maxLength={CLAN_LIMITS.name}
          autoComplete="off"
          aria-invalid={marked("name")}
          aria-describedby={describedBy(`${id("name")}-hint`, error("name"))}
          value={value.name}
          onChange={(event) => set("name", event.target.value)}
        />
        <span id={`${id("name")}-hint`} className={styles.count}>
          Letters, digits and single spaces, up to {CLAN_LIMITS.name}.
        </span>
      </div>

      <div className={styles.field}>
        <label className={styles.fieldLabel} htmlFor={id("motto")}>
          Motto
        </label>
        <input
          id={id("motto")}
          type="text"
          maxLength={CLAN_LIMITS.motto}
          autoComplete="off"
          aria-invalid={marked("motto")}
          aria-describedby={describedBy(`${id("motto")}-count`, error("motto"))}
          value={value.motto}
          onChange={(event) => set("motto", event.target.value)}
        />
        <span id={`${id("motto")}-count`} className={styles.count}>
          {value.motto.length}/{CLAN_LIMITS.motto}
        </span>
      </div>

      <div className={styles.field}>
        <span className={styles.fieldLabel}>Crest</span>
        <CrestPicker
          value={value.crest}
          name={crestName}
          invalid={invalid === "crest"}
          describedBy={describedBy(error("crest"))}
          onChange={(crest) => set("crest", crest)}
        />
      </div>

      <div className={styles.field}>
        <label className={styles.fieldLabel} htmlFor={id("world")}>
          World
        </label>
        <select
          id={id("world")}
          aria-invalid={marked("world")}
          aria-describedby={describedBy(error("world"))}
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
      </div>

      {withAbout ? (
        <div className={styles.field}>
          <label className={styles.fieldLabel} htmlFor={id("about")}>
            About
          </label>
          <textarea
            id={id("about")}
            rows={5}
            maxLength={CLAN_LIMITS.about}
            aria-invalid={marked("about")}
            aria-describedby={describedBy(`${id("about")}-count`, error("about"))}
            value={value.about}
            onChange={(event) => set("about", event.target.value)}
          />
          <span id={`${id("about")}-count`} className={styles.count}>
            {value.about.length}/{CLAN_LIMITS.about}
          </span>
        </div>
      ) : null}
    </div>
  );
}
