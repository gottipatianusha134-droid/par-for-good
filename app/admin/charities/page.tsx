import { createAdminClient } from "@/lib/supabase/admin";
import Flash from "@/components/Flash";
import { deleteCharity, saveCharity } from "../actions";
import type { Charity } from "@/lib/types";

export const metadata = { title: "Charities · Admin" };
export const dynamic = "force-dynamic";

function CharityForm({ c }: { c?: Charity }) {
  const events = (c?.events ?? []).map((e) => `${e.date} | ${e.title} | ${e.location ?? ""}`).join("\n");
  return (
    <form action={saveCharity}>
      {c && <input type="hidden" name="id" value={c.id} />}
      <div className="grid two">
        <div className="field"><label>Name</label><input name="name" defaultValue={c?.name} required /></div>
        <div className="field"><label>Category</label><input name="category" defaultValue={c?.category ?? "Community"} /></div>
      </div>
      <div className="field"><label>Description</label><textarea name="description" defaultValue={c?.description} required /></div>
      <div className="field"><label>Image URL (optional)</label><input name="image_url" type="url" defaultValue={c?.image_url ?? ""} placeholder="https://…" />
        <p className="hint">Leave blank to use generated artwork.</p></div>
      <div className="field"><label>Upcoming events</label><textarea name="events" defaultValue={events} placeholder="2026-11-08 | Charity Golf Day | Hyderabad" />
        <p className="hint">One per line: date (YYYY-MM-DD) | title | location.</p></div>
      <div className="field"><label style={{ display: "flex", gap: 8, alignItems: "center" }}><input type="checkbox" name="featured" defaultChecked={c?.featured} style={{ width: "auto" }} /> Feature on the homepage</label></div>
      <button className="btn btn-dark">{c ? "Save changes" : "Add charity"}</button>
    </form>
  );
}

export default async function AdminCharities({ searchParams }: { searchParams: { ok?: string; err?: string } }) {
  const { data } = await createAdminClient().from("charities").select("*").order("name");
  const list = (data ?? []) as Charity[];
  return (
    <div className="stack">
      <h1>Charities</h1>
      <Flash searchParams={searchParams} />
      <div className="card"><h3>Add a charity</h3><CharityForm /></div>
      {list.map((c) => (
        <div className="card" key={c.id}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
            <div><h3 style={{ marginBottom: 2 }}>{c.name} {c.featured && <span className="badge warn">Featured</span>}</h3><span className="muted">{c.category}, {c.events.length} event{c.events.length === 1 ? "" : "s"}</span></div>
            <form action={deleteCharity}><input type="hidden" name="id" value={c.id} /><button className="btn btn-sm btn-danger">Delete</button></form>
          </div>
          <details className="edit"><summary>Edit details</summary><CharityForm c={c} /></details>
        </div>
      ))}
    </div>
  );
}
