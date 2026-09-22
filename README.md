# Par for Good

A subscription web app that combines golf score tracking, a monthly prize draw and charity giving.
Built for the Digital Heroes PRD (Level 1): **Next.js 14 (App Router) · Supabase · Stripe · TypeScript**.

## What's in the box

| PRD section | Where it lives |
|---|---|
| §04 Subscription & payment | `app/subscribe`, `app/api/stripe/webhook`, `lib/auth.ts` (`hasActiveSubscription`) |
| §05 Score management | `app/dashboard/actions.ts`, DB trigger `keep_latest_five_scores` in `supabase/schema.sql` |
| §06–07 Draw & prize pool | `lib/draw.ts` (pure engine, unit-tested), `lib/draw-service.ts`, `app/admin/draws` |
| §08 Charity system | `app/charities`, `app/admin/charities`, contribution % on the profile, one-off donations |
| §09 Winner verification | `app/dashboard` (proof upload), `app/admin/winners` |
| §10 User dashboard | `app/dashboard/page.tsx` |
| §11 Admin dashboard | `app/admin/*` (users, draws, charities, winners, reports) |
| §12 UI/UX | `app/globals.css`, `components/SplitSlider.tsx` (charity-first hero) |

## Setup

### 1. Supabase (create a NEW project)
1. SQL editor → run `supabase/schema.sql`, then `supabase/seed.sql`.
2. Authentication → Providers → Email: for evaluation, turn **off** "Confirm email" so signup flows straight into payment.
3. Copy the project URL, anon key and service-role key into `.env.local` (see `.env.example`).

### 2. Stripe (test mode)
1. Create a product with two recurring prices in **INR**: ₹499 / month and ₹4,999 / year. Put their IDs in `STRIPE_PRICE_MONTHLY` / `STRIPE_PRICE_YEARLY`.
2. Add a webhook endpoint `https://YOUR-DOMAIN/api/stripe/webhook` with events:
   `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`,
   `customer.subscription.deleted`, `invoice.paid`. Put the signing secret in `STRIPE_WEBHOOK_SECRET`.
3. Enable the customer billing portal (Settings → Billing → Customer portal).
4. Local testing: `stripe listen --forward-to localhost:3000/api/stripe/webhook`.

### 3. Run
```bash
npm install
cp .env.example .env.local     # fill it in
npm run seed:demo              # creates the test admin + player (see below)
npm run dev
npm run test:draw              # unit tests for the draw / prize engine
```

### 4. Deploy (new Vercel account)
Import the repo into a **new** Vercel account, add every variable from `.env.example`
(set `NEXT_PUBLIC_SITE_URL` to the production URL) and deploy. Point the Stripe webhook at the production URL.

### Test credentials (created by `npm run seed:demo`)
| Role | Email | Password |
|---|---|---|
| Admin | admin@parforgood.test | Admin#12345 |
| Subscriber (active, 5 scores) | player@parforgood.test | Player#12345 |

## Decisions on ambiguous requirements

The PRD says ambiguity is part of the test, so each gap was resolved explicitly:

1. **What are the draw "numbers"?** The draw picks 5 distinct numbers in 1–45. A player's entry is their 5 stored scores; matches = distinct score values that appear in the draw. 3, 4 or 5 matches win that tier.
2. **Prize pool size.** 50% of each subscription (admin-configurable in *Admin → Draws*). Charity share (min 10%, max 50%) is separate, and the remainder covers running costs. The homepage slider shows this split live.
3. **Yearly plans.** A yearly subscriber contributes `yearly price / 12` to each month's pool.
4. **Unclaimed lower tiers.** Only the 5-match jackpot rolls over (per the PRD). Unclaimed 4/3 tiers are not carried and are shown as "Unclaimed" in the draw report.
5. **Fewer than 5 scores.** Not eligible; the dashboard says how many more are needed.
6. **Algorithmic draw.** Each number has weight `1 + (times it appears across all subscribers' scores)`, so commonly-posted scores are drawn more often.
7. **Simulation vs publish.** Simulating stores a private draft; publishing re-evaluates live data using the *approved numbers*, creates entries and winners, and records any jackpot carry-over.
8. **Score window.** A trigger keeps the 5 most recent by date. Adding a round older than all five is rejected with a clear message rather than silently discarded.
9. **Winner flow.** awaiting proof → pending review → approved / rejected (rejected winners can re-upload); payout Pending → Paid, only after approval.

## Security notes
- Row Level Security is on for every table. Users cannot write their own `profiles` row, so they can never grant themselves admin or a subscription; those writes happen server-side with the service role after authorisation.
- Subscription status is checked from the database on every authenticated request (`requireSubscriber`), kept in sync by signature-verified Stripe webhooks. Webhook handlers are idempotent (`upsert` on invoice / session id).
- Winner screenshots are stored in a **private** bucket and shown to admins via 1-hour signed URLs.

## Scalability notes
- The draw engine is pure and I/O-free, so it can move to a cron job or edge function unchanged.
- Money is integer paise throughout; prices, pool %, tier shares and charity limits live in `lib/config.ts` / `settings`.
- Indexes on `scores(user_id, played_on)`; `draws` is unique per month. Admin lists are capped; add pagination when user counts grow.
- Natural next steps: email notifications (Resend), multi-currency, per-charity payout reports, cron-scheduled draws.

## Verification status (please read)
- ✅ `npm run test:draw` passes (random + weighted generation, matching, 40/35/25 split, equal-split, jackpot rollover).
- ✅ All TypeScript parses cleanly.
- ⚠️ The full app was written in an environment without network access, so `npm install`, `next build`, Supabase and Stripe were **not** run end-to-end. Expect to fix small integration issues on first run; the checklist below is the fastest way to find them.

## Testing checklist (PRD §16.1)
- [ ] Signup & login
- [ ] Subscription flow (monthly + yearly) — use Stripe test card `4242 4242 4242 4242`
- [ ] Score entry: add 6 scores, confirm the oldest drops; try a duplicate date; try 0 and 46
- [ ] Admin → Draws: simulate (random and algorithmic), publish, then check the dashboard
- [ ] Charity selection and % change (min 10%)
- [ ] Winner flow: upload proof → admin approve → mark paid
- [ ] Dashboard modules · Admin panel · mobile layout · error states
