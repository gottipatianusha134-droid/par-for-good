import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_POOL_PERCENT } from "@/lib/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Db = ReturnType<typeof createAdminClient>;

const mapStatus = (s: Stripe.Subscription.Status) =>
  s === "active" || s === "trialing" ? "active"
  : s === "past_due" ? "past_due"
  : s === "canceled" ? "canceled"
  : "lapsed"; // unpaid, incomplete, incomplete_expired, paused

/** Mirrors a Stripe subscription onto the user's profile. */
async function syncSubscription(db: Db, sub: Stripe.Subscription, userIdHint?: string | null) {
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  let userId = userIdHint ?? sub.metadata?.user_id ?? null;
  if (!userId) {
    const { data } = await db.from("profiles").select("id").eq("stripe_customer_id", customerId).maybeSingle();
    userId = data?.id ?? null;
  }
  if (!userId) return;
  const interval = sub.items.data[0]?.price.recurring?.interval;
  await db.from("profiles").update({
    stripe_customer_id: customerId,
    stripe_subscription_id: sub.id,
    plan: interval === "year" ? "yearly" : "monthly",
    subscription_status: mapStatus(sub.status),
    current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
    cancel_at_period_end: sub.cancel_at_period_end,
  }).eq("id", userId);
}

async function recordInvoice(db: Db, inv: Stripe.Invoice) {
  const customerId = typeof inv.customer === "string" ? inv.customer : inv.customer?.id;
  if (!customerId || !inv.id) return;
  const { data: profile } = await db.from("profiles")
    .select("id, charity_id, charity_percent").eq("stripe_customer_id", customerId).maybeSingle();
  const { data: setting } = await db.from("settings").select("value").eq("key", "pool_percent").maybeSingle();
  const poolPercent = Number(setting?.value ?? DEFAULT_POOL_PERCENT);
  const amount = inv.amount_paid ?? 0;
  await db.from("payments").upsert({
    user_id: profile?.id ?? null,
    stripe_invoice_id: inv.id,
    amount_minor: amount,
    charity_id: profile?.charity_id ?? null,
    charity_minor: Math.floor((amount * (profile?.charity_percent ?? 10)) / 100),
    pool_minor: Math.floor((amount * poolPercent) / 100),
  }, { onConflict: "stripe_invoice_id" });
}

export async function POST(req: Request) {
  const signature = req.headers.get("stripe-signature");
  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(body, signature ?? "", process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  const db = createAdminClient();
  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const s = event.data.object as Stripe.Checkout.Session;
        if (s.mode === "payment" && s.metadata?.kind === "donation") {
          await db.from("donations").upsert({
            user_id: s.metadata.user_id || null,
            charity_id: s.metadata.charity_id,
            amount_minor: s.amount_total ?? 0,
            stripe_session_id: s.id,
          }, { onConflict: "stripe_session_id" });
        } else if (s.mode === "subscription" && s.subscription) {
          const sub = await stripe().subscriptions.retrieve(s.subscription as string);
          await syncSubscription(db, sub, s.metadata?.user_id);
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await syncSubscription(db, event.data.object as Stripe.Subscription);
        break;
      case "invoice.paid":
        await recordInvoice(db, event.data.object as Stripe.Invoice);
        break;
    }
  } catch (e) {
    console.error("webhook handler failed", event.type, e);
    return new Response("Handler error", { status: 500 }); // Stripe will retry
  }
  return new Response("ok");
}
