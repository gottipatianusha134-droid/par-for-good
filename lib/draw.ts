/**
 * Pure draw + prize-pool logic. No I/O, so it can be unit-tested
 * (`npm run test:draw`).
 *
 * INTERPRETATION (the PRD leaves this open, so it is documented here):
 *  - A draw picks 5 distinct numbers in the Stableford range 1–45.
 *  - A subscriber's entry is their 5 stored scores.
 *  - "Matches" = how many distinct score values appear in the drawn numbers.
 *  - Exactly 3, 4 or 5 matches win the tier; the tier prize is split equally.
 *  - Only the 5-match jackpot rolls over. Unclaimed 4/3 tiers are not carried.
 */
export const SCORE_MIN = 1;
export const SCORE_MAX = 45;
export const NUMBERS_PER_DRAW = 5;
export const TIER_SHARES = { 5: 40, 4: 35, 3: 25 } as const;

export type Tier = 5 | 4 | 3;
export type DrawMode = "random" | "algorithmic";
export type Rng = () => number;
export type Plan = "monthly" | "yearly";
export type Prices = { monthly: number; yearly: number };
export type TierPools = Record<Tier, number>;

const byAsc = (a: number, b: number) => a - b;

/** Standard lottery-style draw: 5 unique numbers, uniformly random. */
export function generateRandomNumbers(rng: Rng = Math.random): number[] {
  const bag = Array.from({ length: SCORE_MAX }, (_, i) => i + SCORE_MIN);
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  return bag.slice(0, NUMBERS_PER_DRAW).sort(byAsc);
}

/**
 * Algorithmic draw: every number starts with weight 1 and gains +1 for each
 * time it appears in a player's stored scores. Scores golfers actually post
 * are therefore more likely to be drawn, which raises the chance of winners.
 */
export function generateWeightedNumbers(allScores: number[], rng: Rng = Math.random): number[] {
  const weights = new Map<number, number>();
  for (let n = SCORE_MIN; n <= SCORE_MAX; n++) weights.set(n, 1);
  for (const s of allScores) if (weights.has(s)) weights.set(s, (weights.get(s) as number) + 1);

  const picked: number[] = [];
  while (picked.length < NUMBERS_PER_DRAW) {
    const entries = Array.from(weights.entries());
    const total = entries.reduce((sum, [, w]) => sum + w, 0);
    let r = rng() * total;
    let chosen = entries[entries.length - 1][0]; // fallback guards float drift
    for (const [n, w] of entries) {
      r -= w;
      if (r <= 0) { chosen = n; break; }
    }
    picked.push(chosen);
    weights.delete(chosen);
  }
  return picked.sort(byAsc);
}

export function generateNumbers(mode: DrawMode, allScores: number[], rng: Rng = Math.random): number[] {
  return mode === "algorithmic" ? generateWeightedNumbers(allScores, rng) : generateRandomNumbers(rng);
}

export function countMatches(userScores: number[], numbers: number[]): number {
  const drawn = new Set(numbers);
  return Array.from(new Set(userScores)).filter((s) => drawn.has(s)).length;
}

/** What one subscriber contributes per month (yearly plans are spread over 12 months). */
export function monthlyEquivalentMinor(plan: Plan, prices: Prices): number {
  return plan === "yearly" ? Math.floor(prices.yearly / 12) : prices.monthly;
}

export type PoolInput = {
  plans: Plan[];            // one entry per ACTIVE subscriber
  poolPercent: number;      // % of each subscription that funds prizes
  prices: Prices;
  carryInMinor?: number;    // rolled-over jackpot
};

export function computePool({ plans, poolPercent, prices, carryInMinor = 0 }: PoolInput) {
  const revenue = plans.reduce((sum, p) => sum + monthlyEquivalentMinor(p, prices), 0);
  const baseMinor = Math.floor((revenue * poolPercent) / 100);
  const tierPools: TierPools = {
    5: Math.floor((baseMinor * TIER_SHARES[5]) / 100) + carryInMinor,
    4: Math.floor((baseMinor * TIER_SHARES[4]) / 100),
    3: Math.floor((baseMinor * TIER_SHARES[3]) / 100),
  };
  return { revenueMinor: revenue, baseMinor, carryInMinor, tierPools };
}

export type Entry = { userId: string; scores: number[] };

export function resolveDraw(entries: Entry[], numbers: number[], tierPools: TierPools) {
  const scored = entries.map((e) => ({ ...e, matches: countMatches(e.scores, numbers) }));
  const tiers = ([5, 4, 3] as Tier[]).map((tier) => {
    const winners = scored.filter((e) => e.matches === tier).map((e) => e.userId);
    const perWinnerMinor = winners.length ? Math.floor(tierPools[tier] / winners.length) : 0;
    return { tier, poolMinor: tierPools[tier], winners, perWinnerMinor };
  });
  // Only an unclaimed jackpot is carried forward.
  const carryOutMinor = tiers[0].winners.length === 0 ? tierPools[5] : 0;
  return { entries: scored, tiers, carryOutMinor };
}
