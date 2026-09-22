import type { SupabaseClient } from "@supabase/supabase-js";
import {
  computePool, generateNumbers, resolveDraw,
  type DrawMode, type Plan,
} from "@/lib/draw";
import { DEFAULT_POOL_PERCENT, PRICES } from "@/lib/config";

/**
 * Loads live data and runs the draw engine. Used for BOTH simulation and
 * publish so the two can never disagree on the rules.
 * Pass `fixedNumbers` on publish to reuse the numbers the admin approved.
 */
export async function computeDraw(
  db: SupabaseClient,
  mode: DrawMode,
  drawMonth: string,
  fixedNumbers?: number[]
) {
  const nowIso = new Date().toISOString();
  const { data: subs } = await db
    .from("profiles")
    .select("id, plan")
    .eq("subscription_status", "active")
    .or(`current_period_end.is.null,current_period_end.gt.${nowIso}`);
  const active = (subs ?? []) as { id: string; plan: Plan | null }[];

  const ids = active.map((s) => s.id);
  const { data: scoreRows } = ids.length
    ? await db.from("scores").select("user_id, score").in("user_id", ids)
    : { data: [] as { user_id: string; score: number }[] };

  const byUser = new Map<string, number[]>();
  for (const r of scoreRows ?? []) byUser.set(r.user_id, [...(byUser.get(r.user_id) ?? []), r.score]);
  // Only subscribers holding a full set of 5 scores are entered.
  const entries = Array.from(byUser.entries())
    .filter(([, s]) => s.length === 5)
    .map(([userId, scores]) => ({ userId, scores }));

  const { data: setting } = await db.from("settings").select("value").eq("key", "pool_percent").maybeSingle();
  const poolPercent = Number(setting?.value ?? DEFAULT_POOL_PERCENT);

  const { data: prev } = await db
    .from("draws").select("jackpot_carry_out_minor")
    .eq("status", "published").lt("draw_month", drawMonth)
    .order("draw_month", { ascending: false }).limit(1).maybeSingle();
  const carryInMinor = Number(prev?.jackpot_carry_out_minor ?? 0);

  const pool = computePool({
    plans: active.map((s) => (s.plan ?? "monthly") as Plan),
    poolPercent, prices: PRICES, carryInMinor,
  });

  const numbers = fixedNumbers ?? generateNumbers(mode, (scoreRows ?? []).map((r) => r.score));
  const resolved = resolveDraw(entries, numbers, pool.tierPools);

  return {
    numbers, pool, resolved,
    subscriberCount: active.length,
    eligibleCount: entries.length,
    summary: {
      revenueMinor: pool.revenueMinor, poolPercent,
      tiers: resolved.tiers.map((t) => ({
        tier: t.tier, poolMinor: t.poolMinor, winnerCount: t.winners.length, perWinnerMinor: t.perWinnerMinor,
      })),
    },
  };
}
