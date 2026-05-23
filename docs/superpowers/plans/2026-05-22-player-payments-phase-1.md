# Player Payments Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the collect mechanic from the Player Payments spec, so a commissioner can store each player's Venmo / Cash App / PayPal handle (either by entering it themselves or by sending the player a self-serve link with a branded share image).

**Architecture:** New `people` and `collection_requests` Postgres tables, plus a nullable `players.person_id` FK. Setup wizard creates a Person for each typed player name. A new commissioner-only `Players` tab on the pool shell lists players and opens a Collect dialog. The dialog either writes handles directly or generates a tokenized link to a public `/collect/[token]` page with a dynamic Open Graph image.

**Tech Stack:** Next.js 14 App Router, Neon Postgres (raw SQL, no ORM), Tailwind, `nanoid` for tokens, `next/og` ImageResponse for the share image, JWT cookie auth via `lib/auth.ts`. **No test framework is configured in this project**, so verification uses one-off scripts in `scripts/` (untracked), `curl` checks, `npx tsc --noEmit`, and concrete browser checks rather than unit tests.

**Conventions to honor (per `CLAUDE.md` and project memory):**
- Tailwind theme classes (`tp-primary` navy, `tp-accent` gold, `tp-bg` cream, `font-serif` for headings).
- Raw SQL with neon tagged templates. No ORM.
- No em-dashes anywhere (copy, UI, commit messages, comments).
- Commit to `main` (Vercel auto-deploys).

**Spec source of truth:** `docs/superpowers/specs/2026-05-22-player-payments-design.md`.

---

## File Structure

**New files:**
- `migrations/2026-05-22-player-payments-phase-1.sql` — additive schema migration.
- `lib/people.ts` — Person and collection-request data helpers shared by API routes.
- `app/api/pool/[slug]/people/route.ts` — commissioner-only GET: pool roster with linked Person and payment status, with one-time backfill.
- `app/api/people/[id]/route.ts` — commissioner-only PATCH: update a Person's handles or preferred method.
- `app/api/pool/[slug]/collection-requests/route.ts` — commissioner-only POST: create a tokenized link.
- `app/api/collect/[token]/route.ts` — public GET (token resolves to person + context) and PATCH (submit handles).
- `app/pool/[slug]/players/page.tsx` — Players tab (commissioner-only).
- `app/pool/[slug]/players/CollectDialog.tsx` — modal: enter or send link.
- `app/collect/[token]/page.tsx` — public self-serve page (server component).
- `app/collect/[token]/SelfServeForm.tsx` — client component for the form.
- `app/collect/[token]/opengraph-image.tsx` — branded 1200x630 share image.
- `app/collect/[token]/twitter-image.tsx` — re-export.
- `scripts/verify-people-migration.ts` — one-off smoke test for migration + setup-wizard person creation.

**Modified files:**
- `lib/db-seed.sql` — append new tables and `players.person_id`.
- `lib/types.ts` — add Person, PaymentMethod, PlayerWithPerson, CollectionRequest types.
- `app/api/pool/[slug]/setup/route.ts` — create a Person per typed name and set `players.person_id`.
- `app/pool/[slug]/pool-shell.tsx` — add Players tab (owner-only).
- `middleware.ts` — protect new authenticated API paths; do **not** protect `/api/collect/[token]`.

**Out of scope for Phase 1:** Groups, autocomplete for existing People, one-tap pay screen, Zelle.

---

## Task 1: DB migration for people, collection_requests, and players.person_id

**Files:**
- Create: `migrations/2026-05-22-player-payments-phase-1.sql`
- Modify: `lib/db-seed.sql` (append new tables and column near the end, after the existing CREATE INDEXes)

- [ ] **Step 1: Write the migration SQL**

Create `migrations/2026-05-22-player-payments-phase-1.sql` exactly:

```sql
-- Player Payments Phase 1: people, collection_requests, players.person_id
-- Safe to run more than once: each statement uses IF NOT EXISTS where Postgres supports it.

CREATE TABLE IF NOT EXISTS people (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chairman_id UUID NOT NULL REFERENCES chairmen(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  venmo_handle TEXT,
  cashapp_handle TEXT,
  paypal_handle TEXT,
  preferred_method TEXT
    CHECK (preferred_method IN ('venmo', 'cashapp', 'paypal') OR preferred_method IS NULL),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_people_chairman ON people(chairman_id);

CREATE TABLE IF NOT EXISTS collection_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT UNIQUE NOT NULL,
  person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  pool_id UUID NOT NULL REFERENCES pools(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  submitted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_collection_requests_token ON collection_requests(token);
CREATE INDEX IF NOT EXISTS idx_collection_requests_person ON collection_requests(person_id);

ALTER TABLE players
  ADD COLUMN IF NOT EXISTS person_id UUID REFERENCES people(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_players_person ON players(person_id);
```

- [ ] **Step 2: Run the migration against the production Neon DB**

The user develops directly against Neon (see `DATABASE_URL` in `.env.local`). Run:

```bash
psql "$(grep '^DATABASE_URL' .env.local | sed 's/^DATABASE_URL=//' | tr -d '"' )" -f migrations/2026-05-22-player-payments-phase-1.sql
```

Expected: `CREATE TABLE`, `CREATE INDEX`, `ALTER TABLE` notices, no errors.

If the `psql` command above fails to parse the URL (multi-line value, special characters), fall back to either:
- Pasting the connection string from `.env.local` directly: `psql "<paste url>" -f migrations/...`
- Asking the user to run the file themselves and confirm completion.

- [ ] **Step 3: Verify the schema landed**

```bash
psql "$(grep DATABASE_URL .env.local | cut -d= -f2- | tr -d '"' )" -c "\d people" -c "\d collection_requests" -c "\d players"
```

Expected: `people` has the columns above, `collection_requests` has `token UNIQUE`, `players` shows a new `person_id uuid` column with a foreign key to `people(id)`.

- [ ] **Step 4: Append the same schema to `lib/db-seed.sql`**

`lib/db-seed.sql` is the canonical schema source. Append after the existing `CREATE INDEX idx_tournament_golfers_tournament ...;` line and before the `-- Seed 2026 major tournaments` comment:

```sql

CREATE TABLE people (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chairman_id UUID NOT NULL REFERENCES chairmen(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  venmo_handle TEXT,
  cashapp_handle TEXT,
  paypal_handle TEXT,
  preferred_method TEXT
    CHECK (preferred_method IN ('venmo', 'cashapp', 'paypal') OR preferred_method IS NULL),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE collection_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT UNIQUE NOT NULL,
  person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  pool_id UUID NOT NULL REFERENCES pools(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  submitted_at TIMESTAMPTZ
);

ALTER TABLE players ADD COLUMN person_id UUID REFERENCES people(id) ON DELETE SET NULL;

CREATE INDEX idx_people_chairman ON people(chairman_id);
CREATE INDEX idx_collection_requests_token ON collection_requests(token);
CREATE INDEX idx_collection_requests_person ON collection_requests(person_id);
CREATE INDEX idx_players_person ON players(person_id);
```

