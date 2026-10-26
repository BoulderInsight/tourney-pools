# TourneyPools WTF

## Last
2026-10-26 09:08 ET - Final webhook tests and idempotency added to PR #60

## Now
Security fixes PR complete with real webhook tests and idempotency

## Next
- Owner review and approval of PR #60
- Owner confirms JWT_SECRET, STRIPE_WEBHOOK_SECRET, and CRON_SECRET are set in Vercel Production and Preview
- Owner decides whether to rotate JWT_SECRET at merge (recommended)
- Merge to main (deploys to production)

## Blockers
- None. PR is complete and all checks pass.

## Decisions
- Upgrade URL omitted from free tier refusal messages because /pricing does not exist yet (per review feedback)
- Constant-time comparison implemented for CRON_SECRET using Buffer byte-by-byte check
- DATABASE_URL blanked in vitest.config.ts to prevent tests from reaching production
- Legacy one-time paid accounts remain Pro (not downgraded)
- No git history rewrite for removed data files (clean removal with .gitignore rules)

## Log

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
