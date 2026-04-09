# Multi-Pool Neon Postgres + Odds API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert single-pool JSON file app to multi-tenant platform with Neon Postgres, chairman accounts, invite-link pools, and automatic score sync from The Odds API.

**Architecture:** Next.js 14 App Router with Neon serverless Postgres (HTTP driver). Auth via bcrypt + JWT in HTTP-only cookies. Existing `lib/pool.ts` business logic preserved. UI pages restructured under `/pool/[slug]/` dynamic routes. Odds API polled via Vercel Cron + manual refresh.

**Tech Stack:** Next.js 14, @neondatabase/serverless, bcryptjs, jose, nanoid, Tailwind CSS

---

## File Map

### New Files
- `lib/db.ts` — Neon connection + query helper
- `lib/db-seed.sql` — Schema creation DDL
- `lib/auth.ts` — JWT create/verify, password hash/compare, getSession helper
- `lib/odds-api.ts` — Odds API client, score parser, golfer matcher, sync logic
- `middleware.ts` — Next.js middleware for cookie-based route protection
- `app/page.tsx` — Landing page (replaces current leaderboard at root)
- `app/signup/page.tsx` — Chairman signup form
- `app/login/page.tsx` — Chairman login form
- `app/dashboard/page.tsx` — Pool list + create pool
- `app/pool/[slug]/page.tsx` — Public leaderboard (moved from `app/page.tsx`)
- `app/pool/[slug]/setup/page.tsx` — Setup wizard (moved from `app/setup/page.tsx`)
- `app/pool/[slug]/scores/page.tsx` — Score entry (moved from `app/scores/page.tsx`)
- `app/pool/[slug]/layout.tsx` — Pool-scoped layout with contextual bottom nav
- `app/api/auth/signup/route.ts` — Create chairman account
- `app/api/auth/login/route.ts` — Login chairman
- `app/api/auth/logout/route.ts` — Clear session cookie
- `app/api/auth/me/route.ts` — Get current session
- `app/api/pools/route.ts` — Create pool (POST), list my pools (GET)
- `app/api/pool/[slug]/route.ts` — Get assembled pool config (public)
- `app/api/pool/[slug]/setup/route.ts` — Save pool setup
- `app/api/pool/[slug]/scores/route.ts` — Update golfer score
- `app/api/pool/[slug]/sync/route.ts` — Trigger Odds API sync
- `app/api/cron/sync-scores/route.ts` — Cron endpoint for all pools

### Modified Files
- `package.json` — Add new dependencies
- `lib/types.ts` — Add `manualOverride`, `oddsApiId` to Golfer; keep rest intact
- `lib/pool.ts` — No changes (operates on same PoolConfig shape)
- `app/layout.tsx` — Remove bottom nav (moved to pool layout), keep fonts/globals
- `app/globals.css` — No changes
- `tailwind.config.ts` — No changes
- `vercel.json` — Add cron schedule

### Deleted Files
- `lib/store.ts` — Replaced by `lib/db.ts`
- `app/api/auth/route.ts` — Replaced by signup/login/logout routes
- `app/api/pool/route.ts` — Replaced by `app/api/pool/[slug]/route.ts`
- `app/api/setup/route.ts` — Replaced by `app/api/pool/[slug]/setup/route.ts`
- `app/api/scores/route.ts` — Replaced by `app/api/pool/[slug]/scores/route.ts`
- `app/setup/page.tsx` — Moved to `app/pool/[slug]/setup/page.tsx`
- `app/scores/page.tsx` — Moved to `app/pool/[slug]/scores/page.tsx`

---

### Task 1: Install Dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install new packages**

```bash
npm install @neondatabase/serverless bcryptjs jose nanoid@3
npm install -D @types/bcryptjs
```

We use `nanoid@3` because v3 supports CommonJS require which Next.js 14 needs.

- [ ] **Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "deps: add neon serverless, bcryptjs, jose, nanoid"
```

---

### Task 2: Database Schema

**Files:**
- Create: `lib/db-seed.sql`
- Create: `lib/db.ts`

- [ ] **Step 1: Write the schema DDL**

Create `lib/db-seed.sql`:

```sql
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE chairmen (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE pools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  chairman_id UUID NOT NULL REFERENCES chairmen(id),
  pool_name TEXT NOT NULL,
  buy_in INTEGER NOT NULL DEFAULT 20,
  settings JSONB NOT NULL DEFAULT '{}',
  setup_complete BOOLEAN DEFAULT false,
  tournament_id TEXT,
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id UUID NOT NULL REFERENCES pools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  pick_order INTEGER
);

CREATE TABLE golfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id UUID NOT NULL REFERENCES pools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  r1 INTEGER,
  r2 INTEGER,
  r3 INTEGER,
  r4 INTEGER,
  made_cut BOOLEAN,
  odds_api_id TEXT,
  manual_override BOOLEAN DEFAULT false
);

CREATE TABLE assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id UUID NOT NULL REFERENCES pools(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  golfer_id UUID NOT NULL REFERENCES golfers(id) ON DELETE CASCADE,
  pick_number INTEGER NOT NULL
);

CREATE INDEX idx_pools_slug ON pools(slug);
CREATE INDEX idx_pools_chairman ON pools(chairman_id);
CREATE INDEX idx_players_pool ON players(pool_id);
CREATE INDEX idx_golfers_pool ON golfers(pool_id);
CREATE INDEX idx_assignments_pool ON assignments(pool_id);
CREATE INDEX idx_chairmen_email ON chairmen(email);
```

- [ ] **Step 2: Write the Neon database helper**

Create `lib/db.ts`:

```typescript
import { neon } from "@neondatabase/serverless";

export function getDb() {
  const sql = neon(process.env.DATABASE_URL!);
  return sql;
}
```

- [ ] **Step 3: Run the schema against your Neon database**

Go to the Neon console (console.neon.tech), open the SQL editor for your database, paste the contents of `lib/db-seed.sql`, and run it.

Alternatively, if you have `psql` locally:

```bash
psql "$DATABASE_URL" -f lib/db-seed.sql
```

- [ ] **Step 4: Commit**

```bash
git add lib/db-seed.sql lib/db.ts
git commit -m "feat: add Neon Postgres schema and db helper"
```

---

### Task 3: Auth Library

**Files:**
- Create: `lib/auth.ts`

- [ ] **Step 1: Write auth helpers**

Create `lib/auth.ts`:

```typescript
import { compare, hash } from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "dev-secret-change-me");
const COOKIE_NAME = "masters_session";

