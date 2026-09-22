"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { back } from "@/lib/flash";
import { computeDraw } from "@/lib/draw-service";
import type { DrawMode } from "@/lib/draw";
import type { CharityEvent } from "@/lib/types";

/* ---------------------------- users ---------------------------- */
export async function updateUser(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  const path = `/admin/users/${id}`;
  const periodEnd = String(formData.get("current_period_end") ?? "");
  const plan = String(formData.get("plan") ?? "");
  const { error } = await createAdminClient().from("profiles").update({
    full_name: String(formData.get("full_name") ?? "").trim(),
    role: formData.get("role") === "admin" ? "admin" : "subscriber",
    charity_id: String(formData.get("charity_id") ?? "") || null,
    charity_percent: Math.max(10, Math.min(50, Number(formData.get("charity_percent")) || 10)),
    plan: plan === "monthly" || plan === "yearly" ? plan : null,
    subscription_status: String(formData.get("subscription_status")),
    current_period_end: periodEnd ? new Date(periodEnd).toISOString() : null,
  }).eq("id", id);
  if (error) back(path, "err", error.message);
  revalidatePath(path);
  back(path, "ok", "User updated.");
}

export async function adminAddScore(formData: FormData) {
  await requireAdmin();
  const userId = String(formData.get("user_id"));
  const path = `/admin/users/${userId}`;
  const score = Number(formData.get("score"));
  if (!Number.isInteger(score) || score < 1 || score > 45) back(path, "err", "Score must be a whole number from 1 to 45.");
  const { error } = await createAdminClient().from("scores").insert({ user_id: userId, score, played_on: String(formData.get("played_on")) });
  if (error) back(path, "err", error.code === "23505" ? "That user already has a score for that date." : error.message);
  back(path, "ok", "Score added.");
}

export async function adminUpdateScore(formData: FormData) {
  await requireAdmin();
  const userId = String(formData.get("user_id"));
  const path = `/admin/users/${userId}`;
  const score = Number(formData.get("score"));
  if (!Number.isInteger(score) || score < 1 || score > 45) back(path, "err", "Score must be a whole number from 1 to 45.");
  const { error } = await createAdminClient().from("scores")
    .update({ score, played_on: String(formData.get("played_on")) }).eq("id", String(formData.get("id")));
  if (error) back(path, "err", error.code === "23505" ? "That user already has a score for that date." : error.message);
  back(path, "ok", "Score updated.");
}

export async function adminDeleteScore(formData: FormData) {
  await requireAdmin();
  const userId = String(formData.get("user_id"));
  await createAdminClient().from("scores").delete().eq("id", String(formData.get("id")));
  back(`/admin/users/${userId}`, "ok", "Score deleted.");
}

/* ---------------------------- draws ---------------------------- */
const DRAWS = "/admin/draws";

export async function savePoolPercent(formData: FormData) {
  await requireAdmin();
  const v = Math.floor(Number(formData.get("pool_percent")));
  if (!(v >= 10 && v <= 80)) back(DRAWS, "err", "Prize pool share must be between 10% and 80%.");
  await createAdminClient().from("settings").upsert({ key: "pool_percent", value: v });
  back(DRAWS, "ok", `Prize pool share set to ${v}%.`);
}

export async function simulateDraw(formData: FormData) {
  await requireAdmin();
  const month = String(formData.get("month") ?? "");           // YYYY-MM
  if (!/^\d{4}-\d{2}$/.test(month)) back(DRAWS, "err", "Choose a draw month.");
  const drawMonth = `${month}-01`;
  const mode: DrawMode = formData.get("mode") === "algorithmic" ? "algorithmic" : "random";
  const db = createAdminClient();

  const { data: existing } = await db.from("draws").select("id, status").eq("draw_month", drawMonth).maybeSingle();
  if (existing?.status === "published") back(DRAWS, "err", "That month's draw is already published and can't be re-run.");

  const calc = await computeDraw(db, mode, drawMonth);
  const { error } = await db.from("draws").upsert({
    draw_month: drawMonth, mode, status: "simulated", numbers: calc.numbers,
    subscriber_count: calc.subscriberCount, eligible_count: calc.eligibleCount,
    pool_base_minor: calc.pool.baseMinor, carry_in_minor: calc.pool.carryInMinor,
    tier_pools: calc.pool.tierPools, result: calc.summary,
  }, { onConflict: "draw_month" });
  if (error) back(DRAWS, "err", error.message);
  back(DRAWS, "ok", "Simulation ready. Review it below, then publish or run it again.");
}