- [ ] **Step 5: Commit**

```bash
git add migrations/2026-05-22-player-payments-phase-1.sql lib/db-seed.sql
git commit -m "feat(payments): add people and collection_requests schema

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Add Person, PaymentMethod, and related types

**Files:**
- Modify: `lib/types.ts`

- [ ] **Step 1: Append the new types to `lib/types.ts`**

Append at the end of the file:

```typescript
export type PaymentMethod = "venmo" | "cashapp" | "paypal";

export interface Person {
  id: string;
  chairmanId: string;
  name: string;
  venmoHandle: string | null;
  cashappHandle: string | null;
  paypalHandle: string | null;
  preferredMethod: PaymentMethod | null;
}

export interface PlayerWithPerson {
  id: string;          // player id
  name: string;        // player name (used in pool standings)
  personId: string;
  person: Person;
}

export interface CollectionRequest {
  id: string;
  token: string;
  personId: string;
  poolId: string;
  createdAt: string;
  submittedAt: string | null;
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add lib/types.ts
git commit -m "feat(payments): add Person and PaymentMethod types

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Add `lib/people.ts` helper module

**Files:**
- Create: `lib/people.ts`

This module centralizes the Person CRUD and the legacy-pool backfill so API routes stay thin. Every helper takes a `sql` client (from `getDb()`) as an explicit argument so callers can compose them inside a single request.

- [ ] **Step 1: Create the helper module**

Write `lib/people.ts`:

```typescript
import type { NeonQueryFunction } from "@neondatabase/serverless";
import type { PaymentMethod, Person, PlayerWithPerson } from "@/lib/types";

type Sql = NeonQueryFunction<false, false>;

function rowToPerson(row: Record<string, unknown>): Person {
  return {
    id: row.id as string,
    chairmanId: row.chairman_id as string,
    name: row.name as string,
    venmoHandle: (row.venmo_handle as string | null) ?? null,
    cashappHandle: (row.cashapp_handle as string | null) ?? null,
    paypalHandle: (row.paypal_handle as string | null) ?? null,
    preferredMethod: (row.preferred_method as PaymentMethod | null) ?? null,
  };
}

/** Insert a new Person for the given chairman and return its row. */
export async function createPerson(
  sql: Sql,
  chairmanId: string,
  name: string,
): Promise<Person> {
  const rows = await sql`
    INSERT INTO people (chairman_id, name)
    VALUES (${chairmanId}, ${name})
    RETURNING id, chairman_id, name, venmo_handle, cashapp_handle, paypal_handle, preferred_method
  `;
  return rowToPerson(rows[0]);
}

/** Get a single Person owned by the given chairman, or null if not found / not owned. */
export async function getPersonForChairman(
  sql: Sql,
  personId: string,
  chairmanId: string,
): Promise<Person | null> {
  const rows = await sql`
    SELECT id, chairman_id, name, venmo_handle, cashapp_handle, paypal_handle, preferred_method
    FROM people WHERE id = ${personId} AND chairman_id = ${chairmanId}
  `;
  return rows.length > 0 ? rowToPerson(rows[0]) : null;
}

/**
 * Overwrite (not coalesce) a Person's handles. Both the commissioner dialog and the
 * self-serve form send the full intended state, including null where a previously
 * stored handle should be cleared.
 */
export async function setPersonHandles(
  sql: Sql,
  personId: string,
  handles: {
    venmoHandle: string | null;
    cashappHandle: string | null;
    paypalHandle: string | null;
    preferredMethod: PaymentMethod | null;
  },
): Promise<Person> {
  const rows = await sql`
    UPDATE people SET
      venmo_handle    = ${handles.venmoHandle},
      cashapp_handle  = ${handles.cashappHandle},
      paypal_handle   = ${handles.paypalHandle},
      preferred_method = ${handles.preferredMethod}
    WHERE id = ${personId}
    RETURNING id, chairman_id, name, venmo_handle, cashapp_handle, paypal_handle, preferred_method
  `;
  return rowToPerson(rows[0]);
}

/**
 * For each player in the pool that has no linked Person, create one (owned by the
 * pool's chairman, name copied from the player) and link it. Idempotent: a second
 * call is a no-op. Returns the count of backfilled players.
 */
export async function backfillPeopleForPool(sql: Sql, poolId: string): Promise<number> {
  const rows = await sql`
    SELECT pl.id, pl.name, p.chairman_id
    FROM players pl
    JOIN pools p ON p.id = pl.pool_id
    WHERE pl.pool_id = ${poolId} AND pl.person_id IS NULL
  `;
  let count = 0;
  for (const r of rows) {
    const person = await createPerson(sql, r.chairman_id as string, r.name as string);
    await sql`UPDATE players SET person_id = ${person.id} WHERE id = ${r.id}`;
    count++;
  }
  return count;
}

/** Return the pool's roster with each player's linked Person. Assumes backfill already ran. */
export async function getPlayersWithPeople(sql: Sql, poolId: string): Promise<PlayerWithPerson[]> {
  const rows = await sql`
    SELECT pl.id, pl.name, pl.person_id,
           p.chairman_id, p.name AS person_name,
           p.venmo_handle, p.cashapp_handle, p.paypal_handle, p.preferred_method
    FROM players pl
    JOIN people p ON p.id = pl.person_id
    WHERE pl.pool_id = ${poolId}
    ORDER BY pl.pick_order NULLS LAST, pl.name
  `;
  return rows.map((r) => ({
    id: r.id as string,
    name: r.name as string,
    personId: r.person_id as string,
    person: {
      id: r.person_id as string,
      chairmanId: r.chairman_id as string,
      name: r.person_name as string,
      venmoHandle: (r.venmo_handle as string | null) ?? null,
      cashappHandle: (r.cashapp_handle as string | null) ?? null,
      paypalHandle: (r.paypal_handle as string | null) ?? null,
      preferredMethod: (r.preferred_method as PaymentMethod | null) ?? null,
    },
  }));
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/people.ts
git commit -m "feat(payments): add lib/people helpers for Person CRUD and backfill

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Wire setup wizard to create a Person per typed player name

**Files:**
- Modify: `app/api/pool/[slug]/setup/route.ts`

The setup wizard already inserts players from the typed-name list (lines 55-64). We need each insert to also create a Person and set `players.person_id`. This must work whether the pool is in awaiting-field mode or not.

- [ ] **Step 1: Add the import**

In `app/api/pool/[slug]/setup/route.ts`, change the imports at the top to include the Person helper:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { draftGolfers } from "@/lib/pool";
import { createPerson } from "@/lib/people";
```

- [ ] **Step 2: Update the player insertion loop to create a Person and link it**

Find the existing block:

```typescript
  // Insert players
  const insertedPlayers = [];
  for (let i = 0; i < players.length; i++) {
    const p = players[i];
    const result = await sql`
      INSERT INTO players (pool_id, name, pick_order)
      VALUES (${poolId}, ${p.name}, ${i})
      RETURNING id, name
    `;
    insertedPlayers.push({ id: result[0].id, name: result[0].name });
  }
```

Replace it with:

```typescript
  // Insert players. For each typed name, create a Person owned by this chairman and
  // link the player to it via person_id. This is what makes payment handles durable
  // across pools the same chairman runs.
  const insertedPlayers = [];
  for (let i = 0; i < players.length; i++) {
    const p = players[i];
    const person = await createPerson(sql, session.chairmanId, p.name);
    const result = await sql`
      INSERT INTO players (pool_id, name, pick_order, person_id)
      VALUES (${poolId}, ${p.name}, ${i}, ${person.id})
      RETURNING id, name
    `;
    insertedPlayers.push({ id: result[0].id, name: result[0].name });
  }
```

- [ ] **Step 3: Verify with an end-to-end smoke check via the dev server**

Create `scripts/verify-people-migration.ts` (the `scripts/` directory is gitignored):

```typescript
// Run with: npx tsx scripts/verify-people-migration.ts
// Asserts that after a setup-wizard save, every player in the saved pool has a person_id
// and a matching row in `people` owned by the pool's chairman.
import { neon } from "@neondatabase/serverless";

async function main() {
  const sql = neon(process.env.DATABASE_URL!);
  const rows = await sql`
    SELECT pl.id AS player_id, pl.name AS player_name, pl.person_id,
           p.chairman_id AS pool_chairman_id, pe.chairman_id AS person_chairman_id, pe.name AS person_name
    FROM players pl
    JOIN pools p ON p.id = pl.pool_id
    LEFT JOIN people pe ON pe.id = pl.person_id
    ORDER BY p.created_at DESC
    LIMIT 20
  `;
  console.log("Most recent 20 players:");
  for (const r of rows) {
    const linked = r.person_id ? "linked" : "MISSING person_id";
    const owned = r.person_chairman_id === r.pool_chairman_id ? "owned" : "OWNER MISMATCH";
    console.log(`  ${r.player_name.padEnd(20)}  ${linked.padEnd(20)}  ${owned}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
```

Then:
1. `npm run dev` (terminal 1).
2. Through the browser, create a fresh pool from the dashboard, type two player names in the wizard's Players step, complete the wizard, and save.
3. In a second terminal: `npx tsx scripts/verify-people-migration.ts`.

Expected output for the new pool's players: each row shows `linked` and `owned`. No `MISSING person_id`, no `OWNER MISMATCH`.

- [ ] **Step 4: Commit (do not commit the script, `scripts/` is gitignored)**

```bash
git add app/api/pool/[slug]/setup/route.ts
git commit -m "feat(payments): create Person per typed name in pool setup

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: GET `/api/pool/[slug]/people` with legacy-pool backfill

**Files:**
- Create: `app/api/pool/[slug]/people/route.ts`

This endpoint powers the Players tab. It is commissioner-only. On first call for a pool whose players predate the feature, it backfills People and links them, so older pools light up the new UI without manual migration.

- [ ] **Step 1: Create the route**

Write `app/api/pool/[slug]/people/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { backfillPeopleForPool, getPlayersWithPeople } from "@/lib/people";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { slug: string } },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sql = getDb();
  const poolRows = await sql`
    SELECT id FROM pools
    WHERE slug = ${params.slug} AND chairman_id = ${session.chairmanId}
  `;
  if (poolRows.length === 0) {
    return NextResponse.json({ error: "Pool not found" }, { status: 404 });
  }
  const poolId = poolRows[0].id as string;

  // Backfill any legacy player that lacks a person_id. Idempotent.
  await backfillPeopleForPool(sql, poolId);

  const players = await getPlayersWithPeople(sql, poolId);
  return NextResponse.json({ players });
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Verify the route works on a legacy pool**

Pick one of the user's older pools (e.g. one of the CJ CUP pools). With the dev server running and logged in as that pool's chairman:

```bash
SLUG=<slug>
curl -sS -b "tp_session=<paste from browser devtools cookies>" \
  http://localhost:3000/api/pool/$SLUG/people | jq '.players | length, .players[0]'
```

Expected: a non-zero count, and the first row shows `personId` and a `person` object with `name` matching the player. Also verify in the DB that every player in that pool now has `person_id IS NOT NULL`:

```bash
psql "$(grep DATABASE_URL .env.local | cut -d= -f2- | tr -d '"' )" \
  -c "SELECT COUNT(*) FILTER (WHERE person_id IS NULL) AS unlinked, COUNT(*) AS total FROM players pl JOIN pools p ON p.id = pl.pool_id WHERE p.slug = '$SLUG';"
```

Expected: `unlinked = 0`.

- [ ] **Step 4: Commit**

```bash
git add app/api/pool/[slug]/people/route.ts
git commit -m "feat(payments): add GET /api/pool/[slug]/people with backfill

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: PATCH `/api/people/[id]` to update handles

**Files:**
- Create: `app/api/people/[id]/route.ts`

- [ ] **Step 1: Create the route**

Write `app/api/people/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getPersonForChairman, setPersonHandles } from "@/lib/people";
import type { PaymentMethod } from "@/lib/types";

function cleanHandle(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().replace(/^@+/, ""); // strip a leading @ if user typed one
  return trimmed.length === 0 ? null : trimmed;
}

function cleanPreferred(value: unknown): PaymentMethod | null {
  if (value === "venmo" || value === "cashapp" || value === "paypal") return value;
  return null;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sql = getDb();
  const existing = await getPersonForChairman(sql, params.id, session.chairmanId);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  const updated = await setPersonHandles(sql, params.id, {
    venmoHandle: cleanHandle(body.venmoHandle),
    cashappHandle: cleanHandle(body.cashappHandle),
    paypalHandle: cleanHandle(body.paypalHandle),
    preferredMethod: cleanPreferred(body.preferredMethod),
  });

  return NextResponse.json({ person: updated });
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Smoke-test against a real Person**

Find a Person id from the previous task's verification, then:

```bash
curl -sS -X PATCH -b "tp_session=<cookie>" \
  -H "Content-Type: application/json" \
  -d '{"venmoHandle":"@whitlock","preferredMethod":"venmo"}' \
  http://localhost:3000/api/people/<personId>
```

Expected: `{"person":{...,"venmoHandle":"whitlock","preferredMethod":"venmo",...}}` (note the `@` is stripped).

- [ ] **Step 4: Commit**

```bash
git add app/api/people/[id]/route.ts
git commit -m "feat(payments): add PATCH /api/people/[id] to update handles

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: POST `/api/pool/[slug]/collection-requests` to mint a token

**Files:**
- Create: `app/api/pool/[slug]/collection-requests/route.ts`

- [ ] **Step 1: Create the route**

Write `app/api/pool/[slug]/collection-requests/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function POST(
  req: NextRequest,
  { params }: { params: { slug: string } },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sql = getDb();
  const poolRows = await sql`
    SELECT id FROM pools
    WHERE slug = ${params.slug} AND chairman_id = ${session.chairmanId}
  `;
  if (poolRows.length === 0) {
    return NextResponse.json({ error: "Pool not found" }, { status: 404 });
  }
  const poolId = poolRows[0].id as string;

  const body = await req.json();
  const personId = typeof body.personId === "string" ? body.personId : "";
  if (!personId) {
    return NextResponse.json({ error: "personId required" }, { status: 400 });
  }

  // Confirm the Person belongs to this chairman before issuing a token for them.
  const personRows = await sql`
    SELECT id FROM people WHERE id = ${personId} AND chairman_id = ${session.chairmanId}
  `;
  if (personRows.length === 0) {
    return NextResponse.json({ error: "Person not found" }, { status: 404 });
  }

  const token = nanoid(16);
  await sql`
    INSERT INTO collection_requests (token, person_id, pool_id)
    VALUES (${token}, ${personId}, ${poolId})
  `;

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://tourneypools.com";
  return NextResponse.json({ token, url: `${baseUrl}/collect/${token}` });
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Smoke-test**

```bash
curl -sS -X POST -b "tp_session=<cookie>" \
  -H "Content-Type: application/json" \
  -d '{"personId":"<personId>"}' \
  http://localhost:3000/api/pool/<slug>/collection-requests
```

Expected: `{"token":"<16 chars>","url":"http://...?/collect/<token>"}` (with `NEXT_PUBLIC_BASE_URL` falling back to `https://tourneypools.com` in prod). Confirm the row landed:

```bash
psql "$(grep DATABASE_URL .env.local | cut -d= -f2- | tr -d '"' )" \
  -c "SELECT token, person_id, pool_id, submitted_at FROM collection_requests ORDER BY created_at DESC LIMIT 1;"
```

- [ ] **Step 4: Commit**

```bash
git add app/api/pool/[slug]/collection-requests/route.ts
git commit -m "feat(payments): add POST collection-requests to mint tokens

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Public `/api/collect/[token]` GET and PATCH

**Files:**
- Create: `app/api/collect/[token]/route.ts`

This endpoint is intentionally public. The GET response excludes handles (those belong to the Person, not to the recipient of the link). The PATCH overwrites the Person's handles and stamps `submitted_at`.

- [ ] **Step 1: Create the route**

Write `app/api/collect/[token]/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { setPersonHandles } from "@/lib/people";
import type { PaymentMethod } from "@/lib/types";

export const dynamic = "force-dynamic";

interface TokenContext {
  personId: string;
  personName: string;
  commissionerName: string;
  poolName: string;
  tournamentName: string | null;
  submittedAt: string | null;
}

async function loadContext(
  sql: ReturnType<typeof getDb>,
  token: string,
): Promise<TokenContext | null> {
  const rows = await sql`
    SELECT cr.person_id, cr.submitted_at,
           pe.name AS person_name,
           p.pool_name,
           c.name AS commissioner_name,
           t.name AS tournament_name
    FROM collection_requests cr
    JOIN people pe ON pe.id = cr.person_id
    JOIN pools p ON p.id = cr.pool_id
    JOIN chairmen c ON c.id = p.chairman_id
    LEFT JOIN tournaments t ON t.id = p.tournament_id
    WHERE cr.token = ${token}
  `;
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    personId: r.person_id as string,
    personName: r.person_name as string,
    commissionerName: r.commissioner_name as string,
    poolName: r.pool_name as string,
    tournamentName: (r.tournament_name as string | null) ?? null,
    submittedAt: (r.submitted_at as string | null) ?? null,
  };
}