export interface SessionPayload {
  chairmanId: string;
  email: string;
  name: string;
}

export async function hashPassword(password: string): Promise<string> {
  return hash(password, 12);
}

export async function verifyPassword(password: string, hashed: string): Promise<boolean> {
  return compare(password, hashed);
}

export async function createToken(payload: SessionPayload): Promise<string> {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .sign(JWT_SECRET);
}

export async function verifyToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export function setSessionCookie(token: string) {
  cookies().set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: "/",
  });
}

export function clearSessionCookie() {
  cookies().set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookie = cookies().get(COOKIE_NAME);
  if (!cookie?.value) return null;
  return verifyToken(cookie.value);
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/auth.ts
git commit -m "feat: add JWT auth helpers (bcrypt, jose)"
```

---

### Task 4: Update Types

**Files:**
- Modify: `lib/types.ts`

- [ ] **Step 1: Add new fields to Golfer interface**

In `lib/types.ts`, update the `Golfer` interface to add `oddsApiId` and `manualOverride`:

```typescript
export interface Golfer {
  id: string;
  name: string;
  r1: number | null;
  r2: number | null;
  r3: number | null;
  r4: number | null;
  madeCut: boolean | null;
  oddsApiId?: string | null;
  manualOverride?: boolean;
}
```

These are optional so existing `computeLeaderboard` logic in `lib/pool.ts` continues working without changes.

- [ ] **Step 2: Commit**

```bash
git add lib/types.ts
git commit -m "feat: add oddsApiId and manualOverride to Golfer type"
```

---

### Task 5: Auth API Routes

**Files:**
- Create: `app/api/auth/signup/route.ts`
- Create: `app/api/auth/login/route.ts`
- Create: `app/api/auth/logout/route.ts`
- Create: `app/api/auth/me/route.ts`
- Delete: `app/api/auth/route.ts`

- [ ] **Step 1: Write signup route**

Create `app/api/auth/signup/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { hashPassword, createToken, setSessionCookie } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { email, password, name } = await req.json();

  if (!email || !password || !name) {
    return NextResponse.json({ error: "All fields required" }, { status: 400 });
  }

  const sql = getDb();
  const existing = await sql`SELECT id FROM chairmen WHERE email = ${email.toLowerCase()}`;
  if (existing.length > 0) {
    return NextResponse.json({ error: "Email already registered" }, { status: 409 });
  }

  const hashed = await hashPassword(password);
  const result = await sql`
    INSERT INTO chairmen (email, password, name)
    VALUES (${email.toLowerCase()}, ${hashed}, ${name})
    RETURNING id, email, name
  `;

  const chairman = result[0];
  const token = await createToken({
    chairmanId: chairman.id,
    email: chairman.email,
    name: chairman.name,
  });

  setSessionCookie(token);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Write login route**

Create `app/api/auth/login/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyPassword, createToken, setSessionCookie } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password required" }, { status: 400 });
  }

  const sql = getDb();
  const result = await sql`
    SELECT id, email, password, name FROM chairmen WHERE email = ${email.toLowerCase()}
  `;

  if (result.length === 0) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const chairman = result[0];
  const valid = await verifyPassword(password, chairman.password);
  if (!valid) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const token = await createToken({
    chairmanId: chairman.id,
    email: chairman.email,
    name: chairman.name,
  });

  setSessionCookie(token);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Write logout route**

Create `app/api/auth/logout/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth";

export async function POST() {
  clearSessionCookie();
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Write session check route**

Create `app/api/auth/me/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(null);
  }
  return NextResponse.json(session);
}
```

- [ ] **Step 5: Delete old auth route**

```bash
rm app/api/auth/route.ts
```

- [ ] **Step 6: Commit**

```bash
git add app/api/auth/
git commit -m "feat: add signup, login, logout, me auth routes"
```

---

### Task 6: Middleware for Route Protection

**Files:**
- Create: `middleware.ts` (project root)

- [ ] **Step 1: Write the middleware**

Create `middleware.ts` in the project root:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "dev-secret-change-me");
const COOKIE_NAME = "masters_session";

const PROTECTED_PATHS = ["/dashboard"];
const CHAIRMAN_API_PATHS = ["/api/pools", "/api/pool/"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Check if path needs auth
  const needsAuth =
    PROTECTED_PATHS.some((p) => pathname.startsWith(p)) ||
    (CHAIRMAN_API_PATHS.some((p) => pathname.startsWith(p)) && req.method !== "GET");

  // Pool setup/scores pages need auth
  const isPoolAdmin =
    pathname.match(/^\/pool\/[^/]+\/(setup|scores)/) !== null;

  if (!needsAuth && !isPoolAdmin) {
    return NextResponse.next();
  }

  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", req.url));
  }

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set("x-chairman-id", payload.chairmanId as string);
    return NextResponse.next({ request: { headers: requestHeaders } });
  } catch {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", req.url));
  }
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/pool/:slug/setup/:path*",
    "/pool/:slug/scores/:path*",
    "/api/pools/:path*",
    "/api/pool/:slug/setup/:path*",
    "/api/pool/:slug/scores/:path*",
    "/api/pool/:slug/sync/:path*",
  ],
};
```

- [ ] **Step 2: Commit**

```bash
git add middleware.ts
git commit -m "feat: add route protection middleware"
```

---

### Task 7: Pool CRUD API Routes

**Files:**
- Create: `app/api/pools/route.ts`
- Create: `app/api/pool/[slug]/route.ts`
- Delete: `app/api/pool/route.ts`

- [ ] **Step 1: Write create/list pools route**

Create `app/api/pools/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { nanoid } from "nanoid";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sql = getDb();
  const pools = await sql`
    SELECT id, slug, pool_name, buy_in, setup_complete, created_at,
           (SELECT COUNT(*) FROM players WHERE pool_id = pools.id) as player_count
    FROM pools
    WHERE chairman_id = ${session.chairmanId}
    ORDER BY created_at DESC
  `;

  return NextResponse.json(pools);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { poolName } = await req.json();
  const slug = nanoid(10);

  const sql = getDb();
  await sql`
    INSERT INTO pools (slug, chairman_id, pool_name)
    VALUES (${slug}, ${session.chairmanId}, ${poolName || 'My Masters Pool'})
  `;

  return NextResponse.json({ slug });
}
```

- [ ] **Step 2: Write get pool config route (public)**

Create `app/api/pool/[slug]/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { PoolConfig, ChairmanSettings } from "@/lib/types";