export async function publishDraw(formData: FormData) {
  await requireAdmin();
  const db = createAdminClient();
  const { data: draw } = await db.from("draws").select("*").eq("id", String(formData.get("id"))).maybeSingle();
  if (!draw) back(DRAWS, "err", "Draw not found.");
  if (draw!.status === "published") back(DRAWS, "err", "This draw is already published.");

  // Re-evaluate against live data, but keep the exact numbers the admin approved.
  const calc = await computeDraw(db, draw!.mode, draw!.draw_month, draw!.numbers);

  await db.from("draw_entries").delete().eq("draw_id", draw!.id);
  if (calc.resolved.entries.length) {
    const { error } = await db.from("draw_entries").insert(
      calc.resolved.entries.map((e) => ({ draw_id: draw!.id, user_id: e.userId, scores: e.scores, matches: e.matches })));
    if (error) back(DRAWS, "err", error.message);
  }
  const winnerRows = calc.resolved.tiers.flatMap((t) =>
    t.winners.map((userId) => ({ draw_id: draw!.id, user_id: userId, tier: t.tier, prize_minor: t.perWinnerMinor })));
  if (winnerRows.length) {
    const { error } = await db.from("winners").upsert(winnerRows, { onConflict: "draw_id,user_id" });
    if (error) back(DRAWS, "err", error.message);
  }
  await db.from("draws").update({
    status: "published", published_at: new Date().toISOString(),
    subscriber_count: calc.subscriberCount, eligible_count: calc.eligibleCount,
    pool_base_minor: calc.pool.baseMinor, carry_in_minor: calc.pool.carryInMinor,
    tier_pools: calc.pool.tierPools, result: calc.summary,
    jackpot_carry_out_minor: calc.resolved.carryOutMinor,
  }).eq("id", draw!.id);
  back(DRAWS, "ok", `Published. ${winnerRows.length} winner${winnerRows.length === 1 ? "" : "s"} created.`);
}

export async function deleteSimulation(formData: FormData) {
  await requireAdmin();
  await createAdminClient().from("draws").delete().eq("id", String(formData.get("id"))).eq("status", "simulated");
  back(DRAWS, "ok", "Simulation deleted.");
}

/* -------------------------- charities -------------------------- */
const CH = "/admin/charities";

function parseEvents(raw: string): CharityEvent[] {
  return raw.split("\n").map((l) => l.trim()).filter(Boolean).map((line) => {
    const [date, title, location] = line.split("|").map((s) => s.trim());
    return { date, title, location };
  }).filter((e) => /^\d{4}-\d{2}-\d{2}$/.test(e.date) && e.title);
}
const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export async function saveCharity(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) back(CH, "err", "A charity needs a name.");
  const row = {
    name, category: String(formData.get("category") ?? "Community").trim() || "Community",
    description: String(formData.get("description") ?? "").trim(),
    image_url: String(formData.get("image_url") ?? "").trim() || null,
    featured: formData.get("featured") === "on",
    events: parseEvents(String(formData.get("events") ?? "")),
  };
  const db = createAdminClient();
  if (row.featured) await db.from("charities").update({ featured: false }).neq("id", id || "00000000-0000-0000-0000-000000000000");
  const { error } = id
    ? await db.from("charities").update(row).eq("id", id)
    : await db.from("charities").insert({ ...row, slug: slugify(name) });
  if (error) back(CH, "err", error.code === "23505" ? "A charity with that name already exists." : error.message);
  revalidatePath("/charities"); revalidatePath("/");
  back(CH, "ok", id ? "Charity updated." : "Charity added.");
}

export async function deleteCharity(formData: FormData) {
  await requireAdmin();
  await createAdminClient().from("charities").delete().eq("id", String(formData.get("id")));
  revalidatePath("/charities"); revalidatePath("/");
  back(CH, "ok", "Charity deleted.");
}

/* --------------------------- winners --------------------------- */
const WN = "/admin/winners";

export async function reviewWinner(formData: FormData) {
  await requireAdmin();
  const approve = formData.get("decision") === "approve";
  const note = String(formData.get("note") ?? "").trim();
  if (!approve && !note) back(WN, "err", "Add a short reason so the winner knows what to fix.");
  await createAdminClient().from("winners").update({
    verification_status: approve ? "approved" : "rejected", admin_note: approve ? null : note,
  }).eq("id", String(formData.get("id")));
  back(WN, "ok", approve ? "Submission approved." : "Submission rejected.");
}

export async function markPaid(formData: FormData) {
  await requireAdmin();
  const db = createAdminClient();
  const id = String(formData.get("id"));
  const { data: w } = await db.from("winners").select("verification_status").eq("id", id).maybeSingle();
  if (w?.verification_status !== "approved") back(WN, "err", "Approve the proof before marking a payout as paid.");
  await db.from("winners").update({ payment_status: "paid", paid_at: new Date().toISOString() }).eq("id", id);
  back(WN, "ok", "Payout marked as paid.");
}
