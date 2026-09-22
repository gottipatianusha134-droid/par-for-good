export type Role = "subscriber" | "admin";
export type SubStatus = "none" | "active" | "past_due" | "canceled" | "lapsed";

export type Profile = {
  id: string; email: string | null; full_name: string; role: Role;
  charity_id: string | null; charity_percent: number;
  plan: "monthly" | "yearly" | null;
  subscription_status: SubStatus; current_period_end: string | null; cancel_at_period_end: boolean;
  stripe_customer_id: string | null; stripe_subscription_id: string | null; created_at: string;
};
export type CharityEvent = { title: string; date: string; location?: string };
export type Charity = {
  id: string; slug: string; name: string; category: string; description: string;
  image_url: string | null; featured: boolean; events: CharityEvent[];
};
export type Score = { id: string; user_id: string; score: number; played_on: string; created_at: string };
export type Draw = {
  id: string; draw_month: string; mode: "random" | "algorithmic"; status: "simulated" | "published";
  numbers: number[]; subscriber_count: number; eligible_count: number;
  pool_base_minor: number; carry_in_minor: number; tier_pools: Record<string, number>;
  result: any; jackpot_carry_out_minor: number; published_at: string | null;
};
export type Winner = {
  id: string; draw_id: string; user_id: string; tier: 3 | 4 | 5; prize_minor: number;
  proof_path: string | null;
  verification_status: "awaiting_proof" | "pending_review" | "approved" | "rejected";
  payment_status: "pending" | "paid"; admin_note: string | null; paid_at: string | null;
};
