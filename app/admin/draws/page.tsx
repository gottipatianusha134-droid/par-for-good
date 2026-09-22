import { createAdminClient } from "@/lib/supabase/admin";
import Flash from "@/components/Flash";
import { deleteSimulation, publishDraw, savePoolPercent, simulateDraw } from "../actions";
import { fmtMonth, inr } from "@/lib/format";
import { DEFAULT_POOL_PERCENT } from "@/lib/config";
import type { Draw } from "@/lib/types";

export const metadata = { title: "Draws · Admin" };
export const dynamic = "force-dynamic";

export default async function Draws({ searchParams }: { searchParams: { ok?: string; err?: string } }) {
  const db = createAdminClient();
  const [{ data }, { data: setting }] = await Promise.all([
    db.from("draws").select("*").order("draw_month", { ascending: false }),
    db.from("settings").select("value").eq("key", "pool_percent").maybeSingle(),
  ]);
  const draws = (data ?? []) as Draw[];
  const poolPercent = Number(setting?.value ?? DEFAULT_POOL_PERCENT);
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  return (
    <div className="stack">
      <h1>Draws</h1>
      <Flash searchParams={searchParams} />
      <div className="grid two">
        <form action={simulateDraw} className="card">
          <h3>Run a simulation</h3>
          <p className="muted">Nothing is visible to players until you publish.</p>
          <div className="field"><label htmlFor="month">Draw month</label><input id="month" name="month" type="month" defaultValue={defaultMonth} required /></div>
          <div className="field"><label htmlFor="mode">Draw logic</label>
            <select id="mode" name="mode"><option value="random">Random (standard lottery-style)</option><option value="algorithmic">Algorithmic (weighted by score frequency)</option></select></div>
          <button className="btn btn-dark">Simulate draw</button>
        </form>
        <form action={savePoolPercent} className="card">
          <h3>Prize pool share</h3>
          <p className="muted">Share of every subscription that funds prizes. Split 40% / 35% / 25% across 5, 4 and 3 matches.</p>
          <div className="field"><label htmlFor="pool_percent">Percent</label><input id="pool_percent" name="pool_percent" type="number" min={10} max={80} defaultValue={poolPercent} /></div>
          <button className="btn">Save</button>
        </form>
      </div>

      {draws.length === 0 && <div className="card flat"><p style={{ margin: 0 }}>No draws yet. Run your first simulation above.</p></div>}
      {draws.map((d) => (
        <div className="card" key={d.id}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <h3 style={{ margin: 0 }}>{fmtMonth(d.draw_month)}</h3>
            <span><span className="badge">{d.mode}</span> <span className={`badge ${d.status === "published" ? "ok" : "warn"}`}>{d.status}</span></span>
          </div>
          <div className="balls" style={{ margin: "14px 0" }}>{d.numbers.map((n) => <span className="ball" key={n}>{n}</span>)}</div>
          <p className="muted">{d.subscriber_count} active subscribers, {d.eligible_count} eligible entries. Pool {inr(d.pool_base_minor)}{d.carry_in_minor > 0 && <> plus {inr(d.carry_in_minor)} rolled over</>}.</p>
          <div className="table-wrap"><table>
            <thead><tr><th>Match</th><th>Tier pool</th><th>Winners</th><th>Each</th></tr></thead>
            <tbody>{(d.result?.tiers ?? []).map((t: any) => (
              <tr key={t.tier}><td>{t.tier} numbers</td><td>{inr(t.poolMinor)}</td><td>{t.winnerCount}</td><td>{t.winnerCount ? inr(t.perWinnerMinor) : t.tier === 5 ? "Rolls over" : "Unclaimed"}</td></tr>))}</tbody>
          </table></div>
          {d.status === "simulated" ? (
            <div className="row" style={{ marginTop: 16 }}>
              <form action={publishDraw}><input type="hidden" name="id" value={d.id} /><button className="btn btn-primary">Publish results</button></form>
              <form action={deleteSimulation}><input type="hidden" name="id" value={d.id} /><button className="btn btn-danger">Discard</button></form>
            </div>
          ) : d.jackpot_carry_out_minor > 0 && <p style={{ marginTop: 14 }}><b>{inr(d.jackpot_carry_out_minor)}</b> jackpot carried into the next draw.</p>}
        </div>
      ))}
    </div>
  );
}
