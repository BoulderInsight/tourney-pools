# Handoff: TourneyPools session, 2026-05-23

This doc lets a fresh session resume after a compaction. Read it first.

## Current task

Implementing **Phase 3 of Player Payments — one-tap pay buttons** on the post-tournament PayoutInfo block in the leaderboard. The plan is committed; execution hasn't started.

## Resume here

1. **Branch:** `feature/player-payments-phase-3` (already checked out, rebased onto current main). It contains one commit beyond main: the plan doc.
2. **Read the plan:** `docs/superpowers/plans/2026-05-23-player-payments-phase-3.md`. 5 tasks, ~30 min total, all UI/API/helpers — no new schema.
3. **Spec:** `docs/superpowers/specs/2026-05-22-player-payments-design.md` (the "Phase 3, one-tap pay" section).
4. **Execution:** dispatch via `superpowers:subagent-driven-development` (the user already chose this pattern for Phases 1 and 2). Pick up at Task 1 (lib/payment-links.ts).
5. **After all 5 tasks pass spec + quality reviews:** open a PR via `gh pr create --base main --head feature/player-payments-phase-3`.
6. **CRITICAL after merge:** `vercel --prod --yes` from a clean `main` checkout. Vercel does NOT auto-deploy from main on this project. See [vercel-no-auto-deploy memory](~/.claude/projects/-Users-chriscox--LOCAL-n8n-tourney-pools/memory/vercel-no-auto-deploy.md). The user noticed this gap mid-session; production was 15 hours stale until I ran the CLI manually.

## What shipped earlier this session (live on tourneypools.com)

- **Phase 1 (PR #1, merge commit 3007629):** Player Payments collect mechanic. `people` and `collection_requests` tables, `players.person_id`, commissioner Players tab with Collect dialog, public `/collect/[token]` self-serve page, branded OG share image ("Enter Payment Info"), legacy-pool backfill.
- **Phase 2 (PR #3, merge commit 64d6e0a; #2 auto-closed when base branch was deleted):** Groups. `groups`/`group_members` tables, `/groups` list + `/groups/[id]` edit pages, dashboard "Groups" link, setup wizard "Use a group" picker, Players-tab "Save roster as a group" button.
- **Polish (PR #4, merge commit 21f9ab0):** Unified `app/components/top-nav.tsx`. Consistent `text-xs` link sizing across dashboard, groups, and pool pages. Dropped the fixed bottom tab nav; per-pool tabs (Leaderboard / Scores / Players / Setup) now live in the top nav. Renamed "My Pools" / "My Groups" to "Pools" / "Groups". Added a Collect/Edit button per member on `/groups/[id]` that opens the CollectDialog (slug-less mode, hides the send-self-serve-link path). Side cleanup: `.superpowers/` gitignored.

Both schema migrations already applied to prod Neon. Production deployed via `vercel --prod --yes` after each merge (build hash at time of polish merge: `dpl_6vzzByPoFZt4QCF9PnzbES7vbVGc`).

## Phase 3 decisions locked in (in the plan)

- Inline buttons in the existing PayoutInfo block. No dedicated payouts screen.
- Honor-system only. Chairman-collects pools keep the text instruction (chairmen have no payment handles in Phases 1-2; out of scope here).
- Public leaderboard JSON exposes each player's preferred-or-first handle and method. Documented privacy tradeoff.
- URL formats: Venmo `venmo.com/{handle}?txn=pay&amount=X.XX&note=...`, Cash App `cash.app/${handle}/X.XX`, PayPal `paypal.me/{handle}/X.XX`.
- Note prefilled: `"{poolName} payout"`.
- Gold pill button styling (`bg-tp-accent`), shows "Pay X $Y" with small "via APP →" suffix.

## Project conventions

- Commit to feature branches and open PRs (do NOT push directly to main during multi-task work).
- Vercel does NOT auto-deploy main; user runs `vercel --prod --yes` manually after each merge. Memorialized in memory.
- No em-dashes anywhere (copy, UI strings, commit messages, replies).
- The slashgolf golf API does not publish a tournament's field until tournament week.
- `scripts/` is gitignored for local one-off scripts.
- Stack: Next.js 14 App Router, Neon Postgres (raw SQL, no ORM), Tailwind, deployed on Vercel.

## When Phase 3 is done

- Open PR to main, dispatch a whole-branch reviewer first, then user merges.
- Run `vercel --prod --yes` from main to deploy.
- Delete this HANDOFF.md (it's just for the compact transition).
