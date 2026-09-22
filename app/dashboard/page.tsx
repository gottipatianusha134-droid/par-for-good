import Link from "next/link";
import { requireUser, hasActiveSubscription } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import Flash from "@/components/Flash";
import { addScore, deleteScore, updateCharity, updateScore, uploadProof } from "./actions";
import { openBillingPortal } from "@/app/subscribe/actions";
import { fmtDate, fmtMonth, inr, todayISO } from "@/lib/format";
import { MAX_CHARITY_PERCENT, MIN_CHARITY_PERCENT } from "@/lib/config";
import type { Charity, Draw, Score } from "@/lib/types";

export const metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

const VERIFY_LABEL: Record<string, [string, string]> = {
  awaiting_proof: ["Upload proof", "warn"], pending_review: ["In review", "warn"], approved: ["Verified", "ok"], rejected: ["Rejected", "err"],
};

export default async function Dashboard({ searchParams }: { searchParams: { ok?: string; err?: string } }) {
  const { user, profile } = await requireUser();
  const supabase = createClient();
  const active = hasActiveSubscription(profile);

  const [{ data: scoreRows }, { data: charityRows }, { data: entries }, { data: drawRows }, { data: winRows }] = await Promise.all([
    supabase.from("scores").select("*").eq("user_id", user.id).order("played_on", { ascending: false }),
    supabase.from("charities").select("id, name").order("name"),
    supabase.from("draw_entries").select("draw_id, matches").eq("user_id", user.id),
    supabase.from("draws").select("*").eq("status", "published").order("draw_month", { ascending: false }),
    supabase.from("winners").select("*, draws(draw_month)").eq("user_id", user.id).order("created_at", { ascending: false }),
  ]);
  const scores = (scoreRows ?? []) as Score[];
  const charities = (charityRows ?? []) as Pick<Charity, "id" | "name">[];
  const draws = (drawRows ?? []) as Draw[];
  const wins = (winRows ?? []) as any[];
  const myCharity = charities.find((c) => c.id === profile.charity_id);

  const now = new Date();
  const thisMonth = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
  const drawnThisMonth = draws.some((d) => d.draw_month === thisMonth.toISOString().slice(0, 10));
  const upcoming = drawnThisMonth ? new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 1)) : thisMonth;
  const latest = draws[0];
  const totalWon = wins.reduce((s, w) => s + Number(w.prize_minor), 0);
  const paid = wins.filter((w) => w.payment_status === "paid").reduce((s, w) => s + Number(w.prize_minor), 0);

  const statusBadge = active ? <span className="badge ok">Active</span> : <span className="badge err">Inactive</span>;

  return (
    <div className="page"><div className="container">
      <h1>Hello, {profile.full_name || "there"}</h1>
      <Flash searchParams={searchParams} />

      <div className="grid three" style={{ margin: "24px 0" }}>
        <div className="card">
          <p className="muted" style={{ margin: 0 }}>Subscription</p>
          <div className="stat">{statusBadge}</div>
          <p style={{ margin: "10px 0" }}>
            {active ? <>{profile.plan === "yearly" ? "Yearly" : "Monthly"} plan. {profile.cancel_at_period_end ? "Ends" : "Renews"} on <b>{fmtDate(profile.current_period_end)}</b>.</> : "Scores and draws are paused until you subscribe."}
          </p>
          {active
            ? <form action={openBillingPortal}><button className="btn btn-sm">Manage billing</button></form>
            : <Link href="/subscribe" className="btn btn-primary btn-sm">Subscribe</Link>}
        </div>
        <div className="card">
          <p className="muted" style={{ margin: 0 }}>Participation</p>
          <div className="stat">{entries?.length ?? 0} draw{(entries?.length ?? 0) === 1 ? "" : "s"} entered</div>
          <p style={{ margin: "10px 0 0" }}>Next draw: <b>{fmtMonth(upcoming)}</b>.<br />{active ? (scores.length === 5 ? "You're entered with five scores." : `Add ${5 - scores.length} more score${5 - scores.length === 1 ? "" : "s"} to be entered.`) : "Subscribe to enter."}</p>
        </div>
        <div className="card">
          <p className="muted" style={{ margin: 0 }}>Winnings</p>
          <div className="stat">{inr(totalWon)}</div>
          <p style={{ margin: "10px 0 0" }}>{wins.length === 0 ? "No wins yet. Your next draw could be the one." : <>{inr(paid)} paid, {inr(totalWon - paid)} pending.</>}</p>
        </div>
      </div>

      {latest && (
        <div className="card flat" style={{ marginBottom: 24 }}>
          <h3>Latest draw: {fmtMonth(latest.draw_month)}</h3>
          <div className="balls">{latest.numbers.map((n) => <span key={n} className={`ball ${scores.some((s) => s.score === n) ? "hit" : ""}`}>{n}</span>)}</div>
          <p className="hint">Highlighted numbers match one of your current scores.</p>
        </div>
      )}

      <div className="grid two" style={{ alignItems: "start" }}>
        <section className={`card ${active ? "" : "locked"}`} aria-labelledby="scores-h">
          <h2 id="scores-h" style={{ fontSize: "1.6rem" }}>Your last five scores</h2>
          <p className="muted">Stableford points, 1 to 45. One score per date. A new round replaces your oldest.</p>
          <form action={addScore} className="row" style={{ marginBottom: 18 }}>
            <div><label htmlFor="played_on">Date played</label><input id="played_on" name="played_on" type="date" max={todayISO()} required /></div>
            <div><label htmlFor="score">Score</label><input id="score" name="score" type="number" min={1} max={45} required /></div>
            <button className="btn btn-dark" type="submit">Add score</button>
          </form>
          {scores.length === 0 ? <p className="flash ok" style={{ background: "var(--sea)", borderColor: "transparent", color: "var(--tide)" }}>No scores yet. Add your first round above.</p> : (
            <div className="table-wrap"><table>
              <thead><tr><th>Date</th><th>Score</th><th></th></tr></thead>
              <tbody>{scores.map((s) => (
                <tr key={s.id}>
                  <td>{fmtDate(s.played_on)}</td><td><b>{s.score}</b></td>
                  <td>
                    <details className="edit"><summary>Edit</summary>
                      <form action={updateScore} className="row">
                        <input type="hidden" name="id" value={s.id} />
                        <div><label className="sr" htmlFor={`d${s.id}`}>Date</label><input id={`d${s.id}`} name="played_on" type="date" max={todayISO()} defaultValue={s.played_on} required /></div>
                        <div><label className="sr" htmlFor={`s${s.id}`}>Score</label><input id={`s${s.id}`} name="score" type="number" min={1} max={45} defaultValue={s.score} required /></div>
                        <button className="btn btn-sm btn-dark">Save</button>
                      </form>
                      <form action={deleteScore} style={{ marginTop: 8 }}><input type="hidden" name="id" value={s.id} /><button className="btn btn-sm btn-danger">Delete</button></form>
                    </details>
                  </td>
                </tr>))}</tbody>
            </table></div>
          )}
        </section>

        <section className="card" id="charity" aria-labelledby="charity-h">
          <h2 id="charity-h" style={{ fontSize: "1.6rem" }}>Your charity</h2>
          <p className="muted">{myCharity ? <>Currently supporting <b>{myCharity.name}</b> with {profile.charity_percent}% of your fee.</> : "You haven't chosen a charity yet."}</p>
          <form action={updateCharity}>
            <div className="field"><label htmlFor="charity_id">Charity</label>
              <select id="charity_id" name="charity_id" defaultValue={profile.charity_id ?? ""} required>
                <option value="" disabled>Choose a charity</option>{charities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select></div>
            <div className="field"><label htmlFor="charity_percent">Share of your fee (%)</label>
              <input id="charity_percent" name="charity_percent" type="number" min={MIN_CHARITY_PERCENT} max={MAX_CHARITY_PERCENT} defaultValue={profile.charity_percent} required />
              <p className="hint">Between {MIN_CHARITY_PERCENT}% and {MAX_CHARITY_PERCENT}%.</p></div>
            <button className="btn btn-dark" type="submit">Save charity settings</button>
          </form>
        </section>
      </div>

      <section style={{ marginTop: 32 }} aria-labelledby="wins-h">
        <h2 id="wins-h" style={{ fontSize: "1.6rem" }}>Winnings</h2>
        {wins.length === 0 ? <div className="card flat"><p style={{ margin: 0 }}>When you win, your prize and its payment status appear here. You'll be asked for a screenshot of your scores to verify it.</p></div> : (
          <div className="table-wrap"><table>
            <thead><tr><th>Draw</th><th>Match</th><th>Prize</th><th>Verification</th><th>Payment</th></tr></thead>
            <tbody>{wins.map((w) => {
              const [label, tone] = VERIFY_LABEL[w.verification_status];
              return (
                <tr key={w.id}>
                  <td>{w.draws ? fmtMonth(w.draws.draw_month) : "—"}</td><td>{w.tier} numbers</td><td><b>{inr(w.prize_minor)}</b></td>
                  <td><span className={`badge ${tone}`}>{label}</span>
                    {w.verification_status === "rejected" && w.admin_note && <div className="hint">Reason: {w.admin_note}</div>}
                    {["awaiting_proof", "rejected"].includes(w.verification_status) && (
                      <form action={uploadProof} className="row" style={{ marginTop: 8 }}>
                        <input type="hidden" name="winner_id" value={w.id} />
                        <div><label className="sr" htmlFor={`p${w.id}`}>Screenshot</label><input id={`p${w.id}`} type="file" name="proof" accept="image/*" required /></div>
                        <button className="btn btn-sm btn-dark">Submit proof</button>
                      </form>)}
                  </td>
                  <td><span className={`badge ${w.payment_status === "paid" ? "ok" : "warn"}`}>{w.payment_status === "paid" ? "Paid" : "Pending"}</span></td>
                </tr>);
            })}</tbody>
          </table></div>
        )}
      </section>
    </div></div>
  );
}
