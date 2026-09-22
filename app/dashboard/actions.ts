"use server";
import { revalidatePath } from "next/cache";
import { requireSubscriber, requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { back } from "@/lib/flash";
import { SCORE_MAX, SCORE_MIN } from "@/lib/draw";
import { MAX_CHARITY_PERCENT, MIN_CHARITY_PERCENT } from "@/lib/config";
import { todayISO } from "@/lib/format";

const D = "/dashboard";

function parse(formData: FormData) {
  const score = Number(formData.get("score"));
  const played_on = String(formData.get("played_on") ?? "");
  if (!Number.isInteger(score) || score < SCORE_MIN || score > SCORE_MAX)
    back(D, "err", `A Stableford score must be a whole number from ${SCORE_MIN} to ${SCORE_MAX}.`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(played_on)) back(D, "err", "Choose the date you played.");
  if (played_on > todayISO()) back(D, "err", "The date can't be in the future.");
  return { score, played_on };
}

export async function addScore(formData: FormData) {
  const { user } = await requireSubscriber();
  const { score, played_on } = parse(formData);
  const supabase = createClient();

  const { data: current } = await supabase.from("scores").select("played_on")
    .eq("user_id", user.id).order("played_on", { ascending: false });
  const rows = current ?? [];
  if (rows.some((r) => r.played_on === played_on))
    back(D, "err", "You already have a score for that date. Edit or delete it instead.");
  // Rolling window keeps the newest five; a round older than all five would be dropped instantly.
  if (rows.length >= 5 && played_on < rows[rows.length - 1].played_on)
    back(D, "err", "That round is older than your five most recent. Edit an existing entry instead.");

  const { error } = await supabase.from("scores").insert({ user_id: user.id, score, played_on });
  if (error) back(D, "err", error.code === "23505" ? "You already have a score for that date." : "Couldn't save that score. Try again.");
  revalidatePath(D);
  back(D, "ok", rows.length >= 5 ? "Score added. Your oldest round was replaced." : "Score added.");
}

export async function updateScore(formData: FormData) {
  const { user } = await requireSubscriber();
  const id = String(formData.get("id"));
  const { score, played_on } = parse(formData);
  const { error } = await createClient().from("scores").update({ score, played_on }).eq("id", id).eq("user_id", user.id);
  if (error) back(D, "err", error.code === "23505" ? "You already have a score for that date." : "Couldn't update that score.");
  revalidatePath(D);
  back(D, "ok", "Score updated.");
}

export async function deleteScore(formData: FormData) {
  const { user } = await requireSubscriber();
  await createClient().from("scores").delete().eq("id", String(formData.get("id"))).eq("user_id", user.id);
  revalidatePath(D);
  back(D, "ok", "Score deleted.");
}

/** Profile writes go through the service role (RLS gives users no UPDATE on profiles). */
export async function updateCharity(formData: FormData) {
  const { user } = await requireUser();
  const charity_id = String(formData.get("charity_id") ?? "");
  const pct = Math.floor(Number(formData.get("charity_percent")));
  if (!charity_id) back(D, "err", "Choose a charity.");
  if (!(pct >= MIN_CHARITY_PERCENT && pct <= MAX_CHARITY_PERCENT))
    back(D, "err", `Your contribution must be between ${MIN_CHARITY_PERCENT}% and ${MAX_CHARITY_PERCENT}%.`);
  await createAdminClient().from("profiles").update({ charity_id, charity_percent: pct }).eq("id", user.id);
  revalidatePath(D);
  back(D, "ok", "Charity settings saved.");
}

export async function uploadProof(formData: FormData) {
  const { user } = await requireUser();
  const winnerId = String(formData.get("winner_id"));
  const file = formData.get("proof") as File | null;
  if (!file || file.size === 0) back(D, "err", "Choose a screenshot to upload.");
  if (!file!.type.startsWith("image/")) back(D, "err", "Proof must be an image (PNG or JPG).");
  if (file!.size > 5 * 1024 * 1024) back(D, "err", "That image is over 5 MB. Upload a smaller one.");

  const db = createAdminClient();
  const { data: w } = await db.from("winners").select("id, user_id, verification_status").eq("id", winnerId).maybeSingle();
  if (!w || w.user_id !== user.id) back(D, "err", "That win doesn't belong to your account.");
  if (!["awaiting_proof", "rejected"].includes(w!.verification_status)) back(D, "err", "This win has already been submitted.");

  const ext = (file!.name.split(".").pop() ?? "png").toLowerCase().replace(/[^a-z0-9]/g, "");
  const path = `${user.id}/${winnerId}-${Date.now()}.${ext}`;
  const { error } = await db.storage.from("proofs").upload(path, await file!.arrayBuffer(), { contentType: file!.type });
  if (error) back(D, "err", "Upload failed. Try again.");
  await db.from("winners").update({ proof_path: path, verification_status: "pending_review", admin_note: null }).eq("id", winnerId);
  revalidatePath(D);
  back(D, "ok", "Proof submitted. We'll review it shortly.");
}
