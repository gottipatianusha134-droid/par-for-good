import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import SplitSlider from "@/components/SplitSlider";
import CharityArt from "@/components/CharityArt";
import { DEFAULT_POOL_PERCENT, MAX_CHARITY_PERCENT, MIN_CHARITY_PERCENT, PRICES } from "@/lib/config";
import { inr } from "@/lib/format";
import { TIER_SHARES } from "@/lib/draw";
import type { Charity } from "@/lib/types";

export const revalidate = 60;

async function load() {
  try {
    const supabase = createClient();
    const { data } = await supabase.from("charities").select("*").order("featured", { ascending: false }).limit(3);
    const { data: setting } = await supabase.from("settings").select("value").eq("key", "pool_percent").maybeSingle();
    const db = createAdminClient();
    const [{ data: pay }, { data: don }] = await Promise.all([
      db.from("payments").select("charity_minor"), db.from("donations").select("amount_minor"),
    ]);
    const raised = (pay ?? []).reduce((s, r) => s + Number(r.charity_minor), 0) + (don ?? []).reduce((s, r) => s + Number(r.amount_minor), 0);
    return { charities: (data ?? []) as Charity[], poolPercent: Number(setting?.value ?? DEFAULT_POOL_PERCENT), raised };
  } catch {
    return { charities: [] as Charity[], poolPercent: DEFAULT_POOL_PERCENT, raised: 0 };
  }
}

export default async function Home() {
  const { charities, poolPercent, raised } = await load();
  const [spotlight, ...others] = charities;
  return (
    <>
      <section className="hero">
        <div className="container">
          <div>
            <h1>Every round you play can fund something that matters.</h1>
            <p className="lead">
              Subscribe, log your latest five Stableford scores, and join a monthly prize draw.
              At least {MIN_CHARITY_PERCENT}% of what you pay goes straight to a charity you pick.
            </p>
            <div className="cta">
              <Link href="/signup" className="btn btn-primary btn-lg">Start giving from {inr(PRICES.monthly)} a month</Link>
              <Link href="/charities" className="btn btn-ghost-light btn-lg">Meet the charities</Link>
            </div>
            {raised > 0 && <p style={{ marginTop: 28, color: "#cfe6e2" }}>So far, players like you have put <b style={{ color: "#fff" }}>{inr(raised)}</b> behind good causes.</p>}
          </div>
          <SplitSlider priceRupees={PRICES.monthly / 100} poolPercent={poolPercent} min={MIN_CHARITY_PERCENT} max={MAX_CHARITY_PERCENT} />
        </div>
      </section>

      <section className="block" id="how">
        <div className="container">
          <h2>How a month works</h2>
          <ol className="steps">
            <li><h3>Subscribe and pick a cause</h3><p>Choose monthly or yearly, then choose the charity your contribution supports. Give more any time.</p></li>
            <li><h3>Log your last five scores</h3><p>Add each round in Stableford points (1 to 45). We always keep your five most recent, and the newest replaces the oldest.</p></li>
            <li><h3>Match the monthly draw</h3><p>Each month five numbers are drawn. Match three, four or five of your scores and you share that tier's prize.</p></li>
          </ol>
        </div>
      </section>

      <section className="block" style={{ background: "var(--sea)" }}>
        <div className="container grid two" style={{ alignItems: "center" }}>
          <div>
            <h2>Three ways to win, one jackpot that grows</h2>
            <p>The prize pool is a fixed share of every subscription. Winners in the same tier split that tier equally. If nobody matches all five, the jackpot rolls into next month.</p>
          </div>
          <div className="tiers">
            {([5, 4, 3] as const).map((t) => (
              <div className="tier" key={t}>
                <b>{t}</b>
                <span>{t === 5 ? "matches: the jackpot, rolls over if unclaimed" : t === 4 ? "matches" : "matches"}</span>
                <span className="pct">{TIER_SHARES[t]}%</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {spotlight && (
        <section className="block">
          <div className="container">
            <h2>This month's spotlight</h2>
            <div className="grid two" style={{ alignItems: "stretch" }}>
              <Link href={`/charities/${spotlight.slug}`} className="charity-card" style={{ gridColumn: "span 1" }}>
                <CharityArt seed={spotlight.slug} imageUrl={spotlight.image_url} />
                <div className="body"><span className="badge">{spotlight.category}</span><h3 style={{ marginTop: 10 }}>{spotlight.name}</h3><p>{spotlight.description}</p></div>
              </Link>
              <div className="stack">
                {others.map((c) => (
                  <Link key={c.id} href={`/charities/${c.slug}`} className="card" style={{ display: "block", textDecoration: "none" }}>
                    <span className="badge">{c.category}</span><h3 style={{ marginTop: 8 }}>{c.name}</h3>
                    <p className="muted" style={{ margin: 0 }}>{c.description.slice(0, 110)}…</p>
                  </Link>
                ))}
                <Link href="/charities" className="btn">See every charity</Link>
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="block band">
        <div className="container">
          <h2>Your next round already has a reason.</h2>
          <p>Plans start at {inr(PRICES.monthly)} a month, or {inr(PRICES.yearly)} a year, which saves about two months of fees. Cancel any time.</p>
          <Link href="/signup" className="btn btn-primary btn-lg">Subscribe and choose your charity</Link>
        </div>
      </section>
    </>
  );
}
