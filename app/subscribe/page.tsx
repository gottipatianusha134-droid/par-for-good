import { redirect } from "next/navigation";
import { requireUser, hasActiveSubscription } from "@/lib/auth";
import { PRICES } from "@/lib/config";
import { inr } from "@/lib/format";
import { startCheckout } from "./actions";

export const metadata = { title: "Subscribe" };

export default async function Subscribe({ searchParams }: { searchParams: { plan?: string } }) {
  const { profile } = await requireUser();
  if (hasActiveSubscription(profile)) redirect("/dashboard");
  const plan = searchParams.plan === "yearly" ? "yearly" : "monthly";
  const lapsed = ["canceled", "lapsed", "past_due"].includes(profile.subscription_status);
  return (
    <div className="page"><div className="narrow">
      <h1>{lapsed ? "Pick up where you left off" : "Start your subscription"}</h1>
      <p className="muted">{lapsed ? "Your subscription is not active, so scores and draws are paused. Subscribe again to resume." : "Payment is handled securely by Stripe. Your charity share is set from day one."}</p>
      <form action={startCheckout} className="stack">
        <div className="plans">
          <label className="plan"><input type="radio" name="plan" value="monthly" defaultChecked={plan === "monthly"} /><span><b>{inr(PRICES.monthly)}</b>per month</span></label>
          <label className="plan"><input type="radio" name="plan" value="yearly" defaultChecked={plan === "yearly"} /><span><b>{inr(PRICES.yearly)}</b>per year, about two months free</span></label>
        </div>
        <button className="btn btn-primary btn-lg" type="submit" style={{ width: "100%" }}>Continue to secure payment</button>
      </form>
    </div></div>
  );
}
