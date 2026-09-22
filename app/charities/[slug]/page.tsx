import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUserAndProfile } from "@/lib/auth";
import CharityArt from "@/components/CharityArt";
import Flash from "@/components/Flash";
import { donate } from "./actions";
import { fmtDate } from "@/lib/format";
import type { Charity } from "@/lib/types";

export default async function CharityPage({ params, searchParams }: { params: { slug: string }; searchParams: { ok?: string; err?: string } }) {
  const supabase = createClient();
  const { data } = await supabase.from("charities").select("*").eq("slug", params.slug).maybeSingle();
  if (!data) notFound();
  const c = data as Charity;
  const { user } = await getUserAndProfile();
  const upcoming = (c.events ?? []).filter((e) => new Date(e.date) >= new Date(new Date().toDateString())).sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="page"><div className="container">
      <CharityArt seed={c.slug} imageUrl={c.image_url} className="art" />
      <div style={{ maxWidth: 760, marginTop: 28 }}>
        <span className="badge">{c.category}</span>
        <h1 style={{ marginTop: 12 }}>{c.name}</h1>
        <Flash searchParams={searchParams} />
        <p style={{ fontSize: "1.15rem" }}>{c.description}</p>
      </div>
      <div className="grid two" style={{ marginTop: 32, alignItems: "start" }}>
        <div className="card">
          <h3>Upcoming events</h3>
          {upcoming.length === 0 ? <p className="muted">No events are scheduled right now. Check back soon.</p> : (
            <ul style={{ paddingLeft: 18, margin: 0 }}>
              {upcoming.map((e, i) => <li key={i} style={{ marginBottom: 8 }}><b>{e.title}</b><br /><span className="muted">{fmtDate(e.date)}{e.location ? `, ${e.location}` : ""}</span></li>)}
            </ul>
          )}
        </div>
        <div className="stack">
          <div className="card flat">
            <h3>Support {c.name} with your subscription</h3>
            <p>Pick this charity when you subscribe, or switch to it from your dashboard.</p>
            <Link className="btn btn-primary" href={user ? "/dashboard#charity" : `/signup?charity=${c.slug}`}>{user ? "Choose this charity" : "Subscribe and support them"}</Link>
          </div>
          <div className="card">
            <h3>Make a one-off donation</h3>
            <p className="muted">Independent of gameplay. It does not affect the prize draw.</p>
            {user ? (
              <form action={donate} className="row">
                <input type="hidden" name="slug" value={c.slug} />
                <div><label htmlFor="amount">Amount in ₹</label><input id="amount" name="amount" type="number" min={100} step={50} defaultValue={500} required /></div>
                <button className="btn btn-dark" type="submit">Donate</button>
              </form>
            ) : <Link className="btn" href={`/login?next=/charities/${c.slug}`}>Log in to donate</Link>}
          </div>
        </div>
      </div>
    </div></div>
  );
}
