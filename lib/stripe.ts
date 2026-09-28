   import Stripe from "stripe";
   let client: Stripe | null = null;
   export function stripe() {
     if (!client) {
       // Keep only visible ASCII characters, so stray spaces, line breaks or "…" can't break the header
       const key = (process.env.STRIPE_SECRET_KEY ?? "").replace(/[^\x21-\x7E]/g, "");
       client = new Stripe(key);
     }
     return client;
   }
