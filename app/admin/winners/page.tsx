import { createAdminClient } from "@/lib/supabase/admin";
import Flash from "@/components/Flash";
import { markPaid, reviewWinner } from "../actions";
import { fmtMonth, inr } from "@/lib/format";

export const metadata = { title: "Winners · Admin" };
export const dynamic = "force-dynamic";

const VERIFY: Record<string, [string, string]> = {
  awaiting_proof: ["Awaiting proof", ""], pending_review: ["Needs review", "warn"], approved: ["Approved", "ok"], rejected: ["Rejected", "err"],
};

export default async function AdminWinners({ searchParams }: { searchParams: { ok?: string; err?: string } }) {
  const db = createAdminClient();
  const { data } = await db.from("winners")
    .select("*, profiles(full_name, email), draws(draw_month)").order("created_at", { ascending: false });
  const winners = (data ?? []) as any[];
  // Signed links so admins can view private screenshots for one hour.
  const proofUrl = new Map<string, string>();
  await Promise.all(winners.filter((w) => w.proof_path).map(async (w) => {
    const { data: s } = await db.storage.from("proofs").createSignedUrl(w.proof_path, 3600);
    if (s?.signedUrl) proofUrl.set(w.id, s.signedUrl);
  }));

  return (
    <div className="stack">
      <h1>Winners</h1>
      <Flash searchParams={searchParams} />
      {winners.length === 0 ? <div className="card flat"><p style={{ margin: 0 }}>No winners yet. They appear here after a draw is published.</p></div> : (
        <div className="table-wrap"><table>
          <thead><tr><th>Winner</th><th>Draw</th><th>Prize</th><th>Proof</th><th>Payout</th></tr></thead>
          <tbody>{winners.map((w) => {
            const [label, tone] = VERIFY[w.verification_status];
            return (
              <tr key={w.id}>
                <td><b>{w.profiles?.full_name || "—"}</b><br /><span className="muted">{w.profiles?.email}</span></td>
                <td>{w.draws ? fmtMonth(w.draws.draw_month) : "—"}<br /><span className="muted">{w.tier} numbers</span></td>
                <td><b>{inr(w.prize_minor)}</b></td>
                <td>
                  <span className={`badge ${tone}`}>{label}</span>
                  {proofUrl.get(w.id) && <div style={{ marginTop: 6 }}><a href={proofUrl.get(w.id)} target="_blank" rel="noreferrer">View screenshot</a></div>}
                  {w.verification_status === "pending_review" && (
                    <form action={reviewWinner} style={{ marginTop: 8 }}>
                      <input type="hidden" name="id" value={w.id} />
                      <input name="note" placeholder="Reason (required to reject)" aria-label="Rejection reason" style={{ marginBottom: 6 }} />
                      <div className="row"><button name="decision" value="approve" className="btn btn-sm btn-dark">Approve</button><button name="decision" value="reject" className="btn btn-sm btn-danger">Reject</button></div>
                    </form>)}
                  {w.verification_status === "rejected" && w.admin_note && <div className="hint">{w.admin_note}</div>}
                </td>
                <td>{w.payment_status === "paid" ? <span className="badge ok">Paid</span> : (
                  <><span className="badge warn">Pending</span>
                    {w.verification_status === "approved" && <form action={markPaid} style={{ marginTop: 8 }}><input type="hidden" name="id" value={w.id} /><button className="btn btn-sm btn-primary">Mark as paid</button></form>}</>)}</td>
              </tr>);
          })}</tbody>
        </table></div>)}
    </div>
  );
}
