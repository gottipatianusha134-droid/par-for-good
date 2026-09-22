import { createAdminClient } from "@/lib/supabase/admin";
import { inr } from "@/lib/format";

export const metadata = { title: "Admin reports" };
export const dynamic = "force-dynamic";

export default async function AdminHome() {
  const db = createAdminClient();
  const [users, active, draws, winners, pay, don, charities] = await Promise.all([
    db.from("profiles").select("id", { count: "exact", head: true }),
    db.from("profiles").select("id", { count: "exact", head: true }).eq("subscription_status", "active"),
    db.from("draws").select("status, pool_base_minor, eligible_count, jackpot_carry_out_minor, draw_month").order("draw_month", { ascending: false }),
    db.from("winners").select("prize_minor, payment_status"),
    db.from("payments").select("charity_id, charity_minor, amount_minor"),
    db.from("donations").select("charity_id, amount_minor"),
    db.from("charities").select("id, name"),
  ]);
  const published = (draws.data ?? []).filter((d) => d.status === "published");
  const poolTotal = published.reduce((s, d) => s + Number(d.pool_base_minor), 0);
  const carry = Number(published[0]?.jackpot_carry_out_minor ?? 0);
  const w = winners.data ?? [];
  const paidOut = w.filter((x) => x.payment_status === "paid").reduce((s, x) => s + Number(x.prize_minor), 0);
  const subCharity = (pay.data ?? []).reduce((s, p) => s + Number(p.charity_minor), 0);
  const donated = (don.data ?? []).reduce((s, d) => s + Number(d.amount_minor), 0);
  const perCharity = (charities.data ?? []).map((c) => ({
    name: c.name,
    total: (pay.data ?? []).filter((p) => p.charity_id === c.id).reduce((s, p) => s + Number(p.charity_minor), 0)
         + (don.data ?? []).filter((d) => d.charity_id === c.id).reduce((s, d) => s + Number(d.amount_minor), 0),
  })).sort((a, b) => b.total - a.total);

  const Stat = ({ label, value }: { label: string; value: string | number }) => (
    <div className="card"><p className="muted" style={{ margin: 0 }}>{label}</p><div className="stat">{value}</div></div>);

  return (
    <div className="stack">
      <h1>Reports</h1>
      <div className="grid three">
        <Stat label="Total users" value={users.count ?? 0} />
        <Stat label="Active subscribers" value={active.count ?? 0} />
        <Stat label="Prize pool distributed (published draws)" value={inr(poolTotal)} />
        <Stat label="Jackpot carried into next draw" value={inr(carry)} />
        <Stat label="Prizes paid out" value={inr(paidOut)} />
        <Stat label="Charity contributions" value={inr(subCharity + donated)} />
      </div>
      <div className="grid two">
        <div className="card"><h3>Draw statistics</h3>
          <p style={{ margin: 0 }}>{published.length} published, {(draws.data ?? []).length - published.length} simulated.<br />
            {w.length} winners in total, {published.length ? (w.length / published.length).toFixed(1) : 0} per draw on average.<br />
            {published.reduce((s, d) => s + d.eligible_count, 0)} total entries.</p></div>
        <div className="card"><h3>Charity totals</h3>
          <p className="hint" style={{ marginTop: 0 }}>Subscription share plus one-off donations: {inr(subCharity)} + {inr(donated)}.</p>
          {perCharity.length === 0 ? <p className="muted">No charities yet.</p> : (
            <table><tbody>{perCharity.map((c) => <tr key={c.name}><td>{c.name}</td><td style={{ textAlign: "right" }}><b>{inr(c.total)}</b></td></tr>)}</tbody></table>)}
        </div>
      </div>
    </div>
  );
}
