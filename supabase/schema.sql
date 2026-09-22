-- =====================================================================
-- Par for Good — database schema
-- Run once in the Supabase SQL editor of a NEW project.
-- All money is stored as integer paise (INR minor units).
-- =====================================================================
create extension if not exists pgcrypto;

-- ---------- charities ------------------------------------------------
create table public.charities (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  name        text not null,
  category    text not null default 'Community',
  description text not null default '',
  image_url   text,
  featured    boolean not null default false,
  -- upcoming events: [{ "title": "...", "date": "2026-10-04", "location": "..." }]
  events      jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now()
);

-- ---------- profiles (1:1 with auth.users) ---------------------------
create table public.profiles (
  id                     uuid primary key references auth.users(id) on delete cascade,
  email                  text,
  full_name              text not null default '',
  role                   text not null default 'subscriber' check (role in ('subscriber','admin')),
  charity_id             uuid references public.charities(id) on delete set null,
  charity_percent        int  not null default 10 check (charity_percent between 10 and 50),
  plan                   text check (plan in ('monthly','yearly')),
  subscription_status    text not null default 'none'
                           check (subscription_status in ('none','active','past_due','canceled','lapsed')),
  current_period_end     timestamptz,
  cancel_at_period_end   boolean not null default false,
  stripe_customer_id     text,
  stripe_subscription_id text,
  created_at             timestamptz not null default now()
);

-- ---------- scores ---------------------------------------------------
create table public.scores (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  score      int  not null check (score between 1 and 45),
  played_on  date not null check (played_on <= current_date),
  created_at timestamptz not null default now(),
  unique (user_id, played_on)          -- one score per date
);
create index scores_user_date_idx on public.scores (user_id, played_on desc);

-- Rolling window: after every insert keep only the 5 most recent rounds.
create or replace function public.keep_latest_five_scores() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from public.scores
  where user_id = new.user_id
    and id not in (
      select id from public.scores
      where user_id = new.user_id
      order by played_on desc, created_at desc
      limit 5
    );
  return null;
end $$;

create trigger scores_keep_five
after insert on public.scores
for each row execute function public.keep_latest_five_scores();

-- ---------- draws ----------------------------------------------------
create table public.draws (
  id                        uuid primary key default gen_random_uuid(),
  draw_month                date not null unique,            -- always the 1st of the month
  mode                      text not null check (mode in ('random','algorithmic')),
  status                    text not null default 'simulated' check (status in ('simulated','published')),
  numbers                   int[] not null,
  subscriber_count          int  not null default 0,
  eligible_count            int  not null default 0,
  pool_base_minor           bigint not null default 0,       -- pool from subscriptions this month
  carry_in_minor            bigint not null default 0,       -- jackpot rolled over from earlier draws
  tier_pools                jsonb not null default '{}'::jsonb,   -- {"5":..,"4":..,"3":..}
  result                    jsonb not null default '{}'::jsonb,   -- simulation / published summary
  jackpot_carry_out_minor   bigint not null default 0,
  published_at              timestamptz,
  created_at                timestamptz not null default now()
);

create table public.draw_entries (
  id       uuid primary key default gen_random_uuid(),
  draw_id  uuid not null references public.draws(id) on delete cascade,
  user_id  uuid not null references public.profiles(id) on delete cascade,
  scores   int[] not null,
  matches  int not null default 0,
  unique (draw_id, user_id)
);

create table public.winners (
  id                  uuid primary key default gen_random_uuid(),
  draw_id             uuid not null references public.draws(id) on delete cascade,
  user_id             uuid not null references public.profiles(id) on delete cascade,
  tier                int  not null check (tier in (3,4,5)),
  prize_minor         bigint not null,
  proof_path          text,
  verification_status text not null default 'awaiting_proof'
                        check (verification_status in ('awaiting_proof','pending_review','approved','rejected')),
  payment_status      text not null default 'pending' check (payment_status in ('pending','paid')),
  admin_note          text,
  paid_at             timestamptz,
  created_at          timestamptz not null default now(),
  unique (draw_id, user_id)
);

-- ---------- money ledgers -------------------------------------------
create table public.payments (         -- one row per paid Stripe invoice
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid references public.profiles(id) on delete set null,
  stripe_invoice_id text unique not null,
  amount_minor      bigint not null,
  charity_id        uuid references public.charities(id) on delete set null,
  charity_minor     bigint not null default 0,
  pool_minor        bigint not null default 0,
  paid_at           timestamptz not null default now()
);

create table public.donations (        -- independent, one-off donations
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid references public.profiles(id) on delete set null,
  charity_id        uuid not null references public.charities(id) on delete cascade,
  amount_minor      bigint not null check (amount_minor > 0),
  stripe_session_id text unique,
  created_at        timestamptz not null default now()
);

create table public.settings (
  key   text primary key,
  value jsonb not null
);
insert into public.settings (key, value) values ('pool_percent', '50'::jsonb);

-- ---------- new-user trigger ----------------------------------------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  cid uuid;
  pct int;
begin
  begin cid := nullif(new.raw_user_meta_data->>'charity_id','')::uuid; exception when others then cid := null; end;
  begin pct := coalesce((new.raw_user_meta_data->>'charity_percent')::int, 10); exception when others then pct := 10; end;
  insert into public.profiles (id, email, full_name, charity_id, charity_percent)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name',''), cid, greatest(10, least(50, pct)));
  return new;
end $$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ---------- helpers --------------------------------------------------
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- =====================================================================
-- Row Level Security
-- Profiles are written ONLY by server code using the service role
-- (so users can never grant themselves admin or a subscription).
-- =====================================================================
alter table public.charities     enable row level security;
alter table public.profiles      enable row level security;
alter table public.scores        enable row level security;
alter table public.draws         enable row level security;
alter table public.draw_entries  enable row level security;
alter table public.winners       enable row level security;
alter table public.payments      enable row level security;
alter table public.donations     enable row level security;
alter table public.settings      enable row level security;

create policy "charities are public"       on public.charities for select using (true);
create policy "admins manage charities"    on public.charities for all using (public.is_admin()) with check (public.is_admin());

create policy "read own profile"           on public.profiles for select using (id = auth.uid() or public.is_admin());

create policy "read own scores"            on public.scores for select using (user_id = auth.uid() or public.is_admin());
create policy "insert own scores"          on public.scores for insert with check (user_id = auth.uid());
create policy "update own scores"          on public.scores for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "delete own scores"          on public.scores for delete using (user_id = auth.uid());

create policy "published draws visible"    on public.draws for select using (status = 'published' or public.is_admin());
create policy "read own entries"           on public.draw_entries for select using (user_id = auth.uid() or public.is_admin());
create policy "read own winnings"          on public.winners for select using (user_id = auth.uid() or public.is_admin());
create policy "admins read payments"       on public.payments for select using (public.is_admin());
create policy "read own donations"         on public.donations for select using (user_id = auth.uid() or public.is_admin());
create policy "settings readable"          on public.settings for select using (true);

-- ---------- storage: winner proof screenshots -----------------------
insert into storage.buckets (id, name, public) values ('proofs', 'proofs', false)
on conflict (id) do nothing;

create policy "users upload own proofs" on storage.objects for insert to authenticated
  with check (bucket_id = 'proofs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "users read own proofs" on storage.objects for select to authenticated
  using (bucket_id = 'proofs' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
