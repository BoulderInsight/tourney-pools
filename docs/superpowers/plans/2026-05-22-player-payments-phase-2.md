# Player Payments Phase 2 Implementation Plan (Groups)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Groups to Player Payments so a commissioner can save a pool's roster as a named group (e.g. "Blue Rock Mafia"), reuse that group in future pools, and edit its membership. Payment handles set on a Person follow that person into every pool and group they appear in.

**Architecture:** Two new Postgres tables (`groups`, `group_members`) link many People to many Groups, all scoped by `chairman_id`. New `/groups` and `/groups/[id]` pages let the chairman manage groups; the setup wizard's Players step gets a "Choose from a group" picker that populates the name list with that group's members; the Players tab gets a "Save roster as a group" button. The wizard creates Players via `findOrCreatePerson` (Phase 1), so group members carry their existing Person and handles.

**Tech Stack:** Next.js 14 App Router, Neon Postgres (raw SQL, no ORM), Tailwind. **No test framework configured** — verification via `npx tsc --noEmit`, `npm run build`, `psql`, and concrete browser checks.

**Spec source of truth:** `docs/superpowers/specs/2026-05-22-player-payments-design.md` (the "Group", "Roster building", "Save roster as a group", and "Phasing → Phase 2" sections).

**Phase 1 dependency:** This plan builds on the merged Phase 1 (`feature/player-payments-phase-1`). It assumes the `people` table, `players.person_id` FK, `lib/people.ts` (with `findOrCreatePerson`), and the existing Players tab are all in place.

**Decisions locked in (call out if you want any changed):**
- **Groups manager location:** new top-level `/groups` page reached from a link on the dashboard. Not a tab inside the dashboard, to keep the dashboard layout simple.
- **"Use a group" picker placement:** above the typed-name list in the wizard's Players step. Selecting a group replaces the current name list with the group's members; the chairman can then edit/add/remove inline before continuing.
- **"Save roster as a group":** a button at the bottom of the Players tab. Opens a small dialog that asks for a name.
- **"Seed groups from past pools":** included. The `/groups` page surfaces a "Start from one of your pools" section that lets the chairman one-click-create a group for any of their past pools.
- **Group name uniqueness:** not enforced per chairman. A chairman may legitimately have "2025 Buddies" and "2026 Buddies" or duplicate names by mistake. We display names verbatim and don't prevent duplicates.
- **Deleting a Group:** removes the `groups` row (cascade-deletes `group_members`) but does NOT delete the underlying People. People remain attached to their pools and other groups.
- **Removing a Person from a Group:** removes the `group_members` row only. The Person and their handles are untouched.

---

## File Structure

**New files:**
- `migrations/2026-05-22-player-payments-phase-2.sql` — additive schema.
- `lib/groups.ts` — Group CRUD + member ops.
- `app/api/groups/route.ts` — list + create.
- `app/api/groups/[id]/route.ts` — get + rename + delete.
- `app/api/groups/[id]/members/route.ts` — add a member by name (creates a Person if needed) or by existing `personId`.
- `app/api/groups/[id]/members/[personId]/route.ts` — remove member.
- `app/api/pool/[slug]/save-as-group/route.ts` — create a group from a pool's roster.
- `app/groups/page.tsx` — list groups + "Start from one of your pools" section + Create button.
- `app/groups/[id]/page.tsx` — edit a group (rename, add/remove members).

**Modified files:**
- `lib/db-seed.sql` — append new tables.
- `lib/types.ts` — add `Group`, `GroupSummary`, `GroupWithMembers`.
- `lib/people.ts` — add `findOrCreatePerson` is already there from Phase 1; ensure it's exported (verify in Task 3 — if missing, the plan inserts the call to add it).
- `middleware.ts` — protect `/groups`, `/api/groups`, and the new `/api/pool/[slug]/save-as-group` path.
- `app/dashboard/page.tsx` — add a "My Groups" link next to "My Pools".
- `app/pool/[slug]/setup/page.tsx` — add a "Use a group" picker to the Players step.
- `app/pool/[slug]/players/page.tsx` — add a "Save roster as a group" button + name dialog.

**Out of scope for Phase 2 (deferred to Phase 3 or later):**
- Picking individual People from an autocomplete (the spec explicitly defers this).
- Renaming a Person from inside a group view (Phase 1's Players tab and the existing PATCH `/api/people/[id]` cover handle edits; name edits aren't a Phase 1/2 feature).
- One-tap pay (Phase 3).

---

## Task 1: DB migration for `groups` and `group_members`

**Files:**
- Create: `migrations/2026-05-22-player-payments-phase-2.sql`
- Modify: `lib/db-seed.sql` (append after the Phase 1 block, before any seed `INSERT`)

- [ ] **Step 1: Write the migration**

Create `migrations/2026-05-22-player-payments-phase-2.sql`:

```sql
-- Player Payments Phase 2: groups, group_members
-- Idempotent (safe to re-run).

CREATE TABLE IF NOT EXISTS groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chairman_id UUID NOT NULL REFERENCES chairmen(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_groups_chairman ON groups(chairman_id);

CREATE TABLE IF NOT EXISTS group_members (
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, person_id)
);

CREATE INDEX IF NOT EXISTS idx_group_members_person ON group_members(person_id);
```

