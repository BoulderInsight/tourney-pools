# Handoff: TourneyPools session, 2026-05-22

This doc lets a fresh session resume after a compaction. Read it first, then read the spec it points to.

## Current task

Building the **Player Payments** feature. The design is done and a spec is committed. The next step is to write the Phase 1 implementation plan, then implement it.

## Resume here

1. **Read the spec:** `docs/superpowers/specs/2026-05-22-player-payments-design.md`. It is the source of truth for the feature.
2. **Spec review is open.** The user was asked to review the spec but asked for this handoff before giving feedback. When resuming, ask the user if they want any spec changes, apply them, then continue.
3. **After the user approves the spec:** invoke the `superpowers:writing-plans` skill to create the Phase 1 implementation plan. (This feature was designed via the `superpowers:brainstorming` skill; writing-plans is the next step in that flow.)
4. **Then implement Phase 1**, the collect mechanic. Phase 1 scope is defined in the spec.

## How the feature was designed

Worked through it with the user via the brainstorming skill and the visual companion. Key decisions, all recorded in the spec:

- People (durable contacts: name + up to 3 payment handles + a preferred) and Groups (named, editable sets of people) as an address-book model.
- Payment methods: Venmo, Cash App, PayPal. Zelle excluded (no universal payment link).
- The Collect dialog: enter a handle yourself, or send a tokenized self-serve link.
- A public self-serve page plus a branded Open Graph share image.
- Phased build: Phase 1 collect mechanic, Phase 2 groups, Phase 3 one-tap pay screen.

Approved visual mockups persist at `.superpowers/brainstorm/96222-1779479718/content/` (gitignored): `collect-dialog-v3.html`, `self-serve-page-v2.html`, `share-image.html`. The companion server (was on port 54352) may have stopped; restart it only if new mockups are needed.

## Shipped earlier this session (all live in production on `main`)

- Restored live score updates for THE CJ CUP Byron Nelson.
- Bench display: counted golfers get a gold check; non-counted golfers are no longer faded or tagged.
- Score sync cron interval changed from 15 minutes to 5.
- Re-drafted the two CJ CUP pools off the real 147-player field (they had been drafted off a generic default field).
- Setup wizard now loads the real tournament field from the API.
- Deferred-draft / "awaiting field" flow: a pool created before its field is published parks, and the cron auto-drafts it when the field appears.
- Tournament name now shows under the pool name on the leaderboard.

## Project conventions and facts

- Commit to `main`; Vercel auto-deploys `main` to production (tourneypools.com).
- No em-dashes anywhere: copy, UI strings, commit messages, replies to the user.
- The slashgolf golf API does not publish a tournament's field until tournament week (it returns HTTP 400 before then).
- `scripts/` is an untracked directory of local one-off diagnostic and migration scripts.
- Stack: Next.js 14 App Router, Neon Postgres (raw SQL, no ORM), Tailwind, deployed on Vercel. See `CLAUDE.md`.

## When the feature is done

Delete this `HANDOFF.md`.