function cleanHandle(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().replace(/^@+/, "");
  return trimmed.length === 0 ? null : trimmed;
}

function cleanPreferred(value: unknown): PaymentMethod | null {
  if (value === "venmo" || value === "cashapp" || value === "paypal") return value;
  return null;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { token: string } },
) {
  const sql = getDb();
  const ctx = await loadContext(sql, params.token);
  if (!ctx) {
    return NextResponse.json({ error: "Link not found" }, { status: 404 });
  }
  // Do NOT expose handles. The page only needs context to address the recipient.
  return NextResponse.json({
    personName: ctx.personName,
    commissionerName: ctx.commissionerName,
    poolName: ctx.poolName,
    tournamentName: ctx.tournamentName,
    submitted: ctx.submittedAt !== null,
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { token: string } },
) {
  const sql = getDb();
  const ctx = await loadContext(sql, params.token);
  if (!ctx) {
    return NextResponse.json({ error: "Link not found" }, { status: 404 });
  }

  const body = await req.json();
  await setPersonHandles(sql, ctx.personId, {
    venmoHandle: cleanHandle(body.venmoHandle),
    cashappHandle: cleanHandle(body.cashappHandle),
    paypalHandle: cleanHandle(body.paypalHandle),
    preferredMethod: cleanPreferred(body.preferredMethod),
  });
  await sql`
    UPDATE collection_requests
    SET submitted_at = COALESCE(submitted_at, now())
    WHERE token = ${params.token}
  `;
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Verify public access (no cookie needed)**

```bash
curl -sS http://localhost:3000/api/collect/<token>
```

Expected: a JSON body with `personName`, `commissionerName`, `poolName`, `tournamentName`, `submitted: false`. No handles in the response.

```bash
curl -sS -X PATCH \
  -H "Content-Type: application/json" \
  -d '{"venmoHandle":"@guest-test","preferredMethod":"venmo"}' \
  http://localhost:3000/api/collect/<token>
```

Expected: `{"ok":true}`. A subsequent GET shows `"submitted": true`. The person's `venmo_handle` in the DB is now `guest-test`.

- [ ] **Step 4: Commit**

```bash
git add app/api/collect/[token]/route.ts
git commit -m "feat(payments): add public /api/collect/[token] endpoints

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Protect new authenticated API paths in `middleware.ts`

**Files:**
- Modify: `middleware.ts`

The new routes that require a session are: `/api/pool/[slug]/people`, `/api/pool/[slug]/collection-requests`, `/api/people/[id]`. The public `/api/collect/[token]` must NOT be added to the matcher.

The current matcher relies on the route handler's own `getSession()` check too, so the middleware addition is defense in depth (and gives an unauthenticated user a 401 JSON response with no DB hit).

- [ ] **Step 1: Add the new matcher entries**

In `middleware.ts`, find the `matcher` array and replace it with:

```typescript
export const config = {
  matcher: [
    "/dashboard/:path*",
    "/account/:path*",
    "/admin/:path*",
    "/pool/:slug/setup/:path*",
    "/pool/:slug/scores/:path*",
    "/pool/:slug/players/:path*",
    "/api/pools/:path*",
    "/api/admin/:path*",
    "/api/pool/:slug/setup/:path*",
    "/api/pool/:slug/scores/:path*",
    "/api/pool/:slug/sync/:path*",
    "/api/pool/:slug/people/:path*",
    "/api/pool/:slug/collection-requests/:path*",
    "/api/people/:path*",
  ],
};
```

- [ ] **Step 2: Verify the public route stays public**

```bash
# Should return JSON, not redirect to /login:
curl -sS -i http://localhost:3000/api/collect/<token> | head -5
```

Expected: `HTTP/1.1 200 OK` and a JSON body (assuming token exists). No redirect.

```bash
# Should return 401 (middleware) when no cookie:
curl -sS -i http://localhost:3000/api/pool/<slug>/people | head -5
```

Expected: `HTTP/1.1 401 Unauthorized`.

- [ ] **Step 3: Commit**

```bash
git add middleware.ts
git commit -m "feat(payments): protect new payment API paths in middleware

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: Players tab page (commissioner-only)

**Files:**
- Create: `app/pool/[slug]/players/page.tsx`

The page lists each player with a status pill. Players with at least one handle show the preferred handle and a check; players with none show a `Collect` button. Tapping either opens the Collect dialog (next task) prefilled with the current Person.

- [ ] **Step 1: Create the page**

Write `app/pool/[slug]/players/page.tsx`:

```typescript
"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import type { PaymentMethod, PlayerWithPerson } from "@/lib/types";
import CollectDialog from "./CollectDialog";

const METHOD_LABEL: Record<PaymentMethod, string> = {
  venmo: "Venmo",
  cashapp: "Cash App",
  paypal: "PayPal",
};

function preferredHandle(p: PlayerWithPerson): { method: PaymentMethod; handle: string } | null {
  const order: PaymentMethod[] = p.person.preferredMethod
    ? [p.person.preferredMethod, "venmo", "cashapp", "paypal"]
    : ["venmo", "cashapp", "paypal"];
  for (const m of order) {
    const value =
      m === "venmo" ? p.person.venmoHandle
      : m === "cashapp" ? p.person.cashappHandle
      : p.person.paypalHandle;
    if (value) return { method: m, handle: value };
  }
  return null;
}

export default function PlayersTabPage() {
  const { slug } = useParams();
  const slugStr = slug as string;
  const [players, setPlayers] = useState<PlayerWithPerson[] | null>(null);
  const [openPersonId, setOpenPersonId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const res = await fetch(`/api/pool/${slugStr}/people`);
    if (!res.ok) {
      setError(res.status === 401 ? "You must be the chairman of this pool to see Players." : "Could not load players.");
      setPlayers([]);
      return;
    }
    const data = await res.json();
    setPlayers(data.players);
  }, [slugStr]);

  useEffect(() => { load(); }, [load]);

  if (players === null) {
    return (
      <div className="flex justify-center py-16">
        <p className="font-serif italic text-tp-primary/60 text-sm">Loading players...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-16">
        <p className="text-sm text-gray-500">{error}</p>
      </div>
    );
  }

  const openPlayer = players.find((p) => p.personId === openPersonId) ?? null;

  return (
    <div className="pt-2 pb-12">
      <h1 className="font-serif text-2xl font-bold text-tp-primary mb-1">Players</h1>
      <p className="text-xs text-gray-400 mb-5">
        Collect each player&rsquo;s payment handle so the winners can be paid easily.
      </p>

      <div className="space-y-2">
        {players.map((p) => {
          const handle = preferredHandle(p);
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setOpenPersonId(p.personId)}
              className="w-full flex items-center justify-between bg-white border border-tp-bg-dark rounded-xl px-4 py-3.5 text-left active:bg-tp-bg/60 transition-colors"
            >
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-gray-900 truncate">{p.name}</p>
                {handle ? (
                  <p className="text-xs text-gray-500 truncate mt-0.5">
                    <span className="inline-flex items-center gap-1">
                      <span className="w-3.5 h-3.5 rounded-full bg-tp-accent flex items-center justify-center flex-shrink-0">
                        <svg className="w-2 h-2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </span>
                      {METHOD_LABEL[handle.method]} &middot; @{handle.handle}
                    </span>
                  </p>
                ) : (
                  <p className="text-xs text-gray-400 mt-0.5">No handle on file</p>
                )}
              </div>
              {handle ? (
                <span className="text-xs font-semibold text-tp-primary flex-shrink-0">Edit</span>
              ) : (
                <span className="text-xs font-semibold text-white bg-tp-accent rounded-full px-3 py-1.5 flex-shrink-0">Collect</span>
              )}
            </button>
          );
        })}
      </div>

      {openPlayer && (
        <CollectDialog
          slug={slugStr}
          player={openPlayer}
          onClose={() => setOpenPersonId(null)}
          onSaved={async () => { await load(); setOpenPersonId(null); }}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Type-check (the dialog import will error until next task)**

Run: `npx tsc --noEmit`
Expected: one error from the missing `./CollectDialog` import. That's resolved in the next task. Move on.

- [ ] **Step 3: Commit (with the next task to keep the build green)**

Don't commit yet. Continue to Task 11, then commit Tasks 10 + 11 together.

---

## Task 11: Collect dialog component

**Files:**
- Create: `app/pool/[slug]/players/CollectDialog.tsx`

The dialog presents both paths in one stacked view per the spec. The "Enter it yourself" section is a form over the three apps with a star for preferred. The "Ask the person" section issues a token and shows Copy and Text actions.

- [ ] **Step 1: Create the component**

Write `app/pool/[slug]/players/CollectDialog.tsx`:

```typescript
"use client";

import { useState } from "react";
import type { PaymentMethod, PlayerWithPerson } from "@/lib/types";

const METHOD_LABEL: Record<PaymentMethod, string> = {
  venmo: "Venmo",
  cashapp: "Cash App",
  paypal: "PayPal",
};

interface DialogState {
  venmoHandle: string;
  cashappHandle: string;
  paypalHandle: string;
  preferredMethod: PaymentMethod | null;
}

function initialState(player: PlayerWithPerson): DialogState {
  return {
    venmoHandle: player.person.venmoHandle ?? "",
    cashappHandle: player.person.cashappHandle ?? "",
    paypalHandle: player.person.paypalHandle ?? "",
    preferredMethod: player.person.preferredMethod,
  };
}

function HandleRow({
  method, label, value, onChange, isPreferred, onPrefer, hasAny,
}: {
  method: PaymentMethod;
  label: string;
  value: string;
  onChange: (v: string) => void;
  isPreferred: boolean;
  onPrefer: () => void;
  hasAny: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="relative flex-1">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-400 w-16">{label}</span>
        <span className="absolute left-[5.5rem] top-1/2 -translate-y-1/2 text-gray-300">@</span>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="handle"
          className="input-field pl-[6.25rem]"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          aria-label={`${label} handle`}
        />
      </div>
      <button
        type="button"
        onClick={onPrefer}
        disabled={!value && !isPreferred}
        title={isPreferred ? "Preferred app" : value ? "Set as preferred" : "Enter a handle first"}
        aria-label={isPreferred ? `${label} is preferred` : `Set ${label} as preferred`}
        className={`w-10 h-10 flex items-center justify-center rounded-xl flex-shrink-0 transition-colors
          ${isPreferred ? "text-tp-accent" : value ? "text-gray-300 active:text-tp-accent" : "text-gray-200 cursor-not-allowed"}`}
      >
        <svg className="w-5 h-5" fill={isPreferred ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118L2.05 10.1c-.783-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.518-4.674z" />
        </svg>
      </button>
      {/* hasAny is exposed so we can layout-shift when the dialog state changes; nothing else to do here */}
      <span className="hidden">{hasAny ? "1" : "0"}</span>
    </div>
  );
}

export default function CollectDialog({
  slug, player, onClose, onSaved,
}: {
  slug: string;
  player: PlayerWithPerson;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}) {
  const [state, setState] = useState<DialogState>(initialState(player));
  const [saving, setSaving] = useState(false);
  const [linkUrl, setLinkUrl] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");
  const [error, setError] = useState("");

  const anyHandle = Boolean(state.venmoHandle.trim() || state.cashappHandle.trim() || state.paypalHandle.trim());

  function set<K extends keyof DialogState>(k: K, v: DialogState[K]) {
    setState((s) => ({ ...s, [k]: v }));
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    const res = await fetch(`/api/people/${player.personId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        venmoHandle: state.venmoHandle,
        cashappHandle: state.cashappHandle,
        paypalHandle: state.paypalHandle,
        preferredMethod: state.preferredMethod,
      }),
    });
    setSaving(false);
    if (!res.ok) { setError("Could not save. Try again."); return; }
    await onSaved();
  }

  async function handleMakeLink() {
    setSaving(true);
    setError("");
    const res = await fetch(`/api/pool/${slug}/collection-requests`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ personId: player.personId }),
    });
    setSaving(false);
    if (!res.ok) { setError("Could not create link. Try again."); return; }
    const data = await res.json();
    setLinkUrl(data.url as string);
  }

  function handleCopy() {
    if (!linkUrl) return;
    navigator.clipboard.writeText(linkUrl);
    setCopyState("copied");
    setTimeout(() => setCopyState("idle"), 1500);
  }

  const smsBody = encodeURIComponent(
    `Hi ${player.person.name}, please send me your payment info for our pool: ${linkUrl ?? ""}`,
  );

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center px-3 pb-3 sm:pb-0"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Collect payment info for ${player.name}`}
    >
      <div
        className="w-full max-w-md bg-white rounded-2xl p-5 shadow-card-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-1">
          <h2 className="font-serif text-xl font-bold text-tp-primary">
            Collect from {player.name}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="-mr-1 -mt-1 w-9 h-9 flex items-center justify-center text-gray-300 active:text-gray-600 rounded-full"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
        <p className="text-xs text-gray-400 mb-4">
          Star their preferred app. You can save what you know and ask them for the rest.
        </p>

        <div className="space-y-2.5 mb-4">
          <HandleRow
            method="venmo" label="Venmo"
            value={state.venmoHandle}
            onChange={(v) => set("venmoHandle", v)}
            isPreferred={state.preferredMethod === "venmo"}
            onPrefer={() => set("preferredMethod", "venmo")}
            hasAny={anyHandle}
          />
          <HandleRow
            method="cashapp" label="Cash App"
            value={state.cashappHandle}
            onChange={(v) => set("cashappHandle", v)}
            isPreferred={state.preferredMethod === "cashapp"}
            onPrefer={() => set("preferredMethod", "cashapp")}
            hasAny={anyHandle}
          />
          <HandleRow
            method="paypal" label="PayPal"
            value={state.paypalHandle}
            onChange={(v) => set("paypalHandle", v)}
            isPreferred={state.preferredMethod === "paypal"}
            onPrefer={() => set("preferredMethod", "paypal")}
            hasAny={anyHandle}
          />
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="btn-gold w-full disabled:opacity-60 mb-2"
        >
          {saving ? "Saving..." : "Save"}
        </button>

        <div className="gold-rule my-4" />

        <p className="text-xs text-gray-500 mb-2">
          Or ask {player.name} to send their info themselves.
        </p>
        {!linkUrl ? (
          <button
            type="button"
            onClick={handleMakeLink}
            disabled={saving}
            className="w-full py-3 rounded-xl text-sm font-semibold border border-tp-bg-dark text-tp-primary active:bg-tp-bg/60 disabled:opacity-60"
          >
            Generate self-serve link
          </button>
        ) : (
          <div className="space-y-2">
            <div className="bg-tp-bg/80 rounded-xl px-3 py-2 text-xs text-gray-700 break-all font-mono">
              {linkUrl}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleCopy}
                className="py-3 rounded-xl text-sm font-semibold border border-tp-bg-dark text-tp-primary active:bg-tp-bg/60"
              >
                {copyState === "copied" ? "Copied!" : "Copy link"}
              </button>
              <a
                href={`sms:?&body=${smsBody}`}
                className="py-3 rounded-xl text-sm font-semibold bg-tp-primary text-white text-center active:bg-tp-primary/90"
              >
                Text it
              </a>
            </div>
          </div>
        )}

        {error && <p className="text-xs text-red-600 mt-3">{error}</p>}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Visual check**

In the browser, as the chairman of any pool, navigate to `/pool/<slug>/players`. The list renders. Click a player. The dialog opens. Save persists to the DB. Generate self-serve link gives a copyable URL. (No live nav tab yet, type the URL directly for now.)

- [ ] **Step 4: Commit (Tasks 10 + 11 together)**

```bash
git add app/pool/[slug]/players
git commit -m "feat(payments): add commissioner Players tab and Collect dialog

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 12: Add Players tab to the pool bottom nav

**Files:**
- Modify: `app/pool/[slug]/pool-shell.tsx`

- [ ] **Step 1: Insert a Players tab between Leaderboard and Scores**

In `app/pool/[slug]/pool-shell.tsx`, find the `tabs` array (currently three entries: Leaderboard, Scores, Create Pool). Insert a new entry between Scores and Create Pool. Replace the array with:

```tsx
  const tabs = [
    { href: `/pool/${slug}`, label: "Leaderboard", alwaysShow: true,
      icon: (a: boolean) => <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={a?2.5:1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg> },
    { href: `/pool/${slug}/scores`, label: "Scores", alwaysShow: false,
      icon: (a: boolean) => <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={a?2.5:1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg> },
    { href: `/pool/${slug}/players`, label: "Players", alwaysShow: false,
      icon: (a: boolean) => <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={a?2.5:1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-5.13a4 4 0 11-8 0 4 4 0 018 0zm6 0a4 4 0 01-4 4"/></svg> },
    { href: `/pool/${slug}/setup`, label: "Create Pool", alwaysShow: false,
      icon: (a: boolean) => <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={a?2.5:1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg> },
  ];
```

`alwaysShow: false` means the tab is rendered only when `isOwner` is true (existing logic). No other changes needed.

- [ ] **Step 2: Visual check**

In the browser, as a chairman of a pool, the bottom nav should now show: Leaderboard, Scores, Players, Create Pool. Tapping Players navigates to the Players tab.

As a non-chairman visitor, the bottom nav should still show only Leaderboard. The Players tab must not be visible.

- [ ] **Step 3: Commit**

```bash
git add app/pool/[slug]/pool-shell.tsx
git commit -m "feat(payments): add Players tab to pool bottom nav for owners

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 13: Public self-serve collection page

**Files:**
- Create: `app/collect/[token]/page.tsx`
- Create: `app/collect/[token]/SelfServeForm.tsx`

The page renders server-side to set good metadata and to load context once. The form is a client component that PATCHes the token route and then shows a thank-you state.

- [ ] **Step 1: Create the server page**

Write `app/collect/[token]/page.tsx`:

```typescript
import type { Metadata } from "next";
import { getDb } from "@/lib/db";
import SelfServeForm from "./SelfServeForm";

export const dynamic = "force-dynamic";

interface Context {
  personName: string;
  commissionerName: string;
  poolName: string;
  tournamentName: string | null;
  submitted: boolean;
}

async function loadContext(token: string): Promise<Context | null> {
  const sql = getDb();
  const rows = await sql`
    SELECT cr.submitted_at,
           pe.name AS person_name,
           p.pool_name,
           c.name AS commissioner_name,
           t.name AS tournament_name
    FROM collection_requests cr
    JOIN people pe ON pe.id = cr.person_id
    JOIN pools p ON p.id = cr.pool_id
    JOIN chairmen c ON c.id = p.chairman_id
    LEFT JOIN tournaments t ON t.id = p.tournament_id
    WHERE cr.token = ${token}
  `;
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    personName: r.person_name as string,
    commissionerName: r.commissioner_name as string,
    poolName: r.pool_name as string,
    tournamentName: (r.tournament_name as string | null) ?? null,
    submitted: r.submitted_at !== null,
  };
}

export async function generateMetadata({ params }: { params: { token: string } }): Promise<Metadata> {
  const ctx = await loadContext(params.token);
  if (!ctx) return { title: "TourneyPools" };
  const title = `${ctx.commissionerName} needs your payment info | TourneyPools`;
  const description = `${ctx.poolName}${ctx.tournamentName ? ` for ${ctx.tournamentName}` : ""}`;
  return {
    title,
    description,
    openGraph: { title, description },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function CollectPage({ params }: { params: { token: string } }) {
  const ctx = await loadContext(params.token);
  if (!ctx) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center px-4 text-center bg-tp-bg">
        <img src="/logo.png" alt="TourneyPools" className="h-10 mb-4" />
        <h1 className="font-serif text-2xl font-bold text-tp-primary mb-2">Link not found</h1>
        <p className="text-sm text-gray-500 max-w-xs">
          This link is no longer valid. Ask the person who sent it for a fresh one.
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-tp-bg px-4 pt-10 pb-12">
      <div className="max-w-md mx-auto">
        <div className="text-center mb-6">
          <img src="/logo.png" alt="TourneyPools" className="h-10 mx-auto mb-4" />
          <h1 className="font-serif text-2xl font-bold text-tp-primary leading-tight">
            Hi {ctx.personName}
          </h1>
          <p className="text-sm text-gray-600 mt-2">
            <strong>{ctx.commissionerName}</strong> is running the <strong>{ctx.poolName}</strong> pool
            {ctx.tournamentName ? <> for <strong>{ctx.tournamentName}</strong></> : null} and needs
            your payment info so winners can be paid easily.
          </p>
        </div>
        <SelfServeForm token={params.token} initiallySubmitted={ctx.submitted} />
        <p className="text-[11px] text-gray-400 text-center mt-4 leading-relaxed">
          Only {ctx.commissionerName} can see what you enter here. No accounts, no payments through TourneyPools.
        </p>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Create the client form**

Write `app/collect/[token]/SelfServeForm.tsx`:

```typescript
"use client";

import { useState } from "react";
import type { PaymentMethod } from "@/lib/types";

interface FormState {
  venmoHandle: string;
  cashappHandle: string;
  paypalHandle: string;
  preferredMethod: PaymentMethod | null;
}

function HandleRow({
  label, value, onChange, isPreferred, onPrefer,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  isPreferred: boolean;
  onPrefer: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="relative flex-1">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-400 w-16">{label}</span>
        <span className="absolute left-[5.5rem] top-1/2 -translate-y-1/2 text-gray-300">@</span>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="handle"
          className="input-field pl-[6.25rem]"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          aria-label={`${label} handle`}
        />
      </div>
      <button
        type="button"
        onClick={onPrefer}
        disabled={!value && !isPreferred}
        aria-label={isPreferred ? `${label} is preferred` : `Set ${label} as preferred`}
        className={`w-10 h-10 flex items-center justify-center rounded-xl flex-shrink-0 transition-colors
          ${isPreferred ? "text-tp-accent" : value ? "text-gray-300 active:text-tp-accent" : "text-gray-200 cursor-not-allowed"}`}
      >
        <svg className="w-5 h-5" fill={isPreferred ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118L2.05 10.1c-.783-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.518-4.674z" />
        </svg>
      </button>
    </div>
  );
}

export default function SelfServeForm({
  token, initiallySubmitted,
}: {
  token: string;
  initiallySubmitted: boolean;
}) {
  const [state, setState] = useState<FormState>({
    venmoHandle: "", cashappHandle: "", paypalHandle: "", preferredMethod: null,
  });
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(initiallySubmitted);
  const [error, setError] = useState("");

  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    setState((s) => ({ ...s, [k]: v }));
  }

  const anyHandle = Boolean(state.venmoHandle.trim() || state.cashappHandle.trim() || state.paypalHandle.trim());

  async function handleSubmit() {
    if (!anyHandle) { setError("Please enter at least one handle."); return; }
    setSaving(true);
    setError("");
    const res = await fetch(`/api/collect/${token}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state),
    });
    setSaving(false);
    if (!res.ok) { setError("Could not save. Try again."); return; }
    setDone(true);
  }

  if (done) {
    return (
      <div className="bg-white rounded-2xl p-6 text-center">
        <div className="w-12 h-12 rounded-full bg-tp-accent mx-auto mb-3 flex items-center justify-center">
          <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="font-serif text-xl font-bold text-tp-primary mb-1">Thanks!</h2>
        <p className="text-sm text-gray-500">Your info is saved. You can close this page.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl p-5">
      <p className="text-xs text-gray-500 mb-3">
        Add the apps you use. Star the one you prefer.
      </p>
      <div className="space-y-2.5 mb-4">
        <HandleRow label="Venmo"    value={state.venmoHandle}   onChange={(v) => set("venmoHandle",   v)} isPreferred={state.preferredMethod === "venmo"}   onPrefer={() => set("preferredMethod", "venmo")} />
        <HandleRow label="Cash App" value={state.cashappHandle} onChange={(v) => set("cashappHandle", v)} isPreferred={state.preferredMethod === "cashapp"} onPrefer={() => set("preferredMethod", "cashapp")} />
        <HandleRow label="PayPal"   value={state.paypalHandle}  onChange={(v) => set("paypalHandle",  v)} isPreferred={state.preferredMethod === "paypal"}  onPrefer={() => set("preferredMethod", "paypal")} />
      </div>
      <button
        type="button"
        onClick={handleSubmit}
        disabled={saving || !anyHandle}
        className="btn-gold w-full disabled:opacity-60"
      >
        {saving ? "Saving..." : "Send to chairman"}
      </button>
      {error && <p className="text-xs text-red-600 mt-3 text-center">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Visual check**

In a private/incognito browser window (no chairman session), visit `http://localhost:3000/collect/<token>` using a token created earlier. The page renders the recipient's name and the form. Submitting saves and shows the thank-you state. Returning to the page shows the thank-you state immediately (because `initiallySubmitted` is true).

- [ ] **Step 5: Commit**

```bash
git add app/collect/[token]/page.tsx app/collect/[token]/SelfServeForm.tsx
git commit -m "feat(payments): add public /collect/[token] self-serve page

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 14: Open Graph share image for `/collect/[token]`

**Files:**
- Create: `app/collect/[token]/opengraph-image.tsx`
- Create: `app/collect/[token]/twitter-image.tsx`

Mirrors the approved share-image mockup: TourneyPools logo, headline "[Commissioner] needs your payment info", a gold rule, the pool and tournament names, the domain. Uses the same `next/og` pattern as `app/pool/[slug]/opengraph-image.tsx`.

- [ ] **Step 1: Create the OG route**

Write `app/collect/[token]/opengraph-image.tsx`:

```typescript
import { ImageResponse } from "next/og";
import { getDb } from "@/lib/db";
import { readFile } from "fs/promises";
import { join } from "path";

export const runtime = "nodejs";
export const alt = "Payment info request on TourneyPools";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

async function getImageDataUri(filename: string): Promise<string | null> {
  try {
    const filePath = join(process.cwd(), "public", filename);
    const buffer = await readFile(filePath);
    const ext = filename.endsWith(".png") ? "png" : "jpeg";
    return `data:image/${ext};base64,${buffer.toString("base64")}`;
  } catch {
    return null;
  }
}

export default async function OGImage({ params }: { params: { token: string } }) {
  const sql = getDb();
  const rows = await sql`
    SELECT c.name AS commissioner_name, p.pool_name, t.name AS tournament_name
    FROM collection_requests cr
    JOIN pools p ON p.id = cr.pool_id
    JOIN chairmen c ON c.id = p.chairman_id
    LEFT JOIN tournaments t ON t.id = p.tournament_id
    WHERE cr.token = ${params.token}
  `;

  const logoSrc = await getImageDataUri("logo.png");

  if (rows.length === 0) {
    return new ImageResponse(
      (
        <div style={{ display: "flex", width: "100%", height: "100%", background: "#f7f5f2", alignItems: "center", justifyContent: "center" }}>
          <div style={{ display: "flex", fontSize: 64, fontWeight: 700, color: "#1a365d", fontFamily: "serif" }}>
            TourneyPools
          </div>
        </div>
      ),
      { ...size }
    );
  }

  const r = rows[0];
  const commissionerName = r.commissioner_name as string;
  const poolName = r.pool_name as string;
  const tournamentName = (r.tournament_name as string | null) ?? null;

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          width: "100%",
          height: "100%",
          background: "#f7f5f2",
          padding: "72px 86px",
          boxSizing: "border-box",
        }}
      >
        {/* Logo */}
        {logoSrc ? (
          <img src={logoSrc} alt="" style={{ height: 78, width: "auto" }} />
        ) : (
          <div style={{ display: "flex", fontSize: 36, fontWeight: 700, color: "#1a365d", fontFamily: "serif" }}>
            TourneyPools
          </div>
        )}

        {/* Headline + meta */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              fontSize: 84,
              fontWeight: 800,
              color: "#1a365d",
              lineHeight: 1.05,
              fontFamily: "serif",
              maxWidth: "100%",
            }}
          >
            {commissionerName} needs your payment info
          </div>
          <div style={{ display: "flex", width: 96, height: 6, background: "#d4a843", marginTop: 28, marginBottom: 22 }} />
          <div style={{ display: "flex", fontSize: 32, color: "#5a5a5a" }}>{poolName}</div>
          {tournamentName && (
            <div style={{ display: "flex", fontSize: 32, color: "#5a5a5a", marginTop: 4 }}>{tournamentName}</div>
          )}
        </div>

        {/* Domain */}
        <div style={{ display: "flex", fontSize: 22, color: "#a8a8a8", letterSpacing: "0.06em" }}>
          tourneypools.com
        </div>
      </div>
    ),
    { ...size }
  );
}
```

- [ ] **Step 2: Re-export for Twitter**

Write `app/collect/[token]/twitter-image.tsx`:

```typescript
export { default, alt, contentType, size } from "./opengraph-image";
```

- [ ] **Step 3: Visual check**

With dev server running, open `http://localhost:3000/collect/<token>/opengraph-image` in a browser. The PNG renders with the headline, gold rule, pool + tournament names, and domain. (Next.js serves OG images at this path in dev.)

- [ ] **Step 4: Commit**

```bash
git add app/collect/[token]/opengraph-image.tsx app/collect/[token]/twitter-image.tsx
git commit -m "feat(payments): add Open Graph share image for /collect/[token]

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 15: End-to-end smoke test and build verification

- [ ] **Step 1: Build**

```bash
npm run build
```

Expected: no errors. Next.js prints the new routes:
- `λ /api/collect/[token]`
- `λ /api/people/[id]`
- `λ /api/pool/[slug]/collection-requests`
- `λ /api/pool/[slug]/people`
- `λ /collect/[token]`
- `λ /pool/[slug]/players`

- [ ] **Step 2: Lint**

```bash
npm run lint
```

Expected: no new lint errors.

- [ ] **Step 3: Full happy-path walkthrough**

In dev, logged in as a chairman:

1. Create a new pool from the dashboard. In the setup wizard's Players step, add three names: "Whitlock", "Jake", "Sam". Finish the wizard.
2. Tap the Players tab in the bottom nav. All three are listed, each with "No handle on file".
3. Tap Whitlock. In the Collect dialog, type `whitlock` in the Venmo row, star Venmo, Save. Dialog closes.
4. Players tab now shows "Venmo &middot; @whitlock" with a gold check for Whitlock.
5. Tap Jake. In the dialog, tap "Generate self-serve link". Copy the link.
6. Open the link in an incognito window. The page renders "Hi Jake" with the form.
7. Submit a Cash App handle on the self-serve page. See the thank-you state.
8. Return to the Players tab as the chairman, refresh. Jake now shows "Cash App &middot; @..." with a check.

- [ ] **Step 4: Final commit and push**

```bash
git push origin main
```

Vercel auto-deploys to `tourneypools.com`. Open production and repeat steps 2 to 7 with a real pool to verify the production build serves the new routes.

---

## Spec coverage check

| Spec section | Implemented in task |
|---|---|
| `people` table with payment columns | 1 |
| `collection_requests` table | 1 |
| `players.person_id` column | 1 |
| Typed names create Person and linked Player (setup wizard) | 4 |
| Per-pool Players tab (commissioner-only) | 11, 12 |
| Collect dialog with enter + ask paths | 11 |
| Public self-serve page `/collect/[token]` | 13 |
| Open Graph share image at `/collect/[token]` | 14 |
| Backfill People for pre-feature pools | 5 |
| Phase 2 (groups), Phase 3 (one-tap pay) | Deliberately out of scope |
