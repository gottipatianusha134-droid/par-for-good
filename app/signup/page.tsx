import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import Flash from "@/components/Flash";
import { signup } from "@/app/login/actions";
import { MAX_CHARITY_PERCENT, MIN_CHARITY_PERCENT, PRICES } from "@/lib/config";
import { inr } from "@/lib/format";
import type { Charity } from "@/lib/types";

export const metadata = { title: "Create your account" };

export default async function Signup({ searchParams }: { searchParams: { charity?: string; plan?: string; err?: string } }) {
  const { data } = await createClient().from("charities").select("id, slug, name").order("name");
  const charities = (data ?? []) as Pick<Charity, "id" | "slug" | "name">[];
  const preselect = charities.find((c) => c.slug === searchParams.charity)?.id ?? "";
  const plan = searchParams.plan === "yearly" ? "yearly" : "monthly";
  return (
    <div className="page"><div className="narrow">
      <h1>Join and choose your cause</h1>
      <Flash searchParams={searchParams} />
      <form action={signup} className="card">
        <div className="field"><label htmlFor="full_name">Full name</label><input id="full_name" name="full_name" autoComplete="name" required /></div>
        <div className="field"><label htmlFor="email">Email</label><input id="email" name="email" type="email" autoComplete="email" required /></div>
        <div className="field"><label htmlFor="password">Password</label><input id="password" name="password" type="password" minLength={8} autoComplete="new-password" required /><p className="hint">At least 8 characters.</p></div>
        <div className="field"><label htmlFor="charity_id">Charity you'll support</label>
          <select id="charity_id" name="charity_id" defaultValue={preselect} required>
            <option value="" disabled>Choose a charity</option>
            {charities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select></div>
        <div className="field"><label htmlFor="charity_percent">Share of your fee to charity (%)</label>
          <input id="charity_percent" name="charity_percent" type="number" min={MIN_CHARITY_PERCENT} max={MAX_CHARITY_PERCENT} defaultValue={MIN_CHARITY_PERCENT} required />
          <p className="hint">Minimum {MIN_CHARITY_PERCENT}%. You can raise it any time.</p></div>
        <fieldset style={{ border: 0, padding: 0, margin: "0 0 20px" }}>
          <legend style={{ fontWeight: 600, marginBottom: 8 }}>Plan</legend>
          <div className="plans">
            <label className="plan"><input type="radio" name="plan" value="monthly" defaultChecked={plan === "monthly"} /><span><b>{inr(PRICES.monthly)}</b>per month</span></label>
            <label className="plan"><input type="radio" name="plan" value="yearly" defaultChecked={plan === "yearly"} /><span><b>{inr(PRICES.yearly)}</b>per year, about two months free</span></label>
          </div>
        </fieldset>
        <button className="btn btn-primary btn-lg" type="submit" style={{ width: "100%" }}>Create account and continue to payment</button>
      </form>
      <p className="muted" style={{ marginTop: 18 }}>Already a member? <Link href="/login"><b>Log in</b></Link></p>
    </div></div>
  );
}
