import { formatNumber } from "@/lib/hiscores/format";
import type { LogRecord } from "@/lib/adventurer-log/records";
import { recordDuration } from "@/lib/records/durations";

/**
 * The Records box: the player's best Overall gain for each record length
 * they hold a place on, shortest first - migration 015's
 * `accounts.adventure_log_records`. Hidden entirely when there are none: a
 * player who has never run a record, the same as one whose only attempt was
 * rejected, has nothing to show here.
 */
export default function Records({ records }: { records: readonly LogRecord[] }) {
  if (records.length === 0) return null;

  return (
    <section className="al-records al-box">
      <h2>Records</h2>
      <div className="al-box-body">
        <ul>
          {records.map((record) => {
            const duration = recordDuration(record.durationSeconds);
            return (
              <li
                key={record.durationSeconds}
                className={`al-record al-record--${record.durationSeconds}`}
              >
                <span className="al-record-label">{duration?.label ?? `${record.durationSeconds}s`}</span>
                <span className="al-record-xp">{formatNumber(record.gained)} xp</span>
                <a
                  className="al-record-rank"
                  href={`/hiscores/records?duration=${record.durationSeconds}&category=0`}
                >
                  #{record.rank}
                </a>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