export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  const sql = getDb();

  const poolRows = await sql`
    SELECT id, slug, pool_name, buy_in, settings, setup_complete, chairman_id, last_sync_at
    FROM pools WHERE slug = ${params.slug}
  `;
  if (poolRows.length === 0) {
    return NextResponse.json(null, { status: 404 });
  }

  const pool = poolRows[0];

  const players = await sql`
    SELECT id, name FROM players WHERE pool_id = ${pool.id} ORDER BY pick_order
  `;

  const golfers = await sql`
    SELECT id, name, r1, r2, r3, r4, made_cut, odds_api_id, manual_override
    FROM golfers WHERE pool_id = ${pool.id} ORDER BY name
  `;

  const assignments = await sql`
    SELECT id, player_id, golfer_id, pick_number
    FROM assignments WHERE pool_id = ${pool.id} ORDER BY pick_number
  `;

  const config: PoolConfig = {
    poolName: pool.pool_name,
    players: players.map((p) => ({ id: p.id, name: p.name })),
    golfers: golfers.map((g) => ({
      id: g.id,
      name: g.name,
      r1: g.r1,
      r2: g.r2,
      r3: g.r3,
      r4: g.r4,
      madeCut: g.made_cut,
      oddsApiId: g.odds_api_id,
      manualOverride: g.manual_override,
    })),
    buyIn: pool.buy_in,
    settings: pool.settings as ChairmanSettings,
    setupComplete: pool.setup_complete,
    assignments: assignments.map((a) => ({
      playerId: a.player_id,
      golferId: a.golfer_id,
      pickNumber: a.pick_number,
    })),
  };

  // Include chairman_id and last_sync_at as extra fields for the UI
  return NextResponse.json({
    ...config,
    chairmanId: pool.chairman_id,
    lastSyncAt: pool.last_sync_at,
  });
}
```

- [ ] **Step 3: Delete old pool route**

```bash
rm app/api/pool/route.ts
```

- [ ] **Step 4: Commit**

```bash
git add app/api/pools/ app/api/pool/
git commit -m "feat: add pool CRUD API routes with Neon Postgres"
```

---

### Task 8: Pool Setup API Route

**Files:**
- Create: `app/api/pool/[slug]/setup/route.ts`
- Delete: `app/api/setup/route.ts`

- [ ] **Step 1: Write setup route**

Create `app/api/pool/[slug]/setup/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { draftGolfers } from "@/lib/pool";

