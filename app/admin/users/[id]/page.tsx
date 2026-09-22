import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import Flash from "@/components/Flash";
import { adminAddScore, adminDeleteScore, adminUpdateScore, updateUser } from "../../actions";
import { fmtDate, todayISO } from "@/lib/format";
import type { Charity, Profile, Score } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function UserDetail({ params, searchParams }: { params: { id: string }; searchParams: { ok?: string; err?: string } }) {
  const db = createAdminClient();
  const { data: p } = await db.from("profiles").select("*").eq("id", params.id).maybeSingle();
  if (!p) notFound();
  const u = p as Profile;
  const [{ data: sc }, { data: ch }] = await Promise.all([
    db.from("scores").select("*").eq("user_id", u.id).order("played_on", { ascending: false }),
    db.from("charities").select("id, name").order("name"),
  ]);
  const scores = (sc ?? []) as Score[];
  const charities = (ch ?? []) as Pick<Charity, "id" | "name">[];

  return (
    <div className="stack">
      <h1>{u.full_name || u.email}</h1>
      <Flash searchParams={searchParams} />
      <form action={updateUser} className="card">
        <input type="hidden" name="id" value={u.id} />
        <div className="grid two">
          <div className="field"><label htmlFor="full_name">Name</label><input id="full_name" name="full_name" defaultValue={u.full_name} /></div>
          <div className="field"><label>Email</label><input value={u.email ?? ""} disabled /></div>
          <div className="field"><label htmlFor="role">Role</label><select id="role" name="role" defaultValue={u.role}><option value="subscriber">Subscriber</option><option value="admin">Administrator</option></select></div>
          <div className="field"><label htmlFor="plan">Plan</label><select id="plan" name="plan" defaultValue={u.plan ?? ""}><option value="">None</option><option value="monthly">Monthly</option><option value="yearly">Yearly</option></select></div>
          <div className="field"><label htmlFor="subscription_status">Subscription status</label>
            <select id="subscription_status" name="subscription_status" defaultValue={u.subscription_status}>
              {["none", "active", "past_due", "canceled", "lapsed"].map((s) => <option key={s}>{s}</option>)}</select></div>
          <div className="field"><label htmlFor="current_period_end">Paid until</label><input id="current_period_end" name="current_period_end" type="date" defaultValue={u.current_period_end?.slice(0, 10) ?? ""} /></div>
          <div className="field"><label htmlFor="charity_id">Charity</label><select id="charity_id" name="charity_id" defaultValue={u.charity_id ?? ""}><option value="">None</option>{charities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
          <div className="field"><label htmlFor="charity_percent">Charity share (%)</label><input id="charity_percent" name="charity_percent" type="number" min={10} max={50} defaultValue={u.charity_percent} /></div>
        </div>
        <p className="hint">Manual subscription changes here override Stripe until the next Stripe event for this customer.</p>
        <button className="btn btn-dark">Save user</button>
      </form>

      <div className="card">
        <h3>Golf scores</h3>
        <form action={adminAddScore} className="row" style={{ marginBottom: 16 }}>
          <input type="hidden" name="user_id" value={u.id} />
          <div><label htmlFor="played_on">Date</label><input id="played_on" name="played_on" type="date" max={todayISO()} required /></div>
          <div><label htmlFor="score">Score</label><input id="score" name="score" type="number" min={1} max={45} required /></div>
          <button className="btn btn-dark">Add score</button>
        </form>
        {scores.length === 0 ? <p className="muted">This user has no scores.</p> : (
          <div className="table-wrap"><table><thead><tr><th>Date</th><th>Score</th><th></th></tr></thead><tbody>
            {scores.map((s) => (
              <tr key={s.id}><td>{fmtDate(s.played_on)}</td><td><b>{s.score}</b></td><td>
                <details className="edit"><summary>Edit</summary>
                  <form action={adminUpdateScore} className="row"><input type="hidden" name="id" value={s.id} /><input type="hidden" name="user_id" value={u.id} />
                    <div><input name="played_on" type="date" max={todayISO()} defaultValue={s.played_on} aria-label="Date" required /></div>
                    <div><input name="score" type="number" min={1} max={45} defaultValue={s.score} aria-label="Score" required /></div>
                    <button className="btn btn-sm btn-dark">Save</button></form>
                  <form action={adminDeleteScore} style={{ marginTop: 8 }}><input type="hidden" name="id" value={s.id} /><input type="hidden" name="user_id" value={u.id} /><button className="btn btn-sm btn-danger">Delete</button></form>
                </details></td></tr>))}
          </tbody></table></div>)}
      </div>
    </div>
  );
}
