# Player Payments: Design Spec

**Date:** 2026-05-22
**Status:** Approved design, ready for implementation planning

## Problem

When a tournament ends the commissioner needs to settle up: winners get paid, losers pay in. Today the app shows who owes whom (the PayoutInfo block) but the actual paying is manual, and people do not have each other's payment details. The commissioner wants to collect and store players' payment handles (Venmo, Cash App, PayPal) so paying is easy, and wants those people and their handles to persist for reuse across the pools they run each tournament.

## Core concepts

**Person.** A durable contact owned by a commissioner (chairman). Has a name, and once collected, up to three payment handles (Venmo, Cash App, PayPal) plus a preferred method. A person created from a typed name starts with a name and no handles. A "handle" is the username on a payment app (for example Venmo @whitlock), which is distinct from the person's name.

**Group.** A named, editable set of people owned by a commissioner, for example "Blue Rock Mafia". A person can belong to several groups. Groups are created from a pool's roster ("save roster as a group") and can be edited any time.

**Pool player.** Unchanged as the per-pool, per-tournament entity used by drafting, scoring, and the leaderboard. It now also links to a Person.

**Collection request.** A tokenized public link the commissioner sends to a person so the person can fill in their own payment handles.

## Data model

New tables:

- `people`: id, chairman_id (FK chairmen), name, venmo_handle, cashapp_handle, paypal_handle, preferred_method (venmo, cashapp, paypal, or null), created_at
- `groups`: id, chairman_id (FK chairmen), name, created_at
- `group_members`: group_id (FK groups), person_id (FK people), primary key (group_id, person_id)
- `collection_requests`: id, token (unique), person_id (FK people), pool_id (FK pools), created_at, submitted_at (nullable)

Changed:

- `players`: add person_id (nullable FK people). Existing rows stay null until backfilled.

Payment handles live on the Person, so a handle entered once is available in every pool and group that includes that person.

## Roster building (pool setup wizard)

The Players step supports three modes:

1. Type names. For each typed name, create a Person for the commissioner and a Player for the pool linked to it. This is the only mode available for a commissioner's first pool.
2. Use a group. Each member of the chosen group becomes a Player in the pool.
3. Edit a group, then use it. Open a group, add or remove members, then use it.

Typing a name always creates a new Person (no automatic dedup). Reuse happens through groups. A "pick from your existing people" autocomplete is a future enhancement.

## Save roster as a group

From the per-pool Players view, "Save roster as a group" prompts for a name and creates a Group plus group_members from the pool's players' people.

## Collecting a payment handle

Each player row on the per-pool Players view shows payment status:

- Has at least one handle: shows the preferred handle and a check, tap to edit.
- No handle: a "Collect" button.

The Collect dialog presents two paths in one stacked view:

1. Enter it yourself. Three rows (Venmo, Cash App, PayPal), each an optional handle field with a star to mark the preferred app. Fill what applies, then Save. Writes to the Person.
2. Ask the person. Generates a collection_request with a token, then shows the link with Copy and Text it actions. The person opens the link and fills it in themselves.

Because handles live on the Person, editing them updates that person everywhere they appear.

## Self-serve collection page

Public route `/collect/[token]`, no login.

The token resolves to the Person, the requesting commissioner's name, the pool name, and the tournament name. The page shows the TourneyPools logo, "Hi [name]", a line naming the commissioner and pool, the tournament name, and the same three-app form with star for preferred. A privacy line states that only the commissioner sees the info. On submit the handles save to the Person and the request is marked submitted, then a thank-you state shows.

The route has a dynamic Open Graph share image at 1200x630: the TourneyPools logo, the headline "[Commissioner] needs your payment info", a gold rule, the pool name and tournament name, and the domain. This makes the texted link preview as a branded, legitimate request rather than spam.

## Screens and placement

- Per-pool Players view: its own commissioner-only tab in the pool navigation, beside Leaderboard and Scores. Lists players with payment status, the Collect action, and Save roster as a group. Keeps the Scores screen focused on golf scores.
- Groups manager: reached from the dashboard, alongside My Pools. Lists groups; opening one edits members and their handles.
- Collect dialog: a modal opened from the Players view.
- Self-serve page and share image: public, token based.

## Existing pools

Players created before this feature have no linked Person. When the per-pool Players view first loads for such a pool, it backfills a Person (from each player's name) and links it. This is a one-time, automatic step so older pools work with the new view.

## Payment methods

Venmo, Cash App, and PayPal. All three support one-tap prefilled payment links, which Phase 3 uses. Zelle is intentionally excluded because it has no universal payment link.

## Phasing

Phase 1, the collect mechanic (build first):

- `people` table with payment columns, `players.person_id`, `collection_requests` table.
- Setup wizard: typed names create people and linked players.
- Per-pool Players tab with the Collect dialog (enter or request).
- Self-serve page and share image.

Outcome: a commissioner can collect and store payment handles for any pool's players.

Phase 2, groups:

- `groups` and `group_members` tables.
- Save roster as a group, the groups manager from the dashboard, and the setup wizard "use a group" mode.
- Optionally seed groups from a commissioner's existing pools so they are not re-entered.

Phase 3, one-tap pay:

- A post-tournament payout view that turns who-owes-whom into one-tap prefilled payment links for Venmo, Cash App, and PayPal, defaulting to each person's preferred method.

## Out of scope

- Automatic dedup of typed names against existing people (autocomplete is a later enhancement).
- Zelle and other payment apps.
- In-app payment processing. The app only deep-links into the payment apps; money never moves through TourneyPools.