export async function POST(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sql = getDb();

  // Verify ownership
  const poolRows = await sql`
    SELECT id FROM pools
    WHERE slug = ${params.slug} AND chairman_id = ${session.chairmanId}
  `;
  if (poolRows.length === 0) {
    return NextResponse.json({ error: "Pool not found" }, { status: 404 });
  }
  const poolId = poolRows[0].id;

  const body = await req.json();
  const { poolName, players, golferNames, buyIn, settings } = body;

  // Clear existing data for re-setup
  await sql`DELETE FROM assignments WHERE pool_id = ${poolId}`;
  await sql`DELETE FROM golfers WHERE pool_id = ${poolId}`;
  await sql`DELETE FROM players WHERE pool_id = ${poolId}`;

  // Update pool settings
  await sql`
    UPDATE pools SET
      pool_name = ${poolName},
      buy_in = ${buyIn},
      settings = ${JSON.stringify(settings)},
      setup_complete = true
    WHERE id = ${poolId}
  `;

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

  // Insert golfers
  const insertedGolfers = [];
  for (let i = 0; i < golferNames.length; i++) {
    const result = await sql`
      INSERT INTO golfers (pool_id, name)
      VALUES (${poolId}, ${golferNames[i]})
      RETURNING id, name
    `;
    insertedGolfers.push({
      id: result[0].id,
      name: result[0].name,
      r1: null, r2: null, r3: null, r4: null,
      madeCut: null,
    });
  }

  // Run draft
  const draftResult = draftGolfers(insertedPlayers, insertedGolfers, settings.draftType);

  // Insert assignments
  for (const a of draftResult) {
    await sql`
      INSERT INTO assignments (pool_id, player_id, golfer_id, pick_number)
      VALUES (${poolId}, ${a.playerId}, ${a.golferId}, ${a.pickNumber})
    `;
  }

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Delete old setup route**

```bash
rm app/api/setup/route.ts
```

- [ ] **Step 3: Commit**

```bash
git add app/api/pool/[slug]/setup/ app/api/setup/
git commit -m "feat: add pool setup API with Postgres persistence"
```

---

### Task 9: Pool Scores API Route

**Files:**
- Create: `app/api/pool/[slug]/scores/route.ts`
- Delete: `app/api/scores/route.ts`

- [ ] **Step 1: Write scores route**

Create `app/api/pool/[slug]/scores/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function POST(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sql = getDb();

  // Verify ownership
  const poolRows = await sql`
    SELECT id FROM pools
    WHERE slug = ${params.slug} AND chairman_id = ${session.chairmanId}
  `;
  if (poolRows.length === 0) {
    return NextResponse.json({ error: "Pool not found" }, { status: 404 });
  }
  const poolId = poolRows[0].id;

  const { golferId, field, value } = await req.json();

  // Verify golfer belongs to this pool
  const golferRows = await sql`
    SELECT id FROM golfers WHERE id = ${golferId} AND pool_id = ${poolId}
  `;
  if (golferRows.length === 0) {
    return NextResponse.json({ error: "Golfer not found" }, { status: 404 });
  }

  if (field === "madeCut") {
    await sql`UPDATE golfers SET made_cut = ${value}, manual_override = true WHERE id = ${golferId}`;
  } else if (["r1", "r2", "r3", "r4"].includes(field)) {
    const numVal = value === "" || value === null ? null : Number(value);
    // Use dynamic column name safely via conditional updates
    if (field === "r1") await sql`UPDATE golfers SET r1 = ${numVal}, manual_override = true WHERE id = ${golferId}`;
    else if (field === "r2") await sql`UPDATE golfers SET r2 = ${numVal}, manual_override = true WHERE id = ${golferId}`;
    else if (field === "r3") await sql`UPDATE golfers SET r3 = ${numVal}, manual_override = true WHERE id = ${golferId}`;
    else if (field === "r4") await sql`UPDATE golfers SET r4 = ${numVal}, manual_override = true WHERE id = ${golferId}`;
  } else if (field === "manualOverride") {
    await sql`UPDATE golfers SET manual_override = ${value} WHERE id = ${golferId}`;
  }

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Delete old scores route**

```bash
rm app/api/scores/route.ts
```

- [ ] **Step 3: Commit**

```bash
git add app/api/pool/[slug]/scores/ app/api/scores/
git commit -m "feat: add pool scores API with per-golfer Postgres updates"
```

---

### Task 10: Odds API Integration

**Files:**
- Create: `lib/odds-api.ts`
- Create: `app/api/pool/[slug]/sync/route.ts`
- Create: `app/api/cron/sync-scores/route.ts`

- [ ] **Step 1: Write the Odds API client and sync logic**

Create `lib/odds-api.ts`:

```typescript
import { getDb } from "./db";

const ODDS_API_BASE = "https://api.the-odds-api.com/v4";

interface OddsApiScore {
  id: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  scores: { name: string; score: string }[] | null;
}

interface GolferScoreData {
  name: string;
  r1: number | null;
  r2: number | null;
  r3: number | null;
  r4: number | null;
  madeCut: boolean | null;
}

export async function fetchTournamentScores(): Promise<GolferScoreData[]> {
  const apiKey = process.env.THE_ODDS_API_KEY;
  if (!apiKey) throw new Error("THE_ODDS_API_KEY not set");

  // The Odds API golf scores endpoint
  // Sport key for golf: "golf_masters_tournament_winner" or similar
  // Check https://the-odds-api.com/sports-odds-data/golf-odds.html for exact key
  const res = await fetch(
    `${ODDS_API_BASE}/sports/golf_pga/scores/?apiKey=${apiKey}&daysFrom=3`,
    { cache: "no-store" }
  );

  if (!res.ok) {
    throw new Error(`Odds API error: ${res.status} ${await res.text()}`);
  }

  const data: OddsApiScore[] = await res.json();

  // Parse golfer scores from the API response
  // Note: The Odds API format for golf may vary. This is a best-effort parser.
  // You may need to adjust field mapping based on actual API response shape.
  const golferMap = new Map<string, GolferScoreData>();

  for (const event of data) {
    if (event.scores) {
      for (const s of event.scores) {
        // The score field format depends on the API — could be total, could be per-round
        // Parse what's available
        if (!golferMap.has(s.name)) {
          golferMap.set(s.name, {
            name: s.name,
            r1: null,
            r2: null,
            r3: null,
            r4: null,
            madeCut: null,
          });
        }
      }
    }
  }

  return Array.from(golferMap.values());
}

function normalizedName(name: string): string {
  return name.toLowerCase().replace(/[^a-z]/g, "");
}

export async function syncPoolScores(poolId: string): Promise<{ updated: number; unmatched: string[] }> {
  const scores = await fetchTournamentScores();
  const sql = getDb();

  const golfers = await sql`
    SELECT id, name, odds_api_id, manual_override
    FROM golfers WHERE pool_id = ${poolId}
  `;

  let updated = 0;
  const unmatched: string[] = [];
  const matchedGolferIds = new Set<string>();

  for (const score of scores) {
    // Find matching golfer: first by odds_api_id, then by fuzzy name
    let golfer = golfers.find((g) => g.odds_api_id && g.odds_api_id === score.name);
    if (!golfer) {
      const normalized = normalizedName(score.name);
      golfer = golfers.find((g) => normalizedName(g.name) === normalized);
    }

    if (!golfer) {
      unmatched.push(score.name);
      continue;
    }

    // Skip manually overridden golfers
    if (golfer.manual_override) continue;

    matchedGolferIds.add(golfer.id);

    // Update scores (only non-null values from API)
    await sql`
      UPDATE golfers SET
        r1 = COALESCE(${score.r1}, r1),
        r2 = COALESCE(${score.r2}, r2),
        r3 = COALESCE(${score.r3}, r3),
        r4 = COALESCE(${score.r4}, r4),
        made_cut = COALESCE(${score.madeCut}, made_cut),
        odds_api_id = COALESCE(odds_api_id, ${score.name})
      WHERE id = ${golfer.id}
    `;
    updated++;
  }

  // Update pool sync timestamp
  await sql`UPDATE pools SET last_sync_at = now() WHERE id = ${poolId}`;

  return { updated, unmatched };
}
```

- [ ] **Step 2: Write the manual sync route**

Create `app/api/pool/[slug]/sync/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { syncPoolScores } from "@/lib/odds-api";

export async function POST(
  req: NextRequest,
  { params }: { params: { slug: string } }
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

  try {
    const result = await syncPoolScores(poolRows[0].id);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Sync failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 3: Write the cron endpoint**

Create `app/api/cron/sync-scores/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { syncPoolScores } from "@/lib/odds-api";

export async function GET(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sql = getDb();
  const pools = await sql`
    SELECT id, slug FROM pools WHERE setup_complete = true
  `;

  const results = [];
  for (const pool of pools) {
    try {
      const result = await syncPoolScores(pool.id);
      results.push({ slug: pool.slug, ...result });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      results.push({ slug: pool.slug, error: message });
    }
  }

  return NextResponse.json({ synced: results.length, results });
}
```

- [ ] **Step 4: Commit**

```bash
git add lib/odds-api.ts app/api/pool/[slug]/sync/ app/api/cron/
git commit -m "feat: add Odds API integration with manual sync and cron endpoint"
```

---

### Task 11: Landing Page

**Files:**
- Rewrite: `app/page.tsx` (replace leaderboard with landing page)

- [ ] **Step 1: Write the landing page**

Replace `app/page.tsx` entirely:

```typescript
import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] text-center">
      <div className="w-24 h-24 rounded-full bg-masters-green/10 flex items-center justify-center mb-8">
        <svg className="w-14 h-14 text-masters-green" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
        </svg>
      </div>

      <h1 className="font-serif text-3xl font-bold text-masters-green mb-3 leading-tight">
        Masters Pool
      </h1>
      <p className="text-gray-500 text-sm mb-10 max-w-xs leading-relaxed">
        Create a golf pool, draft golfers with friends, and track live scores through tournament week.
      </p>

      <div className="flex flex-col gap-3 w-full max-w-xs">
        <Link href="/signup" className="btn-green text-center">
          Create a Pool
        </Link>
        <Link href="/login" className="btn-outline text-center">
          Sign In
        </Link>
      </div>

      <p className="text-xs text-gray-400 mt-8">
        Have an invite link? Just open it to view the leaderboard.
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/page.tsx
git commit -m "feat: add landing page at root"
```

---

### Task 12: Signup and Login Pages

**Files:**
- Create: `app/signup/page.tsx`
- Create: `app/login/page.tsx`

- [ ] **Step 1: Write signup page**

Create `app/signup/page.tsx`:

```typescript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });

    if (res.ok) {
      router.push("/dashboard");
    } else {
      const data = await res.json();
      setError(data.error || "Signup failed");
    }
    setLoading(false);
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[75vh]">
      <div className="card p-8 w-full">
        <h1 className="font-serif text-2xl text-masters-green mb-1 font-bold text-center">
          Create Account
        </h1>
        <p className="text-xs text-gray-500 mb-6 text-center">
          Set up your chairman account to create pools.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-[11px] font-bold uppercase tracking-[0.15em] text-gray-400 mb-1 block">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className="input-field"
              required
            />
          </div>
          <div>
            <label className="text-[11px] font-bold uppercase tracking-[0.15em] text-gray-400 mb-1 block">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@example.com"
              className="input-field"
              autoComplete="email"
              required
            />
          </div>
          <div>
            <label className="text-[11px] font-bold uppercase tracking-[0.15em] text-gray-400 mb-1 block">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimum 6 characters"
              className="input-field"
              autoComplete="new-password"
              minLength={6}
              required
            />
          </div>

          {error && <p className="text-red-500 text-xs">{error}</p>}

          <button type="submit" disabled={loading} className="btn-green w-full disabled:opacity-60">
            {loading ? "Creating..." : "Create Account"}
          </button>
        </form>

        <p className="text-xs text-gray-400 text-center mt-6">
          Already have an account?{" "}
          <Link href="/login" className="text-masters-green font-semibold">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Write login page**

Create `app/login/page.tsx`:

```typescript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (res.ok) {
      router.push("/dashboard");
    } else {
      const data = await res.json();
      setError(data.error || "Login failed");
    }
    setLoading(false);
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[75vh]">
      <div className="card p-8 w-full">
        <h1 className="font-serif text-2xl text-masters-green mb-1 font-bold text-center">
          Welcome Back
        </h1>
        <p className="text-xs text-gray-500 mb-6 text-center">
          Sign in to manage your pools.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-[11px] font-bold uppercase tracking-[0.15em] text-gray-400 mb-1 block">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@example.com"
              className="input-field"
              autoComplete="email"
              required
            />
          </div>
          <div>
            <label className="text-[11px] font-bold uppercase tracking-[0.15em] text-gray-400 mb-1 block">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Your password"
              className="input-field"
              autoComplete="current-password"
              required
            />
          </div>

          {error && <p className="text-red-500 text-xs">{error}</p>}

          <button type="submit" disabled={loading} className="btn-green w-full disabled:opacity-60">
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <p className="text-xs text-gray-400 text-center mt-6">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="text-masters-green font-semibold">Create one</Link>
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add app/signup/ app/login/
git commit -m "feat: add signup and login pages"
```

---

### Task 13: Dashboard Page

**Files:**
- Create: `app/dashboard/page.tsx`

- [ ] **Step 1: Write the dashboard**

Create `app/dashboard/page.tsx`:

```typescript
"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Pool {
  id: string;
  slug: string;
  pool_name: string;
  buy_in: number;
  setup_complete: boolean;
  player_count: number;
  created_at: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [pools, setPools] = useState<Pool[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  const fetchPools = useCallback(async () => {
    const res = await fetch("/api/pools");
    if (res.ok) {
      setPools(await res.json());
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchPools();
  }, [fetchPools]);

  async function createPool() {
    setCreating(true);
    const res = await fetch("/api/pools", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ poolName: newName || "My Masters Pool" }),
    });
    if (res.ok) {
      const { slug } = await res.json();
      router.push(`/pool/${slug}/setup`);
    }
    setCreating(false);
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-6">
        <div className="flex gap-3">
          <div className="loading-dot" />
          <div className="loading-dot" />
          <div className="loading-dot" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-serif text-2xl font-bold text-masters-green">My Pools</h1>
        <button onClick={handleLogout} className="text-xs text-gray-400 active:text-red-500 transition-colors">
          Sign out
        </button>
      </div>

      {/* Create pool */}
      <div className="card p-4 mb-6">
        <div className="flex gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Pool name (e.g. Blue Rock Masters)"
            className="input-field flex-1"
          />
          <button
            onClick={createPool}
            disabled={creating}
            className="btn-green flex-shrink-0 disabled:opacity-60"
          >
            {creating ? "..." : "Create"}
          </button>
        </div>
      </div>

      {/* Pool list */}
      {pools.length === 0 ? (
        <div className="text-center py-12">
          <p className="font-serif italic text-gray-400 text-sm">
            No pools yet. Create your first one above.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {pools.map((pool) => (
            <Link
              key={pool.id}
              href={pool.setup_complete ? `/pool/${pool.slug}` : `/pool/${pool.slug}/setup`}
              className="card-interactive block p-4"
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-serif font-bold text-gray-900">{pool.pool_name}</span>
                  <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                    <span>{pool.player_count} players</span>
                    <span className="text-gray-200">|</span>
                    <span>${pool.buy_in} buy-in</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {pool.setup_complete ? (
                    <span className="text-[10px] bg-green-50 text-green-600 px-2 py-0.5 rounded-full font-semibold">
                      Live
                    </span>
                  ) : (
                    <span className="text-[10px] bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full font-semibold">
                      Draft
                    </span>
                  )}
                  <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/dashboard/
git commit -m "feat: add chairman dashboard with pool list"
```

---

### Task 14: Pool Layout with Contextual Bottom Nav

**Files:**
- Create: `app/pool/[slug]/layout.tsx`
- Modify: `app/layout.tsx` — remove BottomNav

- [ ] **Step 1: Create the pool-scoped layout**

Create `app/pool/[slug]/layout.tsx`:

```typescript
"use client";

import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function PoolLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const params = useParams();
  const slug = params.slug as string;
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    // Check if current user owns this pool
    async function check() {
      const [meRes, poolRes] = await Promise.all([
        fetch("/api/auth/me"),
        fetch(`/api/pool/${slug}`),
      ]);
      if (meRes.ok && poolRes.ok) {
        const me = await meRes.json();
        const pool = await poolRes.json();
        if (me && pool && me.chairmanId === pool.chairmanId) {
          setIsOwner(true);
        }
      }
    }
    check();
  }, [slug]);

  const tabs = [
    {
      href: `/pool/${slug}`,
      label: "Leaderboard",
      icon: (active: boolean) => (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 2.5 : 1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
      alwaysShow: true,
    },
    {
      href: `/pool/${slug}/scores`,
      label: "Scores",
      icon: (active: boolean) => (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 2.5 : 1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      ),
      alwaysShow: false,
    },
    {
      href: `/pool/${slug}/setup`,
      label: "Setup",
      icon: (active: boolean) => (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 2.5 : 1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
      alwaysShow: false,
    },
  ];

  const visibleTabs = tabs.filter((t) => t.alwaysShow || isOwner);

  return (
    <>
      {children}
      <nav className="fixed bottom-0 inset-x-0 z-50 bg-white/95 backdrop-blur-md border-t border-masters-cream-dark">
        <div className="flex items-stretch" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
          {visibleTabs.map((tab) => {
            const active = pathname === tab.href;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 transition-colors duration-150
                  ${active ? "text-masters-green" : "text-gray-400"}`}
              >
                {tab.icon(active)}
                <span className={`text-[10px] font-semibold tracking-wide ${active ? "text-masters-green" : "text-gray-400"}`}>
                  {tab.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
```

- [ ] **Step 2: Simplify root layout — remove BottomNav**

Replace `app/layout.tsx` with:

```typescript
import "./globals.css";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#006747" />
        <title>Masters Pool</title>
      </head>
      <body className="relative z-10">
        <main className="px-4 pt-4 pb-safe max-w-lg mx-auto">
          {children}
        </main>
      </body>
    </html>
  );
}
```

Note: `"use client"` is removed since layout no longer uses hooks. This is now a server component.

- [ ] **Step 3: Commit**

```bash
git add app/pool/[slug]/layout.tsx app/layout.tsx
git commit -m "feat: pool-scoped layout with contextual bottom nav"
```

---

### Task 15: Move Leaderboard to /pool/[slug]

**Files:**
- Create: `app/pool/[slug]/page.tsx` (adapted from old `app/page.tsx`)

- [ ] **Step 1: Write the pool leaderboard page**

Create `app/pool/[slug]/page.tsx`. This is the same as the old `app/page.tsx` but fetches from `/api/pool/${slug}` instead of `/api/pool`:

Key changes from the old file:
1. Import `useParams` and get `slug`
2. `fetchPool` calls `/api/pool/${slug}`
3. "No Pool" state links to `/pool/${slug}/setup` instead of `/setup`

```typescript
"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { PoolConfig, PlayerStanding } from "@/lib/types";
import { computeLeaderboard, formatScore, scoreColorClass } from "@/lib/pool";
import Link from "next/link";

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-6">
      <div className="flex gap-3">
        <div className="loading-dot" />
        <div className="loading-dot" />
        <div className="loading-dot" />
      </div>
      <p className="font-serif italic text-masters-green/60 text-sm">Loading standings...</p>
    </div>
  );
}

function ScoreBadge({ score, size = "sm" }: { score: number | null; size?: "sm" | "lg" | "xl" }) {
  const sizeClass = size === "xl" ? "text-3xl" : size === "lg" ? "text-xl" : "text-sm";
  return (
    <span className={`font-mono font-bold tabular-nums ${sizeClass} ${scoreColorClass(score)}`}>
      {formatScore(score)}
    </span>
  );
}

function RoundDots({ golfer }: { golfer: PoolConfig["golfers"][0] }) {
  const rounds = [golfer.r1, golfer.r2, golfer.r3, golfer.r4];
  return (
    <div className="flex gap-1.5">
      {rounds.map((r, i) => (
        <span key={i} className={`w-2 h-2 rounded-full ${r !== null ? "bg-masters-green" : "bg-gray-200"}`} />
      ))}
    </div>
  );
}

function GolferDetail({ golfer, counted, totalScore, penaltyScore }: {
  golfer: PoolConfig["golfers"][0]; counted: boolean; totalScore: number | null; penaltyScore: number;
}) {
  return (
    <div className={`flex items-center justify-between rounded-xl px-3 py-3 text-sm ${counted ? "bg-white border border-masters-cream-dark" : "bg-masters-cream/60 opacity-60"}`}>
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        <RoundDots golfer={golfer} />
        <span className="truncate font-medium text-gray-800">{golfer.name}</span>
        {golfer.madeCut === false && <span className="text-[10px] bg-red-50 text-red-600 px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0">MC</span>}
        {!counted && <span className="text-[10px] bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded-full font-medium flex-shrink-0">bench</span>}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0 ml-2">
        <div className="flex gap-1.5 text-xs text-gray-400 font-mono">
          {[golfer.r1, golfer.r2, golfer.r3, golfer.r4].map((r, i) => (
            <span key={i} className={r !== null ? scoreColorClass(r) : "text-gray-200"}>{r !== null ? formatScore(r) : "-"}</span>
          ))}
        </div>
        {penaltyScore > 0 && <span className="text-[10px] text-red-500 font-mono">+{penaltyScore}</span>}
        <ScoreBadge score={totalScore} />
      </div>
    </div>
  );
}

function StandingCard({ standing, expanded, onToggle, index }: {
  standing: PlayerStanding; expanded: boolean; onToggle: () => void; index: number;
}) {
  const isLeader = standing.rank === 1;
  return (
    <div className={`card-interactive animate-stagger-in stagger-${Math.min(index + 1, 10)} overflow-hidden ${isLeader ? "ring-2 ring-masters-gold/40" : ""}`}>
      <button type="button" onClick={onToggle} className="w-full text-left px-4 py-4 flex items-center gap-4">
        <div className="flex-shrink-0 w-14 flex items-center justify-center">
          {isLeader ? (
            <div className="w-12 h-12 rounded-full bg-masters-gold flex items-center justify-center shadow-gold">
              <span className="text-white font-serif font-bold text-xl">1</span>
            </div>
          ) : (
            <span className="font-serif font-bold text-4xl text-masters-green/80 tabular-nums">{standing.rank}</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-serif font-bold text-gray-900 text-lg truncate">{standing.player.name}</span>
            {isLeader && <span className="text-[9px] bg-masters-gold text-white px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Leader</span>}
          </div>
          <div className="text-xs text-gray-400 mt-0.5 font-sans">{standing.golfers.filter(g => g.counted).length} golfers counted</div>
        </div>
        <div className="flex flex-col items-end flex-shrink-0">
          <ScoreBadge score={standing.totalScore} size="xl" />
          {standing.prize > 0 && <span className="text-xs font-semibold text-masters-gold mt-0.5">${standing.prize}</span>}
        </div>
        <svg className={`w-5 h-5 text-gray-300 flex-shrink-0 transition-transform duration-150 ${expanded ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>
      {expanded && (
        <div className="px-4 pb-4 animate-expand">
          <div className="gold-rule mb-3" />
          <div className="space-y-2">
            {standing.golfers.map((gs) => (
              <GolferDetail key={gs.golfer.id} golfer={gs.golfer} counted={gs.counted} totalScore={gs.totalScore} penaltyScore={gs.penaltyScore} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SettingsPill({ label }: { label: string }) {
  return <span className="inline-flex items-center bg-masters-green/8 text-masters-green px-3 py-1.5 rounded-full text-xs font-semibold">{label}</span>;
}

export default function PoolLeaderboardPage() {
  const { slug } = useParams();
  const [config, setConfig] = useState<PoolConfig | null>(null);
  const [standings, setStandings] = useState<PlayerStanding[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchPool = useCallback(async () => {
    try {
      const res = await fetch(`/api/pool/${slug}`);
      if (!res.ok) { setLoading(false); return; }
      const data = await res.json();
      if (data) {
        setConfig(data);
        setStandings(computeLeaderboard(data));
        setLastUpdated(new Date());
      }
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    fetchPool();
    const interval = setInterval(fetchPool, 30_000);
    return () => clearInterval(interval);
  }, [fetchPool]);

  if (loading) return <LoadingState />;

  if (!config || !config.setupComplete) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-20 h-20 rounded-full bg-masters-green/10 flex items-center justify-center mb-6">
          <svg className="w-10 h-10 text-masters-green" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
          </svg>
        </div>
        <h1 className="font-serif text-2xl font-bold text-masters-green mb-2">No Pool Yet</h1>
        <p className="text-gray-500 text-sm mb-8 max-w-xs leading-relaxed">
          The chairman hasn&apos;t set things up yet. Check back soon.
        </p>
      </div>
    );
  }

  const totalPurse = config.players.length * config.buyIn;
  const roundsWithData = [1, 2, 3, 4].filter(r => config.golfers.some(g => g[`r${r}` as keyof typeof g] !== null));
  const currentRound = roundsWithData.length > 0 ? Math.max(...roundsWithData) : 0;

  return (
    <div>
      <div className="sticky top-0 z-40 -mx-4 px-4 pt-2 pb-3 bg-masters-cream/95 backdrop-blur-sm">
        <h1 className="font-serif text-2xl font-bold text-masters-green leading-tight">{config.poolName || "Masters Pool"}</h1>
        <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-500">
          <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-masters-gold" /><strong className="text-gray-700">${totalPurse}</strong> purse</span>
          <span className="text-gray-300">|</span>
          <span>{config.players.length} players</span>
          {currentRound > 0 && <><span className="text-gray-300">|</span><span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />Rd {currentRound}</span></>}
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5 mt-3 mb-5">
        <SettingsPill label={config.settings.draftType === "snake" ? "Snake Draft" : "Random Draft"} />
        <SettingsPill label={config.settings.scoringType === "all" ? "All Golfers Count" : `Best ${config.settings.bestN} Count`} />
        <SettingsPill label={config.settings.missedCutRule === "penalty" ? `MC +${config.settings.missedCutPenalty}/rd` : config.settings.missedCutRule === "zero" ? "MC = Zero" : "MC = Worst"} />
      </div>
      <div className="flex justify-between items-center mb-4">
        <div className="gold-rule flex-1" />
        <button onClick={fetchPool} className="ml-3 flex items-center gap-1.5 text-xs text-gray-400 active:text-masters-green transition-colors">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          {lastUpdated && lastUpdated.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
        </button>
      </div>
      <div className="space-y-3">
        {standings.map((standing, i) => (
          <StandingCard key={standing.player.id} standing={standing} expanded={expandedId === standing.player.id} onToggle={() => setExpandedId(expandedId === standing.player.id ? null : standing.player.id)} index={i} />
        ))}
      </div>
      {currentRound === 0 && (
        <div className="text-center mt-8 mb-4">
          <div className="gold-rule mb-4" />
          <p className="font-serif italic text-gray-400 text-sm">Scores will appear once Round 1 data is entered.</p>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/pool/[slug]/page.tsx
git commit -m "feat: add pool leaderboard at /pool/[slug]"
```

---

### Task 16: Move Setup to /pool/[slug]/setup

**Files:**
- Create: `app/pool/[slug]/setup/page.tsx` (adapted from old `app/setup/page.tsx`)
- Delete: `app/setup/page.tsx`

- [ ] **Step 1: Adapt the setup page**

Create `app/pool/[slug]/setup/page.tsx`. Key changes from old version:
1. Import `useParams` and get `slug`
2. Remove password auth gate (middleware handles auth now)
3. `handleSave` POSTs to `/api/pool/${slug}/setup` (no x-admin-password header, cookie handles auth)
4. "Pool is Live" links to `/pool/${slug}` instead of `/`

The full file is the same as the old `app/setup/page.tsx` with these substitutions:
- Remove the `password`, `authed`, `authError` state and `handleAuth` function
- Remove the `if (!authed)` password gate block
- Change fetch URL in `handleSave` from `/api/setup` to `/api/pool/${slug}/setup`
- Remove `"x-admin-password": password` from fetch headers
- Change `<a href="/">` to `<a href={`/pool/${slug}`}>`

Copy the old `app/setup/page.tsx` and apply these changes. The component name becomes `PoolSetupPage`.

- [ ] **Step 2: Delete old setup page**

```bash
rm -rf app/setup/
```

- [ ] **Step 3: Commit**

```bash
git add app/pool/[slug]/setup/ app/setup/
git commit -m "feat: move setup page to /pool/[slug]/setup with cookie auth"
```

---

### Task 17: Move Scores to /pool/[slug]/scores

**Files:**
- Create: `app/pool/[slug]/scores/page.tsx` (adapted from old `app/scores/page.tsx`)
- Delete: `app/scores/page.tsx`

- [ ] **Step 1: Adapt the scores page**

Create `app/pool/[slug]/scores/page.tsx`. Key changes from old version:
1. Import `useParams` and get `slug`
2. Remove password auth gate (middleware handles auth now)
3. Fetch from `/api/pool/${slug}` instead of `/api/pool`
4. ScoreCell and GolferCard POST to `/api/pool/${slug}/scores` instead of `/api/scores` (no x-admin-password header)
5. Add "Refresh from API" button at top that calls `POST /api/pool/${slug}/sync`
6. Show `lastSyncAt` from pool data
7. "No Pool" state links to `/pool/${slug}/setup`

The `password` prop is removed from `ScoreCell` and `GolferCard`. The `slug` is passed instead. Remove the auth gate UI entirely.

- [ ] **Step 2: Delete old scores page**

```bash
rm -rf app/scores/
```

- [ ] **Step 3: Commit**

```bash
git add app/pool/[slug]/scores/ app/scores/
git commit -m "feat: move scores page to /pool/[slug]/scores with API sync button"
```

---

### Task 18: Cleanup and Vercel Config

**Files:**
- Delete: `lib/store.ts`
- Modify: `vercel.json`
- Modify: `.gitignore`

- [ ] **Step 1: Delete old store**

```bash
rm lib/store.ts
```

- [ ] **Step 2: Update vercel.json with cron config**

Replace `vercel.json`:

```json
{
  "framework": "nextjs",
  "crons": [
    {
      "path": "/api/cron/sync-scores",
      "schedule": "*/15 6-23 * 4 4-7"
    }
  ]
}
```

This runs every 15 minutes from 6AM-11PM during the month of April on Thu-Sun (approximate for Masters week). Adjust as needed.

- [ ] **Step 3: Update .gitignore**

Add `.env.local` if not already there (it should be):

```
node_modules/
.next/
out/
data/
*.tsbuildinfo
.env
.env.local
```

- [ ] **Step 4: Create .env.local template**

Create `.env.example`:

```
DATABASE_URL=postgresql://user:pass@host.neon.tech/masters_pool?sslmode=require
JWT_SECRET=change-me-to-random-32-chars
THE_ODDS_API_KEY=your-odds-api-key
CRON_SECRET=change-me-to-random-string
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: cleanup old store, add cron config and env template"
```

---

### Task 19: Build Verification

- [ ] **Step 1: Install new deps if not done already**

```bash
npm install
```

- [ ] **Step 2: Build and fix any type errors**

```bash
npx next build 2>&1 | tail -30
```

Fix any compilation errors. Common issues:
- Missing `params` types on route handlers (Next.js 14 dynamic routes)
- Import paths for moved files
- `nanoid` import style (`import { nanoid } from "nanoid"`)

- [ ] **Step 3: Commit any fixes**

```bash
git add -A
git commit -m "fix: resolve build errors from migration"
```

---

### Task 20: Set Environment Variables in Vercel

This is a manual step, not code:

- [ ] **Step 1: Create Neon database**

Go to console.neon.tech, create a new project, copy the connection string.

- [ ] **Step 2: Run schema**

Paste `lib/db-seed.sql` into the Neon SQL editor and run it.

- [ ] **Step 3: Set Vercel environment variables**

In Vercel project settings → Environment Variables, add:
- `DATABASE_URL` = your Neon connection string
- `JWT_SECRET` = a random 32+ character string
- `THE_ODDS_API_KEY` = your Odds API key
- `CRON_SECRET` = a random string for cron auth

- [ ] **Step 4: Deploy**

```bash
git push origin main
```

Vercel will auto-deploy. Verify:
1. Landing page at `/` works
2. Signup creates account
3. Dashboard shows empty pool list
4. Create pool → setup wizard → launch pool
5. Invite link `/pool/<slug>` shows leaderboard
6. Scores page allows manual entry
