# Masters Pool v2 — Multi-Pool, Neon Postgres, Odds API

**Date:** 2026-04-09
**Status:** Approved

## Summary

Upgrade from single-pool JSON file storage to a multi-tenant pool platform backed by Neon Postgres. Chairmen sign up with email/password, create pools, and share invite links. Players view leaderboards via link without accounts. Scores auto-update from The Odds API during tournament play, with manual entry as fallback.

## Database Schema (Neon Postgres)

### chairmen
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK, default gen_random_uuid() |
| email | TEXT | UNIQUE, NOT NULL |
| password | TEXT | NOT NULL (bcrypt hashed) |
| name | TEXT | NOT NULL |
| created_at | TIMESTAMP | DEFAULT now() |

### pools
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK, default gen_random_uuid() |
| slug | TEXT | UNIQUE, NOT NULL |
| chairman_id | UUID | FK → chairmen, NOT NULL |
| pool_name | TEXT | NOT NULL |
| buy_in | INTEGER | NOT NULL, DEFAULT 20 |
| settings | JSONB | NOT NULL, DEFAULT '{}' |
| setup_complete | BOOLEAN | DEFAULT false |
| tournament_id | TEXT | NULL (Odds API tournament identifier) |
| last_sync_at | TIMESTAMP | NULL |
| created_at | TIMESTAMP | DEFAULT now() |

`settings` JSONB contains: `draftType`, `scoringType`, `bestN`, `missedCutRule`, `missedCutPenalty`, `purseType`, `purseDistribution`. Always read/written as a unit, never queried individually.

### players
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK, default gen_random_uuid() |
| pool_id | UUID | FK → pools, NOT NULL |
| name | TEXT | NOT NULL |
| pick_order | INTEGER | NULL |

### golfers
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK, default gen_random_uuid() |
| pool_id | UUID | FK → pools, NOT NULL |
| name | TEXT | NOT NULL |
| r1 | INTEGER | NULL |
| r2 | INTEGER | NULL |
| r3 | INTEGER | NULL |
| r4 | INTEGER | NULL |
| made_cut | BOOLEAN | NULL |
| odds_api_id | TEXT | NULL (for matching API responses) |
| manual_override | BOOLEAN | DEFAULT false |

`manual_override`: Set to `true` when a chairman manually edits any score field. When `true`, the cron sync skips this golfer entirely. Chairman can reset it via a "Re-enable auto-sync" toggle on the golfer card.

### assignments
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK, default gen_random_uuid() |
| pool_id | UUID | FK → pools, NOT NULL |
| player_id | UUID | FK → players, NOT NULL |
| golfer_id | UUID | FK → golfers, NOT NULL |
| pick_number | INTEGER | NOT NULL |

### Indexes
- `pools(slug)` — unique, used for every public leaderboard lookup
- `pools(chairman_id)` — dashboard "my pools" query
- `golfers(pool_id)` — loading all golfers for a pool
- `players(pool_id)` — loading all players for a pool
- `assignments(pool_id)` — loading draft assignments for a pool
- `chairmen(email)` — unique, login lookup

## Authentication

### Approach
- Email + password signup/login
- Passwords hashed with `bcryptjs`
- Sessions via HTTP-only cookies containing a JWT (signed with `jose`)
- JWT payload: `{ chairmanId, email, name }`
- Token expiry: 7 days

### Auth Middleware
- Protected routes: `/dashboard`, `/pool/[slug]/setup`, `/pool/[slug]/scores`, all `/api/pool/*/` mutation endpoints
- Public routes: `/`, `/signup`, `/login`, `/pool/[slug]` (leaderboard view)
- Middleware extracts JWT from cookie, verifies signature, attaches chairman to request context

### Route Protection Rules
- `/pool/[slug]/setup` and `/pool/[slug]/scores` — must be authenticated AND be the pool's chairman
- `/api/pool/[slug]/sync` — must be the pool's chairman OR called by cron secret
- `/pool/[slug]` — public, no auth required

## URL Structure

```
/                         → Landing / marketing page
/signup                   → Chairman signup
/login                    → Chairman login
/dashboard                → Chairman's pool list + "Create Pool"
/pool/[slug]              → Public leaderboard (no auth required)
/pool/[slug]/setup        → Chairman setup wizard (auth required, owner only)
/pool/[slug]/scores       → Score entry + API sync (auth required, owner only)
```

## API Routes

### Auth
- `POST /api/auth/signup` — Create chairman account
  - Body: `{ email, password, name }`
  - Returns: Sets session cookie, returns `{ ok: true }`