- [ ] **Step 2: Run the migration against Neon**

```bash
psql "$(grep '^DATABASE_URL' .env.local | sed 's/^DATABASE_URL=//' | tr -d '"' )" -f migrations/2026-05-22-player-payments-phase-2.sql
```

Expected: `CREATE TABLE`, `CREATE INDEX` notices, no errors.

- [ ] **Step 3: Verify**

```bash
psql "$(grep '^DATABASE_URL' .env.local | sed 's/^DATABASE_URL=//' | tr -d '"' )" -c "\d groups" -c "\d group_members"
```

Expected: `groups` has `id`, `chairman_id`, `name`, `created_at`. `group_members` has composite PK on `(group_id, person_id)` and FKs to `groups` and `people`.

- [ ] **Step 4: Append to `lib/db-seed.sql`**

Append at the end of the file (after the Phase 1 block and the `idx_players_person` index, before any seed `INSERT` statements):

```sql

CREATE TABLE groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chairman_id UUID NOT NULL REFERENCES chairmen(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE group_members (
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, person_id)
);

CREATE INDEX idx_groups_chairman ON groups(chairman_id);
CREATE INDEX idx_group_members_person ON group_members(person_id);
```

- [ ] **Step 5: Commit**

```bash
git add migrations/2026-05-22-player-payments-phase-2.sql lib/db-seed.sql
git commit -m "feat(payments): add groups and group_members schema

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Add Group types to `lib/types.ts`

**Files:**
- Modify: `lib/types.ts`

- [ ] **Step 1: Append the types**

At the end of `lib/types.ts`:

```typescript
export interface Group {
  id: string;
  chairmanId: string;
  name: string;
  createdAt: string;
}

/** A group with a member count, used in list views. */
export interface GroupSummary extends Group {
  memberCount: number;
}

/** A group with its full member list. Each member is a Person from Phase 1. */
export interface GroupWithMembers extends Group {
  members: Person[];
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/types.ts
git commit -m "feat(payments): add Group, GroupSummary, GroupWithMembers types

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Add `lib/groups.ts` helper module

**Files:**
- Create: `lib/groups.ts`

This module centralizes Group CRUD + member ops. It mirrors the pattern in `lib/people.ts` — explicit `sql` client argument so callers can compose helpers within a single request.

- [ ] **Step 1: Verify `findOrCreatePerson` is exported from `lib/people.ts`**

```bash
grep -n "export async function findOrCreatePerson" lib/people.ts
```

Expected: a line showing the export exists (from Phase 1's review-fix commit). If it does NOT exist, that's a problem — STOP and report; the plan assumes Phase 1 is on this branch.

- [ ] **Step 2: Create `lib/groups.ts`**

Write `lib/groups.ts`:

```typescript
import type { NeonQueryFunction } from "@neondatabase/serverless";
import type { Group, GroupSummary, GroupWithMembers, PaymentMethod, Person } from "@/lib/types";

type Sql = NeonQueryFunction<false, false>;

function rowToGroup(row: Record<string, unknown>): Group {
  return {
    id: row.id as string,
    chairmanId: row.chairman_id as string,
    name: row.name as string,
    createdAt: (row.created_at as { toISOString?: () => string } | string)?.toString() ?? "",
  };
}

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

/** List all groups owned by the chairman with a count of members in each. */
export async function listGroupsForChairman(sql: Sql, chairmanId: string): Promise<GroupSummary[]> {
  const rows = await sql`
    SELECT g.id, g.chairman_id, g.name, g.created_at,
           (SELECT COUNT(*) FROM group_members gm WHERE gm.group_id = g.id) AS member_count
    FROM groups g
    WHERE g.chairman_id = ${chairmanId}
    ORDER BY g.created_at DESC
  `;
  return rows.map((r) => ({
    ...rowToGroup(r),
    memberCount: Number(r.member_count),
  }));
}

/** Return a group with its members, scoped to the given chairman. Null if missing or not owned. */
export async function getGroupForChairman(
  sql: Sql,
  groupId: string,
  chairmanId: string,
): Promise<GroupWithMembers | null> {
  const groupRows = await sql`
    SELECT id, chairman_id, name, created_at
    FROM groups WHERE id = ${groupId} AND chairman_id = ${chairmanId}
  `;
  if (groupRows.length === 0) return null;
  const memberRows = await sql`
    SELECT pe.id, pe.chairman_id, pe.name, pe.venmo_handle, pe.cashapp_handle, pe.paypal_handle, pe.preferred_method
    FROM group_members gm
    JOIN people pe ON pe.id = gm.person_id
    WHERE gm.group_id = ${groupId}
    ORDER BY pe.name
  `;
  return {
    ...rowToGroup(groupRows[0]),
    members: memberRows.map(rowToPerson),
  };
}

/** Create a group. Optionally add an initial set of members (must be Person ids owned by the chairman). */
export async function createGroup(
  sql: Sql,
  chairmanId: string,
  name: string,
  initialMemberPersonIds: string[] = [],
): Promise<Group> {
  const groupRows = await sql`
    INSERT INTO groups (chairman_id, name)
    VALUES (${chairmanId}, ${name})
    RETURNING id, chairman_id, name, created_at
  `;
  const group = rowToGroup(groupRows[0]);
  for (const personId of initialMemberPersonIds) {
    // group_members is composite-PK on (group_id, person_id) so the same person inserted twice
    // would error; ON CONFLICT DO NOTHING keeps the call idempotent.
    await sql`
      INSERT INTO group_members (group_id, person_id)
      VALUES (${group.id}, ${personId})
      ON CONFLICT DO NOTHING
    `;
  }
  return group;
}

/** Rename a group. Throws if the group does not exist or is not owned by the chairman. */
export async function renameGroup(
  sql: Sql,
  groupId: string,
  chairmanId: string,
  newName: string,
): Promise<Group> {
  const rows = await sql`
    UPDATE groups SET name = ${newName}
    WHERE id = ${groupId} AND chairman_id = ${chairmanId}
    RETURNING id, chairman_id, name, created_at
  `;
  if (rows.length === 0) {
    throw new Error(`renameGroup: group ${groupId} not found for chairman ${chairmanId}`);
  }
  return rowToGroup(rows[0]);
}

/** Delete a group. The group_members rows cascade. People themselves are untouched. */
export async function deleteGroup(sql: Sql, groupId: string, chairmanId: string): Promise<boolean> {
  const rows = await sql`
    DELETE FROM groups
    WHERE id = ${groupId} AND chairman_id = ${chairmanId}
    RETURNING id
  `;
  return rows.length > 0;
}

/** Add an existing Person to a group. Idempotent via ON CONFLICT. */
export async function addMemberToGroup(
  sql: Sql,
  groupId: string,
  personId: string,
): Promise<void> {
  await sql`
    INSERT INTO group_members (group_id, person_id)
    VALUES (${groupId}, ${personId})
    ON CONFLICT DO NOTHING
  `;
}

/** Remove a member from a group. Returns true if a row was deleted. */
export async function removeMemberFromGroup(
  sql: Sql,
  groupId: string,
  personId: string,
): Promise<boolean> {
  const rows = await sql`
    DELETE FROM group_members
    WHERE group_id = ${groupId} AND person_id = ${personId}
    RETURNING group_id
  `;
  return rows.length > 0;
}

/** Quick ownership check used by API routes that need to verify access to a group. */
export async function groupExistsForChairman(
  sql: Sql,
  groupId: string,
  chairmanId: string,
): Promise<boolean> {
  const rows = await sql`
    SELECT 1 FROM groups WHERE id = ${groupId} AND chairman_id = ${chairmanId} LIMIT 1
  `;
  return rows.length > 0;
}
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add lib/groups.ts
git commit -m "feat(payments): add lib/groups helpers for Group CRUD and members

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: `GET /api/groups` and `POST /api/groups`

**Files:**
- Create: `app/api/groups/route.ts`

- [ ] **Step 1: Create the route**

Write `app/api/groups/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { createGroup, listGroupsForChairman } from "@/lib/groups";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const sql = getDb();
  const groups = await listGroupsForChairman(sql, session.chairmanId);
  return NextResponse.json({ groups });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }
  const initialMemberPersonIds = Array.isArray(body.personIds)
    ? body.personIds.filter((p: unknown): p is string => typeof p === "string")
    : [];

