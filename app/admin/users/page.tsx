import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { fmtDate } from "@/lib/format";
import type { Profile } from "@/lib/types";

export const metadata = { title: "Users · Admin" };
export const dynamic = "force-dynamic";

export default async function Users({ searchParams }: { searchParams: { q?: string } }) {
  const q = (searchParams.q ?? "").trim().replace(/[,()]/g, "");
  let query = createAdminClient().from("profiles").select("*").order("created_at", { ascending: false }).limit(200);
  if (q) query = query.or(`full_name.ilike.%${q}%,email.ilike.%${q}%`);
  const { data } = await query;
  const users = (data ?? []) as Profile[];
  return (
    <div className="stack">
      <h1>Users</h1>
      <form className="row"><div><label htmlFor="q">Search by name or email</label><input id="q" name="q" defaultValue={searchParams.q ?? ""} /></div><button className="btn btn-dark">Search</button></form>
      <div className="table-wrap"><table>
        <thead><tr><th>Name</th><th>Email</th><th>Plan</th><th>Status</th><th>Renews</th><th></th></tr></thead>
        <tbody>{users.length === 0 ? <tr><td colSpan={6}>No users match that search.</td></tr> : users.map((u) => (
          <tr key={u.id}><td>{u.full_name || "—"} {u.role === "admin" && <span className="badge">Admin</span>}</td><td>{u.email}</td><td>{u.plan ?? "—"}</td>
            <td><span className={`badge ${u.subscription_status === "active" ? "ok" : u.subscription_status === "none" ? "" : "warn"}`}>{u.subscription_status}</span></td>
            <td>{fmtDate(u.current_period_end)}</td><td><Link className="btn btn-sm" href={`/admin/users/${u.id}`}>Manage</Link></td></tr>))}</tbody>
      </table></div>
    </div>
  );
}
