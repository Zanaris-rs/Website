import ItemIcon from "@/components/game/ItemIcon";
import { colourClass } from "@/components/site/colour";
import frame from "@/components/site/Frame.module.css";
import Panel from "@/components/site/Panel";
import { groupRoster } from "@/lib/items/groups";
import { itemName } from "@/lib/items/names";
import { dailyFlows, netFlows } from "@/lib/public/economy";
import { flowColour, flowSentence, formatShortWhen } from "@/lib/public/format";
import type { EconomyChanges as ChangesData } from "@/lib/public/read-server";

import EconomySections from "./EconomySections";
import EconomyWindows from "./EconomyWindows";
import styles from "./Public.module.css";

/** "1 day", "2 days": a page that says "1 days" reads as a machine wrote it. */
function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

/**
 * What entered and left the game — which means the rares, and says so.
 *
 * This was "Entered and left the game", four screens down a page whose closing
 * note explained, in eleven point, that it meant the rares only. A reader who
 * got that far had already decided what the block meant. It is its own page
 * now, and the scope is the first thing on it and is listed item by item,
 * because "what entered the game" is a much larger claim than this makes and
 * the difference is the whole of its accuracy.
 *
 * Why only these: a delta between two censuses is a real number for every id in
 * the game, but for most of them it is noise — ore is mined and smelted by the
 * thousand every hour and the difference says nothing anybody wants to know. A
 * partyhat entering the game is an event. The engine's own list is in
 * `data/config/economy.json` and this repo keeps a copy of it, guarded against
 * drift by `groups.test.ts`.
 */
export default function EconomyChanges({ changes }: { changes: ChangesData }) {
  const { window } = changes;
  const flows = changes.flows === null ? null : dailyFlows(changes.flows);
  const days = flows === null ? null : flows.days;
  const tracked = groupRoster("rares") ?? [];
  const moved = changes.lastDay === null ? null : netFlows(changes.lastDay);

  return (
    <>
      <EconomySections current="rares" window={window} />

      <Panel align="left">
        <div className={styles.blockTitle}>
          Rares entering and leaving the game
        </div>
        <div className={styles.prose}>
          <p>
            The difference between one hourly census and the next, for{" "}
            {plural(tracked.length, "rare")} and nothing else. An item{" "}
            <b>entering the game</b> was not in anybody&apos;s save file an hour
            ago and is now; one <b>leaving</b> was and is not.
          </p>
          <p className={styles.note}>
            A trade moves an item between two saves and appears here as nothing
            at all, which is the point: this is not a record of who has what, it
            is a record of how many exist.
          </p>
        </div>
        <ul className={styles.roster}>
          {tracked.map((id) => (
            <li key={id}>
              <ItemIcon id={id} />
              <span>{itemName(id)}</span>
            </li>
          ))}
        </ul>
      </Panel>

      {window.days === 1 ? null : (
        <Panel align="left">
          <div className={styles.blockTitle}>In the last 24 hours</div>
          {moved === null ? (
            <div className={styles.empty}>This could not be read just now.</div>
          ) : moved.length === 0 ? (
            <div className={styles.empty}>
              No rare has entered or left the game in the last 24 hours.
            </div>
          ) : (
            <ul className={styles.dayList}>
              {moved.map((item) => {
                const colour = flowColour(item.delta);
                return (
                  <li key={item.itemId}>
                    <ItemIcon id={item.itemId} />
                    <span>
                      {itemName(item.itemId)} -{" "}
                      <span className={colour ? colourClass[colour] : undefined}>
                        {flowSentence(item.delta)}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      )}

      <Panel align="left">
        <EconomyWindows current={window} section="rares" />
        {days === null ? (
          <div className={styles.empty}>This could not be read just now.</div>
        ) : days.length === 0 ? (
          <div className={styles.empty}>
            {flows?.truncated
              ? // Everything one read returns came from a single day, and a
                // part of a day is not a day. There is movement to show and
                // this page cannot honestly show it.
                "More movement was recorded in the last day than one read of this page returns, so none of it can be shown as a whole day."
              : `No rare has entered or left the game in ${window.label}.`}
          </div>
        ) : (
          days.map((day) => (
            <div key={day.day} className={styles.day}>
              <div className={styles.dayHeading}>{formatShortWhen(day.day)}</div>
              <ul className={styles.dayList}>
                {day.items.map((item) => {
                  const colour = flowColour(item.delta);
                  return (
                    <li key={item.itemId}>
                      <ItemIcon id={item.itemId} />
                      <span>
                        {itemName(item.itemId)} —{" "}
                        <span
                          className={colour ? colourClass[colour] : undefined}
                        >
                          {flowSentence(item.delta)}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
        )}
        {flows !== null && flows.truncated && days !== null && days.length > 0 ? (
          <p className={styles.note}>
            The census wrote more rows in this window than one read returns, so
            this is the newest {plural(days.length, "day")} rather than the
            whole {window.days}: older days are not loaded. The day the read
            stopped inside is left out rather than shown as a part of itself.
          </p>
        ) : null}
        <p className={styles.note}>
          How this is counted, and what it cannot show, is on{" "}
          <a href="/economy/about" className={frame.link}>
            the notes page
          </a>
          .
        </p>
      </Panel>
    </>
  );
}
