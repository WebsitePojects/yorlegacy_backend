// Unilevel rank ladder. GATE-RANK-UNILEVEL-20260615: rank is determined SOLELY by
// lifetime UNILEVEL INCOME total (sum of 'unilevel' wallet credits), NOT by overall
// total income. Example: total income PHP 100k but unilevel income PHP 20k → NOT
// ranked; you need PHP 50k of unilevel income to reach Manager, and so on up the
// ladder. Thresholds + names come from the Yor compensation ladder image.
// (Superseded: rank was previously gated by lifetime TOTAL income — GATE-RANK-TOTALINCOME-20260613.)
// Below the first threshold the member is unranked.

export type RankTier = {
  level: number; // 1..11; 0 = unranked
  name: string;
  threshold: number; // minimum lifetime UNILEVEL income (PHP) to hold this rank
};

// Ordered ascending by threshold.
export const RANK_LADDER: readonly RankTier[] = [
  { level: 1, name: 'Manager', threshold: 50_000 },
  { level: 2, name: 'Bronze Director', threshold: 100_000 },
  { level: 3, name: 'Silver Director', threshold: 250_000 },
  { level: 4, name: 'Gold Director', threshold: 500_000 },
  { level: 5, name: 'Platinum Director', threshold: 750_000 },
  { level: 6, name: 'Millionaires Circle', threshold: 1_000_000 },
  { level: 7, name: '1 Diamond Director', threshold: 3_000_000 },
  { level: 8, name: '2 Diamond Director', threshold: 5_000_000 },
  { level: 9, name: '1 Star Director', threshold: 15_000_000 },
  { level: 10, name: '2 Star Director', threshold: 25_000_000 },
  { level: 11, name: 'Hall of Famer', threshold: 50_000_000 }
] as const;

export const UNRANKED: RankTier = { level: 0, name: 'Unranked', threshold: 0 };

export type RankProgress = {
  level: number;
  rankName: string;
  unilevelIncome: number; // the rank-qualifying income (lifetime unilevel credits)
  currentThreshold: number; // threshold of the held rank (0 when unranked)
  nextRankName: string | null; // null at the top of the ladder
  nextThreshold: number | null;
  remainingToNext: number | null; // PHP of unilevel income needed to reach the next rank
};

// GATE-RANK-UNILEVEL-20260615: highest ladder tier whose threshold the member's
// lifetime UNILEVEL income meets or exceeds (overall total income is NOT used).
export function rankForIncome(unilevelIncome: number): RankProgress {
  const income = Number.isFinite(unilevelIncome) && unilevelIncome > 0 ? unilevelIncome : 0;

  let held: RankTier = UNRANKED;
  for (const tier of RANK_LADDER) {
    if (income >= tier.threshold) {
      held = tier;
    } else {
      break;
    }
  }

  const next = RANK_LADDER.find((tier) => tier.threshold > held.threshold && income < tier.threshold) ?? null;

  return {
    level: held.level,
    rankName: held.name,
    unilevelIncome: income,
    currentThreshold: held.threshold,
    nextRankName: next ? next.name : null,
    nextThreshold: next ? next.threshold : null,
    remainingToNext: next ? Number((next.threshold - income).toFixed(2)) : null
  };
}
