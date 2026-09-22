"use server";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { stripe } from "@/lib/stripe";
import { siteUrl } from "@/lib/config";
import { back } from "@/lib/flash";
import { createAdminClient } from "@/lib/supabase/admin";

/** Independent one-off donation — not tied to gameplay or the prize pool. */
export async function donate(formData: FormData) {
  const slug = String(formData.get("slug"));
  const { user } = await requireUser();
  const rupees = Math.floor(Number(formData.get("amount")));
  if (!rupees || rupees < 100) back(`/charities/${slug}`, "err", "The minimum donation is ₹100.");

  const { data: charity } = await createAdminClient().from("charities").select("id, name").eq("slug", slug).maybeSingle();
  if (!charity) back("/charities", "err", "That charity could not be found.");

  const session = await stripe().checkout.sessions.create({
    mode: "payment",
    customer_email: user.email ?? undefined,
    line_items: [{
      quantity: 1,
      price_data: { currency: "inr", unit_amount: rupees * 100, product_data: { name: `Donation to ${charity!.name}` } },
    }],
    metadata: { kind: "donation", charity_id: charity!.id, user_id: user.id },
    success_url: `${siteUrl()}/charities/${slug}?ok=${encodeURIComponent("Thank you. Your donation is on its way to the charity.")}`,
    cancel_url: `${siteUrl()}/charities/${slug}`,
  });
  redirect(session.url!);
}
