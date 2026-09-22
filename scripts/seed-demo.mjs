// Creates the test accounts the PRD asks for. Run AFTER schema.sql + seed.sql:
//   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/seed-demo.mjs
import { createClient } from "@supabase/supabase-js";

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const { data: charity } = await db.from("charities").select("id").eq("slug", "open-classroom").single();

async function makeUser(email, password, full_name, role) {
  let { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name, charity_id: charity.id, charity_percent: 15 } });
  if (error) {
    const { data: list } = await db.auth.admin.listUsers({ perPage: 200 });
    const existing = list.users.find((u) => u.email === email);
    if (!existing) throw error;
    data = { user: existing };
  }
  const periodEnd = new Date(Date.now() + 30 * 864e5).toISOString();
  await db.from("profiles").update({
    role, full_name, plan: "monthly", subscription_status: "active", current_period_end: periodEnd,
  }).eq("id", data.user.id);
  return data.user.id;
}

const adminId = await makeUser("admin@parforgood.test", "Admin#12345", "Site Admin", "admin");
const userId = await makeUser("player@parforgood.test", "Player#12345", "Demo Player", "subscriber");

// Give the demo player five scores so they are draw-eligible.
await db.from("scores").delete().eq("user_id", userId);
const today = Date.now();
const rows = [32, 28, 36, 30, 34].map((score, i) => ({
  user_id: userId, score, played_on: new Date(today - (i + 1) * 5 * 864e5).toISOString().slice(0, 10),
}));
await db.from("scores").insert(rows);

console.log("Admin  → admin@parforgood.test / Admin#12345");
console.log("Player → player@parforgood.test / Player#12345 (active, 5 scores)");
console.log("Ids:", adminId, userId);
