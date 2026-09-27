import { RANK_NAMES, type Rank } from "@/lib/clans/ranks";

/**
 * A clan rank's icon, drawn the way the game's clan chat draws them:
 * - the Leader: a gold key;
 * - General, Captain and Lieutenant: a gold, a silver and a bronze star;
 * - Sergeant, Corporal and Recruit: three, two and one chevrons.
 *
 * It is inline SVG at the chat's 13x13, so it needs no picture file and sits
 * in a line of text, labelled with the rank's name. It carries no style of
 * its own: outside the log a page passes `Clans.module.css`'s `rankIcon`,
 * and on the log's card it is `al-rank`, which an owner's CSS can reach.
 */

const STAR = "M6.5 0.5L7.9 4.6L12.2 4.6L8.8 7.2L10 11.4L6.5 8.9L3 11.4L4.2 7.2L0.8 4.6L5.1 4.6Z";
const GOLD = "#f0c800";
const STARS: Partial<Record<Rank, string>> = { general: GOLD, captain: "#c8c8d0", lieutenant: "#c87a3c" };
const CHEVRONS: Partial<Record<Rank, readonly number[]>> = {
  sergeant: [1.5, 5, 8.5],
  corporal: [3.5, 7],
  recruit: [5],
};

export default function RankIcon({ rank, className }: { rank: Rank; className?: string }) {
  const star = STARS[rank];
  return (
    <svg className={className} width={13} height={13} viewBox="0 0 13 13" role="img" aria-label={RANK_NAMES[rank]}>
      {rank === "leader" ? (
        <g>
          <circle cx={3.6} cy={6.5} r={2.4} fill="none" stroke="#000" strokeWidth={2.6} />
          <circle cx={3.6} cy={6.5} r={2.4} fill="none" stroke={GOLD} strokeWidth={1.4} />
          <path d="M5.8 5.7H12.4V7.3H11.8V9.3H10.4V7.3H9.6V8.8H8.2V7.3H5.8Z" fill={GOLD} stroke="#000" strokeWidth={0.5} />
        </g>
      ) : star ? (
        <path d={STAR} fill={star} stroke="#000" strokeWidth={0.6} strokeLinejoin="round" />
      ) : (
        (CHEVRONS[rank] ?? []).map((y) => (
          <path
            key={y}
            d={`M1.5 ${y + 3}L6.5 ${y}L11.5 ${y + 3}`}
            fill="none"
            stroke={GOLD}
            strokeWidth={1.8}
            strokeLinecap="square"
          />
        ))
      )}
    </svg>
  );
}