  const sql = getDb();
  // Verify any provided personIds belong to this chairman before linking them.
  // A bad personId would otherwise silently no-op (FK enforces existence but not ownership).
  if (initialMemberPersonIds.length > 0) {
    const rows = await sql`
      SELECT id FROM people
      WHERE chairman_id = ${session.chairmanId} AND id = ANY(${initialMemberPersonIds}::uuid[])
    `;
    const validIds = new Set(rows.map((r) => r.id as string));
    for (const id of initialMemberPersonIds) {
      if (!validIds.has(id)) {
        return NextResponse.json({ error: `Person ${id} not owned by you` }, { status: 403 });
      }
    }
  }

  const group = await createGroup(sql, session.chairmanId, name, initialMemberPersonIds);
  return NextResponse.json({ group });
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add app/api/groups/route.ts
git commit -m "feat(payments): add GET and POST /api/groups

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: `GET`, `PATCH`, `DELETE /api/groups/[id]`

**Files:**
- Create: `app/api/groups/[id]/route.ts`

- [ ] **Step 1: Create the route**

Write `app/api/groups/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { deleteGroup, getGroupForChairman, renameGroup } from "@/lib/groups";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const sql = getDb();
  const group = await getGroupForChairman(sql, params.id, session.chairmanId);
  if (!group) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ group });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }
  const sql = getDb();
  try {
    const group = await renameGroup(sql, params.id, session.chairmanId, name);
    return NextResponse.json({ group });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const sql = getDb();
  const ok = await deleteGroup(sql, params.id, session.chairmanId);
  if (!ok) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add app/api/groups/[id]/route.ts
git commit -m "feat(payments): add GET PATCH DELETE /api/groups/[id]

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Group member endpoints

**Files:**
- Create: `app/api/groups/[id]/members/route.ts` (POST add)
- Create: `app/api/groups/[id]/members/[personId]/route.ts` (DELETE remove)

The POST endpoint accepts two shapes: `{ personId }` to add an existing Person, or `{ name }` to create a new Person (via `findOrCreatePerson`, so existing People match) and add them to the group in one step. This is what the Groups edit page uses to add a member by typing a name.

- [ ] **Step 1: Create the POST add-member route**

Write `app/api/groups/[id]/members/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { addMemberToGroup, getGroupForChairman } from "@/lib/groups";
import { findOrCreatePerson } from "@/lib/people";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const sql = getDb();
  const group = await getGroupForChairman(sql, params.id, session.chairmanId);
  if (!group) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  let personId: string | null = null;

