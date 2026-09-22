import assert from "node:assert/strict";
import {
  generateRandomNumbers, generateWeightedNumbers, countMatches,
  computePool, resolveDraw, monthlyEquivalentMinor,
} from "./draw.ts";

const prices = { monthly: 49900, yearly: 499900 };

// seeded rng for repeatability
function mulberry(seed: number) {
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// 1. random draw: 5 unique numbers in 1..45, sorted
for (let i = 0; i < 500; i++) {
  const n = generateRandomNumbers(mulberry(i));
  assert.equal(new Set(n).size, 5); assert.ok(n.every((x) => x >= 1 && x <= 45));
  assert.deepEqual(n, [...n].sort((a, b) => a - b));
}

// 2. weighted draw: valid, and heavily-posted scores are drawn more often
const heavy = Array(200).fill(36);
let hits = 0;
for (let i = 0; i < 400; i++) { const n = generateWeightedNumbers(heavy, mulberry(i)); assert.equal(new Set(n).size, 5); if (n.includes(36)) hits++; }
assert.ok(hits > 300, `weighted draw should favour 36 (got ${hits}/400)`);

// 3. matching counts distinct values only
assert.equal(countMatches([10, 10, 12, 20, 30], [10, 12, 40, 41, 42]), 2);
assert.equal(countMatches([1, 2, 3, 4, 5], [1, 2, 3, 4, 5]), 5);

// 4. yearly plan spreads over 12 months
assert.equal(monthlyEquivalentMinor("yearly", prices), Math.floor(499900 / 12));

// 5. pool: 10 monthly subscribers, 50% -> 249,500 paise; tiers 40/35/25
const pool = computePool({ plans: Array(10).fill("monthly"), poolPercent: 50, prices });
assert.equal(pool.baseMinor, 249500);
assert.equal(pool.tierPools[5], 99800); assert.equal(pool.tierPools[4], 87325); assert.equal(pool.tierPools[3], 62375);

// 6. equal split among winners, rollover only for jackpot
const nums = [1, 2, 3, 4, 5];
const entries = [
  { userId: "a", scores: [1, 2, 3, 40, 41] },  // 3 match
  { userId: "b", scores: [1, 2, 3, 42, 43] },  // 3 match
  { userId: "c", scores: [9, 9, 9, 9, 9] },    // 0
];
const r = resolveDraw(entries, nums, pool.tierPools);
const t3 = r.tiers.find((t) => t.tier === 3)!;
assert.deepEqual(t3.winners.sort(), ["a", "b"]); assert.equal(t3.perWinnerMinor, Math.floor(62375 / 2));
assert.equal(r.carryOutMinor, pool.tierPools[5], "unclaimed jackpot rolls over");
assert.equal(r.tiers.find((t) => t.tier === 4)!.winners.length, 0);

// 7. jackpot claimed -> no carry; carry-in is added to the jackpot tier
const won = resolveDraw([{ userId: "z", scores: nums }], nums, computePool({ plans: ["monthly"], poolPercent: 50, prices, carryInMinor: 1000 }).tierPools);
assert.equal(won.carryOutMinor, 0); assert.equal(won.tiers[0].winners[0], "z");
assert.equal(won.tiers[0].poolMinor, Math.floor(Math.floor(49900 * 0.5) * 0.4) + 1000);

console.log("draw engine: all tests passed");
