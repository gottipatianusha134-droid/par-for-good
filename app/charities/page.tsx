import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import CharityArt from "@/components/CharityArt";
import Flash from "@/components/Flash";
import type { Charity } from "@/lib/types";

export const metadata = { title: "Charities" };

export default async function Charities({ searchParams }: { searchParams: { q?: string; category?: string; ok?: string; err?: string } }) {
  const supabase = createClient();
  const { data: all } = await supabase.from("charities").select("*").order("name");
  const list = (all ?? []) as Charity[];
  const categories = Array.from(new Set(list.map((c) => c.category))).sort();
  const q = (searchParams.q ?? "").trim().toLowerCase();
  const shown = list.filter((c) =>
    (!searchParams.category || c.category === searchParams.category) &&
    (!q || c.name.toLowerCase().includes(q) || c.description.toLowerCase().includes(q)));

  return (
    <div className="page"><div className="container">
      <h1>Choose who your rounds support</h1>
      <p className="muted">Every subscriber directs part of their fee to a cause. Search by name or filter by area.</p>
      <Flash searchParams={searchParams} />
      <form method="get" className="row" style={{ margin: "24px 0 32px" }}>
        <div><label htmlFor="q">Search</label><input id="q" name="q" defaultValue={searchParams.q ?? ""} placeholder="Name or keyword" /></div>
        <div><label htmlFor="category">Area</label>
          <select id="category" name="category" defaultValue={searchParams.category ?? ""}>
            <option value="">All areas</option>{categories.map((c) => <option key={c}>{c}</option>)}
          </select></div>
        <button className="btn btn-dark" type="submit">Filter</button>
      </form>
      {shown.length === 0 ? (
        <div className="card flat"><h3>No charities match that search</h3><p>Clear the filter to see everyone, or try a shorter keyword.</p><Link className="btn" href="/charities">Clear filter</Link></div>
      ) : (
        <div className="grid three">
          {shown.map((c) => (
            <Link key={c.id} href={`/charities/${c.slug}`} className="charity-card">
              <CharityArt seed={c.slug} imageUrl={c.image_url} />
              <div className="body"><span className="badge">{c.category}</span><h3 style={{ marginTop: 10 }}>{c.name}</h3><p>{c.description.slice(0, 120)}…</p></div>
            </Link>
          ))}
        </div>
      )}
    </div></div>
  );
}
