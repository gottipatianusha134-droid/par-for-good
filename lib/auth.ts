import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

export async function getUserAndProfile() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, profile: null as Profile | null };
  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  return { user, profile: (data as Profile | null) };
}

/**
 * Real-time subscription check, evaluated on every authenticated request:
 * status must be active AND the paid period must not have ended.
 */
export function hasActiveSubscription(p: Profile | null) {
  if (!p || p.subscription_status !== "active") return false;
  return !p.current_period_end || new Date(p.current_period_end) > new Date();
}

export async function requireUser() {
  const { user, profile } = await getUserAndProfile();
  if (!user || !profile) redirect("/login");
  return { user, profile: profile as Profile };
}

export async function requireSubscriber() {
  const ctx = await requireUser();
  if (!hasActiveSubscription(ctx.profile)) redirect("/subscribe");
  return ctx;
}

export async function requireAdmin() {
  const ctx = await requireUser();
  if (ctx.profile.role !== "admin") redirect("/dashboard");
  return ctx;
}
