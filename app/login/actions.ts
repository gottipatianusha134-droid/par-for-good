"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { back } from "@/lib/flash";

export async function login(formData: FormData) {
  const supabase = createClient();
  const next = String(formData.get("next") || "/dashboard");
  const { error } = await supabase.auth.signInWithPassword({
    email: String(formData.get("email") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
  });
  if (error) back("/login", "err", "Email or password is incorrect.");
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard");
}

export async function signup(formData: FormData) {
  const supabase = createClient();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const plan = formData.get("plan") === "yearly" ? "yearly" : "monthly";
  const pct = Math.max(10, Math.min(50, Number(formData.get("charity_percent")) || 10));
  if (password.length < 8) back("/signup", "err", "Use a password of at least 8 characters.");

  const { data, error } = await supabase.auth.signUp({
    email, password,
    options: { data: {
      full_name: String(formData.get("full_name") ?? "").trim(),
      charity_id: String(formData.get("charity_id") ?? ""),
      charity_percent: pct,
    } },
  });
  if (error) back("/signup", "err", error.message);
  if (data.session) redirect(`/subscribe?plan=${plan}`);
  back("/login", "ok", "Almost there. Confirm your email, then log in to start your subscription.");
}
