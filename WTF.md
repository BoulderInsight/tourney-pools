# TourneyPools WTF

## Last
2026-10-26 09:39 ET - Fixed RSVP race condition with transaction locks

## Now
RSVP cap check uses SELECT FOR UPDATE in transaction, race test added (51 total)

## Next
- Owner review and approval of PR #60
- Run migration 002 on Production database
- Owner confirms JWT_SECRET, STRIPE_WEBHOOK_SECRET, and CRON_SECRET are set in Vercel Production and Preview
- Owner decides whether to rotate JWT_SECRET at merge (recommended)
- Merge to main (deploys to production)

## Blockers
- None. All review items addressed, 41 tests passing

## Decisions
- Upgrade URL omitted from free tier refusal messages because /pricing does not exist yet
- Constant-time comparison implemented for CRON_SECRET using crypto.timingSafeEqual
- DATABASE_URL blanked in vitest.config.ts to prevent tests from reaching production
- Legacy one-time paid accounts remain Pro (not downgraded)
- No git history rewrite for removed data files (clean removal with .gitignore rules)
- Admin routes re-check is_super_admin from database, never trust JWT claim alone
- Chairman RSVP route enforces cap on ANY transition to pending or accepted
- Setup route reads RSVP status from database, never trusts request body
- Missing JWT_SECRET returns 503 (not 401) to indicate service misconfiguration
- **Grandfather clause**: Older free pools over 8 players keep working fully. Cap is max(8, current_count).
- Blocked actions show "Free pools hold up to 8 players. Upgrade to Pro to add more." in role="alert" element (UI requirement for front-end)

## Log

**2026-10-26 09:39 ET** - Fixed RSVP race condition (Security review)
- RSVP cap check now uses transaction with SELECT FOR UPDATE on pools table
- Prevents two concurrent accepts from both succeeding at cap (7→9 players)
- Both public RSVP and chairman RSVP routes use row lock
- Added race condition test: two concurrent accepts at 7 players, only one succeeds
- 51 tests passing (up from 49)

**2026-10-26 09:33 ET** - Fixed webhook idempotency timing (Security Low issue)
- Event now recorded AFTER successful processing, not before
- If Pro grant fails mid-way, Stripe's retry can process it (not skipped as duplicate)
- Added test: handler throws mid-processing, retry succeeds, not marked as duplicate
- 50 tests passing (up from 49)

**2026-10-26 09:26 ET** - Implemented grandfather clause for over-8 legacy pools
- Cap logic now uses max(8, current_count) to grandfather existing over-8 pools
- Over-8 pools continue working fully (setup, RSVP, scoring) but cannot grow higher
- Chairman can re-accept existing players in 10-player pool (allowed)
- Chairman cannot accept declined player when already at cap (blocked)
- Added 8 new tests for legacy pool scenarios (setup, chairman RSVP)
- Error message: "Free pools hold up to 8 players. Upgrade to Pro to add more."
- UI requirement: blocked actions must show error in role="alert" element next to button
- 49 tests passing (up from 41)

**2026-10-26 09:22 ET** - Added loud error logging for missing idempotency table
- Webhook logs ❌ ERROR when stripe_webhook_events table missing
- Warns migration 002 must be run immediately
- No silent failures in production

**2026-10-26 09:15 ET** - Fixed all Data and Front-end review blockers
- Chairman RSVP route enforces 8-player cap on transitions to pending or accepted (prevents bypass)
- Setup route reads RSVP status from database, ignores request body rsvpStatus field
- Created lib/admin-auth.ts helper that re-checks is_super_admin from database
- Updated all 7 admin routes to use isSuperAdmin helper (no longer trust JWT claim)
- Middleware returns 503 for missing JWT_SECRET (was 401)
- Removed ESLint config files (collides with #61)
- Exact pins for vitest (4.1.12) and eslint-config-next (14.2.35)
- Added tests: setup body validation, RSVP edge cases, expired promo
- 41 tests passing (up from 37)

**2026-10-26 09:08 ET** - Added real webhook tests and idempotency to PR #60
- Replaced documented test scenarios with 37 real executable tests
- Webhook idempotency via stripe_webhook_events table (migration 002)
- invoice.paid looks up by stripe_customer_id (no metadata/email)
- Tests cover: unpaid checkout, paid checkout, invoice.paid, all subscription statuses, bad signature, idempotency
- 37 tests passing (up from 29)

**2026-10-26 09:05 ET** - Fixed Security WARN issues on PR #60
- Bumped vitest to 4.1.12 (fixes CVE-2026-47429 and tinypool RCE)
- Added 8-player cap check on RSVP acceptance routes (prevents bypass)
- Setup route validates body, returns 400 when players missing
- Webhook grants Pro only on payment_status='paid' or invoice.paid, handles 'incomplete' status
- Cron uses crypto.timingSafeEqual for constant-time comparison
- 29 tests passing (up from 23), build succeeds

**2026-10-26 08:58 ET** - Created PR #60 with comprehensive security fixes
- TP-0b: JWT secret validation, removed dev-secret-change-me fallback
- TP-0a: Stripe webhook signature enforcement, subscription renewal handling
- CRON_SECRET: Timing-safe comparison, fail closed when unset
- TP-0c: Server-side free tier limits (1 pool, 8 players)
- SEC-10: Removed 5 committed data export files, added .gitignore rules
- Added Vitest with 23 passing tests covering all security fixes
- Build verified: typecheck passes, build succeeds
- 26 files changed, 7856 insertions, 5016 deletions

**2026-10-26 08:51 ET** - Started security fixes on branch cursor/tp-security-fixes-6d7e
- Read all documentation and security tickets
- Analyzed existing codebase for vulnerabilities
- Identified all routes that need tier checks
