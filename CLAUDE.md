# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start Next.js dev server (http://localhost:3000)
npm run build    # Production build
npm run lint     # ESLint via next lint
npx tsc --noEmit # Type-check without emitting
```

No test framework is configured.

## Architecture

Multi-tenant golf pool app. Next.js 14 App Router, Neon Postgres, Tailwind CSS, deployed on Vercel.

### Data flow

1. **Database** (Neon Postgres, raw SQL via `@neondatabase/serverless`) — no ORM
2. **API routes** (`app/api/`) — server-side logic, auth checks, CRUD
3. **Client pages** (`app/`) — `"use client"` components fetch from API routes, compute leaderboard client-side

### Key lib modules

- **`lib/pool.ts`** — All game logic: `computeLeaderboard()`, `draftGolfers()`, `formatScore()`, `scoreColorClass()`. Contains `DEFAULT_SETTINGS` and `DEFAULT_FIELD` (89 golfers). This is the core business logic file.
- **`lib/types.ts`** — TypeScript interfaces: `CommissionerSettings`, `PoolConfig`, `Golfer`, `PlayerStanding`, `GolferStanding`. Commissioner settings has: draftType, scoringType, bestN, missedCutRule, missedCutPenalty, purseType, purseDistribution, payoutMethod.
- **`lib/auth.ts`** — JWT auth (jose), bcrypt password hashing, HTTP-only cookie sessions (7-day expiry)
- **`lib/db.ts`** — `getDb()` returns Neon SQL client (cache disabled for real-time)
- **`lib/odds-api.ts`** — Fetches live scores from masters.com, fuzzy-matches golfer names (accent normalization), updates shared `tournament_golfers` table
- **`lib/email.ts`** — Verification emails via SMTP2GO/Nodemailer

### Database schema (6 tables)

- **chairmen** — Pool organizers (email/password auth, Stripe customer, tier system)
- **pools** — Each pool has a unique slug, JSONB `settings` column for commissioner preferences, links to chairman
- **players** — Participants within a pool
- **golfers** — Pool-specific golfer entries, linked to shared tournament_golfers via `tournament_golfer_id`
- **tournament_golfers** — Shared master list of golfer scores, updated by cron sync. Scores flow: cron updates tournament_golfers → API uses `COALESCE(tg.r1, g.r1)` to prefer shared data → all pools see updates
- **assignments** — Draft picks linking players to golfers

Schema DDL is in `lib/db-seed.sql`.

### Multi-tenancy

Pools are identified by nanoid slugs. All queries are scoped by `pool_id`. The `settings` column is JSONB — always read/written as a unit, never queried individually.

### Score sync

- Vercel cron runs every 15min during tournament (`vercel.json`)
- `POST /api/cron/sync-scores` updates `tournament_golfers` table
- Golfers with `manual_override = true` are skipped during sync
- Stale pools (>15min since last sync) auto-refresh on page load

### Auth & routing

- `middleware.ts` protects `/dashboard`, `/admin`, `/pool/[slug]/setup`, `/pool/[slug]/scores`, and their API counterparts
- Pool leaderboard pages (`/pool/[slug]`) are public — shareable by slug
- JWT payload: `{ chairmanId, email, name, isSuperAdmin? }`

### Setup wizard

`app/pool/[slug]/setup/page.tsx` — Multi-step form (Pool Info → Rules → Field → Draft → Confirm). Settings loaded from DB are merged with `DEFAULT_SETTINGS` to fill missing fields. All rule sections require a selection before proceeding.

### Leaderboard computation

`computeLeaderboard()` in `lib/pool.ts`:
1. Calculate each golfer's score (sum r1-r4, apply missed-cut rule)
2. Per player: sort golfers, apply scoring type (all vs best-n), mark counted/benched
3. Sum counted golfer scores for player total
4. Rank players, handle ties, distribute purse

### Stripe integration

One-time payment upgrades chairman tier. Checkout via `POST /api/stripe/checkout`, webhook confirms via `POST /api/stripe/webhook`.

## Conventions

- **Tailwind-only styling** with custom Masters theme: `masters-green` (#006747), `masters-gold` (#c9a84c), `masters-cream` (#f5f0e8). Fonts: Playfair Display (serif), Raleway (sans). See `tailwind.config.ts`.
- **Path alias**: `@/*` maps to project root
- **UUIDs** for all primary keys (`gen_random_uuid()`)
- **No ORM** — raw SQL with tagged template literals via Neon client
- **Scores are golf scores** — lower is better, negative is good (under par), positive is bad (over par)

## Environment variables

See `.env.example`. Required: `DATABASE_URL`, `JWT_SECRET`, `THE_ODDS_API_KEY`, `CRON_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, `STRIPE_WEBHOOK_SECRET`, `SMTP_USER`, `SMTP_PASS`, `NEXT_PUBLIC_BASE_URL`.