  if (typeof body.personId === "string" && body.personId.length > 0) {
    // Existing person path: verify ownership.
    const rows = await sql`
      SELECT id FROM people WHERE id = ${body.personId} AND chairman_id = ${session.chairmanId}
    `;
    if (rows.length === 0) {
      return NextResponse.json({ error: "Person not found" }, { status: 404 });
    }
    personId = body.personId;
  } else if (typeof body.name === "string" && body.name.trim().length > 0) {
    // Typed-name path: find or create a Person owned by this chairman.
    const person = await findOrCreatePerson(sql, session.chairmanId, body.name.trim());
    personId = person.id;
  } else {
    return NextResponse.json({ error: "personId or name required" }, { status: 400 });
  }

  await addMemberToGroup(sql, params.id, personId);
  return NextResponse.json({ ok: true, personId });
}
```

- [ ] **Step 2: Create the DELETE remove-member route**

Write `app/api/groups/[id]/members/[personId]/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { groupExistsForChairman, removeMemberFromGroup } from "@/lib/groups";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; personId: string } },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const sql = getDb();
  const owned = await groupExistsForChairman(sql, params.id, session.chairmanId);
  if (!owned) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const removed = await removeMemberFromGroup(sql, params.id, params.personId);
  if (!removed) {
    return NextResponse.json({ error: "Not a member" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add app/api/groups/[id]/members
git commit -m "feat(payments): add group member add/remove endpoints

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: `POST /api/pool/[slug]/save-as-group`

**Files:**
- Create: `app/api/pool/[slug]/save-as-group/route.ts`

Creates a Group from the pool's player roster. Skips players that don't have a `person_id` linked (which should be none after Phase 1's backfill, but defensive coding is cheap).

- [ ] **Step 1: Create the route**

Write `app/api/pool/[slug]/save-as-group/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { backfillPeopleForPool } from "@/lib/people";
import { createGroup } from "@/lib/groups";

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
    SELECT id FROM pools WHERE slug = ${params.slug} AND chairman_id = ${session.chairmanId}
  `;
  if (poolRows.length === 0) {
    return NextResponse.json({ error: "Pool not found" }, { status: 404 });
  }
  const poolId = poolRows[0].id as string;

  const body = await req.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }

  // Make sure every player has a person_id. Phase 1 already does this on pool reads,
  // but this endpoint is called directly so we run the backfill here too.
  await backfillPeopleForPool(sql, poolId);

  const memberRows = await sql`
    SELECT person_id FROM players WHERE pool_id = ${poolId} AND person_id IS NOT NULL
  `;
  const personIds = memberRows.map((r) => r.person_id as string);

  const group = await createGroup(sql, session.chairmanId, name, personIds);
  return NextResponse.json({ group, memberCount: personIds.length });
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add app/api/pool/[slug]/save-as-group/route.ts
git commit -m "feat(payments): add POST /api/pool/[slug]/save-as-group

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Protect Phase 2 paths in `middleware.ts`

**Files:**
- Modify: `middleware.ts`

- [ ] **Step 1: Update the matcher**

Find the `matcher` array (currently 14 entries from Phase 1). Replace it with this 17-entry version, which adds `/groups`, `/api/groups`, and `/api/pool/:slug/save-as-group`:

```typescript
export const config = {
  matcher: [
    "/dashboard/:path*",
    "/account/:path*",
    "/admin/:path*",
    "/groups/:path*",
    "/pool/:slug/setup/:path*",
    "/pool/:slug/scores/:path*",
    "/pool/:slug/players/:path*",
    "/api/pools/:path*",
    "/api/admin/:path*",
    "/api/groups/:path*",
    "/api/pool/:slug/setup/:path*",
    "/api/pool/:slug/scores/:path*",
    "/api/pool/:slug/sync/:path*",
    "/api/pool/:slug/people/:path*",
    "/api/pool/:slug/collection-requests/:path*",
    "/api/pool/:slug/save-as-group/:path*",
    "/api/people/:path*",
  ],
};
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add middleware.ts
git commit -m "feat(payments): protect /groups and /api/groups in middleware

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Add "My Groups" link to the dashboard

**Files:**
- Modify: `app/dashboard/page.tsx`

The dashboard already has a "My Pools" heading area. We add a small "My Groups" pill/link next to or just below the My Pools header. We won't restructure the page.

- [ ] **Step 1: Locate the dashboard header**

Open `app/dashboard/page.tsx` and find the heading where "My Pools" is rendered (search the file for `"My Pools"` or similar — it's near the top of the rendered JSX). Note the surrounding markup so the new link blends in.

- [ ] **Step 2: Insert a "My Groups" link near the heading**

The exact insertion point depends on the current dashboard layout. The intent: add a small inline link styled as `text-sm font-semibold text-tp-primary` near the page heading. A typical pattern:

```tsx
<Link
  href="/groups"
  className="text-sm font-semibold text-tp-primary active:underline"
>
  My Groups &rarr;
</Link>
```

Place this near the "My Pools" header. If the dashboard already has a row of small action links there, append this one to that row. Otherwise place it just below the heading in its own line.

Self-review check: the link should not break the existing layout (no flex changes, no parent re-layout). If you find the current dashboard layout would require restructuring to make the link blend in cleanly, STOP and report DONE_WITH_CONCERNS — the integration is bigger than a one-line add.

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add app/dashboard/page.tsx
git commit -m "feat(payments): add My Groups link to dashboard

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: `/groups` page (list + create + import from past pools)

**Files:**
- Create: `app/groups/page.tsx`

The page lists the chairman's groups and offers two ways to create one: by typing a name (creates an empty group), or by selecting a past pool to import (calls `POST /api/pool/[slug]/save-as-group`).

- [ ] **Step 1: Create the page**

Write `app/groups/page.tsx`:

```typescript
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { GroupSummary } from "@/lib/types";

interface PoolSummary {
  id: string;
  slug: string;
  pool_name: string;
  player_count: number;
}

export default function GroupsPage() {
  const router = useRouter();
  const [groups, setGroups] = useState<GroupSummary[] | null>(null);
  const [pools, setPools] = useState<PoolSummary[]>([]);
  const [newGroupName, setNewGroupName] = useState("");
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const [gRes, pRes] = await Promise.all([
      fetch("/api/groups"),
      fetch("/api/pools"),
    ]);
    if (gRes.ok) {
      const data = await gRes.json();
      setGroups(data.groups);
    } else {
      setGroups([]);
    }
    if (pRes.ok) {
      const pools = (await pRes.json()) as PoolSummary[];
      setPools(pools);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleCreateEmpty() {
    const name = newGroupName.trim();
    if (!name) return;
    setCreating(true);
    setError("");
    const res = await fetch("/api/groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setCreating(false);
    if (!res.ok) { setError("Could not create group. Try again."); return; }
    const data = await res.json();
    router.push(`/groups/${data.group.id}`);
  }

  async function handleImportPool(pool: PoolSummary) {
    setImporting(pool.slug);
    setError("");
    const res = await fetch(`/api/pool/${pool.slug}/save-as-group`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: pool.pool_name }),
    });
    setImporting(null);
    if (!res.ok) { setError(`Could not import ${pool.pool_name}. Try again.`); return; }
    await load();
  }

  return (
    <main className="px-4 pt-4 pb-12 max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-4 -mt-1">
        <img src="/logo.png" alt="TourneyPools" className="h-12" />
        <Link href="/dashboard" className="text-xs text-tp-primary font-semibold active:underline">
          My Pools
        </Link>
      </div>

      <h1 className="font-serif text-2xl font-bold text-tp-primary mb-1">My Groups</h1>
      <p className="text-xs text-gray-400 mb-5">
        A group is a saved set of players. Reuse them when you start a new pool so you don&rsquo;t retype names every time.
      </p>

      {/* Existing groups list */}
      {groups === null ? (
        <p className="font-serif italic text-tp-primary/60 text-sm">Loading...</p>
      ) : groups.length === 0 ? (
        <p className="text-sm text-gray-500 mb-6">You don&rsquo;t have any groups yet.</p>
      ) : (
        <div className="space-y-2 mb-6">
          {groups.map((g) => (
            <Link
              key={g.id}
              href={`/groups/${g.id}`}
              className="flex items-center justify-between bg-white border border-tp-bg-dark rounded-xl px-4 py-3.5 active:bg-tp-bg/60 transition-colors"
            >
              <span className="font-semibold text-gray-900 truncate">{g.name}</span>
              <span className="text-xs text-gray-500 flex-shrink-0 ml-2">{g.memberCount} {g.memberCount === 1 ? "player" : "players"}</span>
            </Link>
          ))}
        </div>
      )}

      {/* Create empty group */}
      <div className="bg-white rounded-2xl p-4 mb-4">
        <h2 className="font-serif text-base font-bold text-tp-primary mb-2">Create a new group</h2>
        <div className="flex gap-2">
          <input
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            placeholder="e.g. Blue Rock Mafia"
            className="input-field flex-1"
            aria-label="New group name"
          />
          <button
            type="button"
            onClick={handleCreateEmpty}
            disabled={creating || !newGroupName.trim()}
            className="btn-gold disabled:opacity-60"
          >
            Create
          </button>
        </div>
      </div>

      {/* Import from past pools */}
      {pools.length > 0 && (
        <div className="bg-white rounded-2xl p-4 mb-4">
          <h2 className="font-serif text-base font-bold text-tp-primary mb-1">Start from a pool</h2>
          <p className="text-xs text-gray-500 mb-3">
            Turn one of your pools into a group so you can reuse the same players next time.
          </p>
          <div className="space-y-2">
            {pools.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => handleImportPool(p)}
                disabled={importing === p.slug}
                className="w-full flex items-center justify-between bg-tp-bg rounded-xl px-3 py-2.5 active:bg-tp-bg-dark transition-colors disabled:opacity-60"
              >
                <span className="font-medium text-gray-800 truncate text-sm">{p.pool_name}</span>
                <span className="text-xs text-tp-primary font-semibold flex-shrink-0 ml-2">
                  {importing === p.slug ? "Importing..." : `Import (${p.player_count})`}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {error && <p className="text-xs text-red-600 mt-3">{error}</p>}
    </main>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add app/groups/page.tsx
git commit -m "feat(payments): add /groups list page with create + import

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 11: `/groups/[id]` page (edit)

**Files:**
- Create: `app/groups/[id]/page.tsx`

The page shows the group's name (editable in place), the member list, and inputs to add a new member (by typed name) or remove an existing one. Each member shows their primary handle status (read-only here — handle edits live in the per-pool Players tab, since this page is about group membership not handle management).

- [ ] **Step 1: Create the page**

Write `app/groups/[id]/page.tsx`:

```typescript
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { GroupWithMembers, PaymentMethod, Person } from "@/lib/types";

const METHOD_LABEL: Record<PaymentMethod, string> = {
  venmo: "Venmo",
  cashapp: "Cash App",
  paypal: "PayPal",
};

function preferredHandle(p: Person): { method: PaymentMethod; handle: string } | null {
  const order: PaymentMethod[] = p.preferredMethod
    ? [p.preferredMethod, "venmo", "cashapp", "paypal"]
    : ["venmo", "cashapp", "paypal"];
  for (const m of order) {
    const value =
      m === "venmo" ? p.venmoHandle
      : m === "cashapp" ? p.cashappHandle
      : p.paypalHandle;
    if (value) return { method: m, handle: value };
  }
  return null;
}

export default function GroupEditPage() {
  const { id } = useParams();
  const groupId = id as string;
  const router = useRouter();
  const [group, setGroup] = useState<GroupWithMembers | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [newMemberName, setNewMemberName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const res = await fetch(`/api/groups/${groupId}`);
    if (!res.ok) {
      if (res.status === 404) router.push("/groups");
      setError("Could not load group.");
      return;
    }
    const data = await res.json();
    setGroup(data.group);
    setNameDraft(data.group.name);
  }, [groupId, router]);

  useEffect(() => { load(); }, [load]);

  async function handleRename() {
    const name = nameDraft.trim();
    if (!name || !group || name === group.name) {
      setEditingName(false);
      setNameDraft(group?.name ?? "");
      return;
    }
    setSaving(true);
    setError("");
    const res = await fetch(`/api/groups/${groupId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setSaving(false);
    if (!res.ok) { setError("Could not rename group."); return; }
    setEditingName(false);
    await load();
  }

  async function handleAddMember() {
    const name = newMemberName.trim();
    if (!name) return;
    setSaving(true);
    setError("");
    const res = await fetch(`/api/groups/${groupId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setSaving(false);
    if (!res.ok) { setError("Could not add member."); return; }
    setNewMemberName("");
    await load();
  }

  async function handleRemoveMember(personId: string) {
    setSaving(true);
    setError("");
    const res = await fetch(`/api/groups/${groupId}/members/${personId}`, {
      method: "DELETE",
    });
    setSaving(false);
    if (!res.ok) { setError("Could not remove member."); return; }
    await load();
  }

  async function handleDeleteGroup() {
    if (!group) return;
    if (!confirm(`Delete the group "${group.name}"? This won't delete the players themselves.`)) return;
    setSaving(true);
    const res = await fetch(`/api/groups/${groupId}`, { method: "DELETE" });
    setSaving(false);
    if (!res.ok) { setError("Could not delete group."); return; }
    router.push("/groups");
  }

  if (group === null && !error) {
    return (
      <main className="px-4 pt-10 max-w-lg mx-auto">
        <p className="font-serif italic text-tp-primary/60 text-sm text-center">Loading...</p>
      </main>
    );
  }

  if (!group) {
    return (
      <main className="px-4 pt-10 max-w-lg mx-auto text-center">
        <p className="text-sm text-gray-500">{error || "Group not found."}</p>
        <Link href="/groups" className="text-sm text-tp-primary font-semibold mt-3 inline-block">
          Back to groups
        </Link>
      </main>
    );
  }

  return (
    <main className="px-4 pt-4 pb-12 max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-4 -mt-1">
        <img src="/logo.png" alt="TourneyPools" className="h-12" />
        <Link href="/groups" className="text-xs text-tp-primary font-semibold active:underline">
          All groups
        </Link>
      </div>

      {/* Editable name */}
      {editingName ? (
        <div className="flex gap-2 mb-1">
          <input
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            className="input-field flex-1"
            autoFocus
            aria-label="Group name"
          />
          <button type="button" onClick={handleRename} disabled={saving} className="btn-gold">
            Save
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setEditingName(true)}
          className="text-left w-full mb-1"
        >
          <h1 className="font-serif text-2xl font-bold text-tp-primary leading-tight inline-flex items-center gap-2">
            {group.name}
            <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </h1>
        </button>
      )}
      <p className="text-xs text-gray-400 mb-5">
        {group.members.length} {group.members.length === 1 ? "player" : "players"}
      </p>

      {/* Member list */}
      <div className="space-y-2 mb-4">
        {group.members.map((m) => {
          const handle = preferredHandle(m);
          return (
            <div
              key={m.id}
              className="flex items-center justify-between bg-white border border-tp-bg-dark rounded-xl px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-gray-900 truncate">{m.name}</p>
                {handle ? (
                  <p className="text-xs text-gray-500 truncate mt-0.5">
                    {METHOD_LABEL[handle.method]} &middot; @{handle.handle}
                  </p>
                ) : (
                  <p className="text-xs text-gray-400 mt-0.5">No handle on file</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => handleRemoveMember(m.id)}
                disabled={saving}
                className="text-xs text-red-400 font-semibold active:text-red-600 ml-2 flex-shrink-0 disabled:opacity-50"
                aria-label={`Remove ${m.name} from group`}
              >
                Remove
              </button>
            </div>
          );
        })}
      </div>

      {/* Add member */}
      <div className="bg-white rounded-2xl p-4 mb-4">
        <h2 className="font-serif text-base font-bold text-tp-primary mb-2">Add a player</h2>
        <div className="flex gap-2">
          <input
            value={newMemberName}
            onChange={(e) => setNewMemberName(e.target.value)}
            placeholder="Player name"
            className="input-field flex-1"
            aria-label="New member name"
          />
          <button
            type="button"
            onClick={handleAddMember}
            disabled={saving || !newMemberName.trim()}
            className="btn-gold disabled:opacity-60"
          >
            Add
          </button>
        </div>
        <p className="text-[11px] text-gray-400 mt-2">
          If the name matches an existing player you&rsquo;ve added before, their saved handles come with them.
        </p>
      </div>

      <button
        type="button"
        onClick={handleDeleteGroup}
        disabled={saving}
        className="w-full py-3 rounded-xl text-sm font-semibold text-red-500 border border-red-100 active:bg-red-50 disabled:opacity-50"
      >
        Delete group
      </button>

      {error && <p className="text-xs text-red-600 mt-3 text-center">{error}</p>}
    </main>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add app/groups/[id]/page.tsx
git commit -m "feat(payments): add /groups/[id] edit page

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 12: Setup wizard — "Use a group" picker in the Players step

**Files:**
- Modify: `app/pool/[slug]/setup/page.tsx`

Add a small picker above the typed-name list. If the chairman has at least one group, show a select. Choosing a group replaces the current name list with that group's members (the chairman can then edit/remove names inline before continuing). If the chairman has no groups, the picker doesn't render (no clutter for first-time chairmen).

- [ ] **Step 1: Add state for groups and the current selection**

Open `app/pool/[slug]/setup/page.tsx`. Near the other `useState` declarations at the top of the component (search for `const [players, setPlayers]`), add:

```typescript
  const [groups, setGroups] = useState<{ id: string; name: string; memberCount: number }[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
```

- [ ] **Step 2: Fetch the chairman's groups on mount**

Find the existing `useEffect` that loads pool data. Add a second `useEffect` immediately after it that fetches groups:

```typescript
  useEffect(() => {
    fetch("/api/groups")
      .then((r) => (r.ok ? r.json() : { groups: [] }))
      .then((data) => setGroups(data.groups || []));
  }, []);
```

- [ ] **Step 3: Add the loader function**

Just before the `return` JSX (alongside other top-level helpers like `addPlayer`), add:

```typescript
  async function loadFromGroup(groupId: string) {
    setSelectedGroupId(groupId);
    if (!groupId) return;
    const res = await fetch(`/api/groups/${groupId}`);
    if (!res.ok) return;
    const data = await res.json();
    const members: { id: string; name: string }[] = (data.group?.members ?? []).map(
      (m: { name: string }, i: number) => ({ id: `g-${groupId}-${i}`, name: m.name }),
    );
    if (members.length > 0) setPlayers(members);
  }
```

- [ ] **Step 4: Render the picker in the Players step**

Find the `Section label={\`Players (${validPlayers.length})\`}` block. Immediately INSIDE that Section, BEFORE the `<div className="space-y-2.5">` that maps players, insert:

```tsx
              {groups.length > 0 && (
                <div className="mb-3">
                  <label className="block text-[11px] uppercase tracking-wider text-gray-400 font-semibold mb-1.5">
                    Start from a group (optional)
                  </label>
                  <select
                    value={selectedGroupId}
                    onChange={(e) => loadFromGroup(e.target.value)}
                    className="input-field"
                    aria-label="Use a saved group"
                  >
                    <option value="">Type players manually</option>
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name} ({g.memberCount})
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-gray-400 mt-1">
                    Picking a group fills the list below. You can still edit names before continuing.
                  </p>
                </div>
              )}
```

- [ ] **Step 5: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add app/pool/[slug]/setup/page.tsx
git commit -m "feat(payments): add 'Use a group' picker to setup wizard

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 13: Players tab — "Save roster as a group" button

**Files:**
- Modify: `app/pool/[slug]/players/page.tsx`

A button below the player list. Clicking it opens a small inline dialog (we'll use the same modal pattern as `CollectDialog`) that asks for a group name, defaults to the pool name. On submit, calls `POST /api/pool/[slug]/save-as-group`.

- [ ] **Step 1: Add state and handler**

Open `app/pool/[slug]/players/page.tsx`. Near the existing `useState` declarations in `PlayersTabPage`, add:

```typescript
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [savingGroup, setSavingGroup] = useState(false);
  const [groupSaved, setGroupSaved] = useState<string | null>(null);
```

Below the existing `load` callback, add:

```typescript
  async function handleSaveAsGroup() {
    const name = groupName.trim();
    if (!name) return;
    setSavingGroup(true);
    const res = await fetch(`/api/pool/${slugStr}/save-as-group`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setSavingGroup(false);
    if (!res.ok) return;
    setGroupSaved(name);
    setGroupDialogOpen(false);
  }
```

- [ ] **Step 2: Add the button and dialog**

At the end of the page's main render (just before the closing `</div>` of the outermost wrapper, after the modal `{openPlayer && <CollectDialog ... />}` block), insert:

```tsx
      {/* Save as group action */}
      <div className="mt-8">
        <div className="gold-rule mb-4" />
        <button
          type="button"
          onClick={() => {
            setGroupName("");
            setGroupSaved(null);
            setGroupDialogOpen(true);
          }}
          className="w-full py-3 rounded-xl text-sm font-semibold text-tp-primary border border-tp-bg-dark active:bg-tp-bg/60"
        >
          Save roster as a group
        </button>
        {groupSaved && (
          <p className="text-xs text-tp-accent mt-2 text-center">
            Saved {groupSaved} to <a href="/groups" className="font-semibold underline">My Groups</a>.
          </p>
        )}
      </div>

      {groupDialogOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center px-3 pb-3 sm:pb-0"
          onClick={() => setGroupDialogOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Save roster as a group"
        >
          <div className="w-full max-w-md bg-white rounded-2xl p-5 shadow-card-lg" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-serif text-xl font-bold text-tp-primary mb-1">Save roster as a group</h2>
            <p className="text-xs text-gray-500 mb-4">Reuse these players next time you start a pool.</p>
            <input
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="e.g. Blue Rock Mafia"
              className="input-field mb-3"
              aria-label="Group name"
              autoFocus
            />
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setGroupDialogOpen(false)}
                className="py-3 rounded-xl text-sm font-semibold border border-tp-bg-dark text-gray-600 active:bg-tp-bg/60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveAsGroup}
                disabled={savingGroup || !groupName.trim()}
                className="btn-gold disabled:opacity-60"
              >
                {savingGroup ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add app/pool/[slug]/players/page.tsx
git commit -m "feat(payments): add 'Save roster as a group' to Players tab

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 14: Build, lint, and end-to-end smoke verification

This is verification only — no commit.

- [ ] **Step 1: Build**

```bash
npm run build
```

Expected: no errors. Confirm the new routes are present in Next.js's listing:
- `λ /api/groups`
- `λ /api/groups/[id]`
- `λ /api/groups/[id]/members`
- `λ /api/groups/[id]/members/[personId]`
- `λ /api/pool/[slug]/save-as-group`
- `○ /groups` (or `ƒ` depending on Next.js version)
- `ƒ /groups/[id]`

- [ ] **Step 2: TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Happy-path walkthrough (manual)**

As a chairman in dev:

1. Visit `/dashboard`. Confirm the "My Groups" link is present.
2. Click it to open `/groups`. List is empty initially.
3. In "Start from a pool", import one of your existing pools as a group. Confirm it appears in the list with the right player count.
4. Open the imported group. Rename it, add a member by typed name, remove a member. Confirm each operation persists across a page refresh.
5. Create a brand-new pool from `/dashboard`. In the setup wizard's Players step, you should now see a "Start from a group (optional)" picker above the name list (because you have a group now). Pick a group. Confirm the name list populates with the group's members.
6. Finish the wizard. On the new pool, open the Players tab. Members from the imported group should show their saved handles (proving the Person reuse via `findOrCreatePerson`).
7. On the Players tab, click "Save roster as a group". Name it something new. Confirm it appears in `/groups` with the right count.
8. Delete a group from `/groups/[id]`. Confirm it's gone. Confirm the People in that group are NOT deleted (visit any pool that used them — they still show with their handles).

- [ ] **Step 4: Optional `psql` integrity check**

```bash
psql "$(grep '^DATABASE_URL' .env.local | sed 's/^DATABASE_URL=//' | tr -d '"' )" -c "SELECT COUNT(*) FROM groups; SELECT COUNT(*) FROM group_members;"
```

Confirm the counts make sense relative to what you did in the walkthrough.

---

## Spec coverage check

| Spec section | Implemented in task |
|---|---|
| `groups` and `group_members` tables | 1 |
| Roster building: type names | Already in Phase 1 (no change) |
| Roster building: use a group | 12 |
| Roster building: edit a group, then use it | 11 (edit) + 12 (use) |
| Save roster as a group | 7 (API) + 13 (UI) |
| Groups manager from dashboard | 9 (link) + 10 (list page) + 11 (edit page) |
| Seed groups from past pools | 10 (`/groups` page "Start from a pool" section) |
| Group deletion preserves People | 3 (`lib/groups.deleteGroup`) + 5 (DELETE route) |
| Removing a member from a group preserves the Person | 3 (`removeMemberFromGroup`) + 6 (DELETE route) |
| `Group`, `GroupSummary`, `GroupWithMembers` types | 2 |
| Phase 3 (one-tap pay) | Deferred (out of scope) |
| Autocomplete to pick existing People individually | Deferred (out of scope per spec) |