- `POST /api/auth/login` — Login
  - Body: `{ email, password }`
  - Returns: Sets session cookie, returns `{ ok: true }`
- `POST /api/auth/logout` — Clear session cookie

### Pools
- `GET /api/pool/[slug]` — Public. Returns pool config (assembled from joins across pools, players, golfers, assignments)
- `POST /api/pools` — Auth required. Create new pool, returns `{ slug }`
- `POST /api/pool/[slug]/setup` — Auth + owner. Save pool setup (players, golfers, settings, run draft)
- `POST /api/pool/[slug]/scores` — Auth + owner. Manual score update for a single golfer field
- `POST /api/pool/[slug]/sync` — Auth + owner. Trigger Odds API sync for this pool
- `GET /api/dashboard` — Auth required. Returns all pools for the logged-in chairman

### Cron
- `GET /api/cron/sync-scores` — Called by Vercel Cron. Protected by `CRON_SECRET` header. Syncs scores for all active pools.

## The Odds API Integration

### Score Sync Flow
1. Call The Odds API golf scores endpoint for the current/specified tournament
2. Parse response to extract golfer names, round scores, and cut status
3. For each active pool:
   - Match API golfers to pool golfers by `odds_api_id` (if set) or fuzzy name match
   - Update `r1`, `r2`, `r3`, `r4`, `made_cut` on matched golfers
   - Set `pools.last_sync_at` to now
4. Log any unmatched golfers for debugging

### Vercel Cron Schedule
- Runs every 15 minutes Thursday through Sunday during tournament week
- `vercel.json` cron config: `"0/15 * * * 4-7"` (approximate, adjusted for tournament dates)
- Protected by `CRON_SECRET` environment variable

### Manual Refresh
- "Refresh Scores" button on `/pool/[slug]/scores` triggers `POST /api/pool/[slug]/sync`
- Shows last sync time and result count
- Does NOT override manually-entered scores that are newer than the last sync (manual entries take precedence)

### Manual Entry Fallback
- Score entry cards remain on `/pool/[slug]/scores`
- Chairman can tap any R1-R4 cell to enter/override a score
- Chairman can toggle cut status manually
- Manually-edited fields are tracked so cron doesn't overwrite them

### Environment Variables
- `THE_ODDS_API_KEY` — API key for The Odds API
- `CRON_SECRET` — Secret to protect cron endpoint

## UI Changes

### Navigation
- **Public leaderboard (`/pool/[slug]`)**: Bottom nav shows Leaderboard tab only. No Scores/Setup visible to non-owners.
- **Chairman on own pool**: Bottom nav shows Leaderboard / Scores / Setup tabs
- **Dashboard (`/dashboard`)**: No bottom nav. Simple list of pools with create button.
- **Auth pages**: No bottom nav. Clean centered forms.

### New Pages
- `/` — Landing page with "Create a Pool" CTA
- `/signup` — Email + password + name form, Masters-themed
- `/login` — Email + password form
- `/dashboard` — Card list of chairman's pools with status indicators

### Modified Pages
- Leaderboard (`/pool/[slug]`): Same design, now pool-specific via slug
- Setup (`/pool/[slug]/setup`): Same wizard, saves to Postgres instead of JSON
- Scores (`/pool/[slug]/scores`): Add "Refresh from API" button at top, show last sync time

## Tech Stack Changes

### New Dependencies
- `@neondatabase/serverless` — Neon's HTTP-based Postgres driver (edge-compatible)
- `bcryptjs` — Password hashing
- `jose` — JWT signing/verification (lightweight, edge-compatible)

### Removed
- `lib/store.ts` (file-based JSON persistence) — replaced entirely by Postgres queries

### New Files
- `lib/db.ts` — Neon connection pool + query helper
- `lib/auth.ts` — JWT create/verify, password hash/compare, session helpers
- `lib/odds-api.ts` — The Odds API client, score parsing, golfer matching
- `lib/db-seed.sql` — Schema creation script
- `middleware.ts` — Next.js middleware for route protection

### Environment Variables Required
```
DATABASE_URL=postgresql://...@...neon.tech/masters_pool
JWT_SECRET=<random-32-char-string>
THE_ODDS_API_KEY=<odds-api-key>
CRON_SECRET=<random-string-for-cron>
```

## Migration Path

1. Create Neon database and run schema SQL
2. Replace `lib/store.ts` with `lib/db.ts` Postgres queries
3. Add auth system (chairmen table, signup/login routes, middleware)
4. Update all API routes to use Postgres + pool slug routing
5. Add Odds API integration
6. Update UI for multi-pool routing and auth flows
7. Set environment variables in Vercel
8. Deploy
