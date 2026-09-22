"use server";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { stripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { siteUrl, stripePriceId } from "@/lib/config";

export async function startCheckout(formData: FormData) {
  const { user, profile } = await requireUser();
  const plan = formData.get("plan") === "yearly" ? "yearly" : "monthly";
  const db = createAdminClient();

  // Create the Stripe customer up front so every later webhook can find the user.
  let customerId = profile.stripe_customer_id;
  if (!customerId) {
    const customer = await stripe().customers.create({
      email: user.email ?? undefined, name: profile.full_name || undefined, metadata: { user_id: user.id },
    });
    customerId = customer.id;
    await db.from("profiles").update({ stripe_customer_id: customerId }).eq("id", user.id);
  }

  const session = await stripe().checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: stripePriceId(plan), quantity: 1 }],
    metadata: { user_id: user.id },
    subscription_data: { metadata: { user_id: user.id } },
    success_url: `${siteUrl()}/dashboard?ok=${encodeURIComponent("Welcome aboard. Your subscription is being confirmed.")}`,
    cancel_url: `${siteUrl()}/subscribe`,
  });
  redirect(session.url!);
}

/** Stripe-hosted portal: update card, switch plan, cancel, resume. */
export async function openBillingPortal() {
  const { profile } = await requireUser();
  if (!profile.stripe_customer_id) redirect("/subscribe");
  const session = await stripe().billingPortal.sessions.create({
    customer: profile.stripe_customer_id!, return_url: `${siteUrl()}/dashboard`,
  });
  redirect(session.url);
}
