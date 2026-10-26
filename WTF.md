# WTF.md - TourneyPools Status

## Last
- **2026-10-26 12:51 PM ET**: Completed Next.js 14.2.21 → 15.5.28 upgrade on branch `sec/tp-next-15`
- All async API conversions (cookies, headers, params) completed
- Build passes with ESLint warnings only (no errors)
- TypeScript type-checks clean

## Now
- PR `sec/tp-next-15` ready for review and merge
- Addresses CVE-2025-29927 (middleware bypass) and other security advisories in Next 14.x
- React upgraded to 19.3.1 alongside Next 15

## Next
- Await QA smoke testing on Vercel preview deploy
- Await owner approval before merging (this is a production deploy)
- Separate branch `sec/tp-security-fixes` (JWT, Stripe webhook, cron secret, plan limits) will merge after this

## Blockers
- None. PR is ready.

## Decisions
- Used Next.js 15.5.28 (latest stable on 15.x line)
- Installed ESLint 8.57.1 (Next 15 compatibility) with eslint-config-next@15
- All async API migrations follow Next 15 patterns: `props: { params: Promise<T> }` then `await props.params`
- Preserved all existing behavior - this is a security upgrade, not a feature change

## Log
- **2026-10-26 12:51 PM ET**: Agent started Next 15 upgrade
- **2026-10-26 1:10 PM ET**: Upgraded packages: next@15.5.28, react@19.3.1, react-dom@19.3.1
- **2026-10-26 1:15 PM ET**: Converted all cookies()/headers() calls to async in lib/auth.ts
- **2026-10-26 1:20 PM ET**: Updated 4 auth route handlers to await session cookie functions
- **2026-10-26 1:25 PM ET**: Fixed 23 route handlers with dynamic params (Promise-based)
- **2026-10-26 1:30 PM ET**: Fixed collect page, join layout, manifest route for async params
- **2026-10-26 1:35 PM ET**: Fixed ESLint errors (Link import, const declaration)
- **2026-10-26 1:38 PM ET**: Build successful, committed changes to `sec/tp-next-15`
