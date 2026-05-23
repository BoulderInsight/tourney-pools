# Player Payments Phase 3 Implementation Plan (One-Tap Pay)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the existing post-tournament "Pay X $Y" text in the leaderboard's PayoutInfo block into one-tap pay buttons. Each button deep-links into the recipient's preferred payment app (Venmo, Cash App, or PayPal) with the amount and a note prefilled.

**Architecture:** A new pure-helper module `lib/payment-links.ts` builds the per-app URL formats. The public leaderboard API extends each player with a `paymentInfo` object (preferred handle + method, computed server-side). The PayoutInfo component in `app/pool/[slug]/page.tsx` renders a styled link per "owe" line when the winner has a handle; falls back to text when no handle exists or when the pool is chairman-collects.

**Tech Stack:** Next.js 14 App Router, Neon Postgres (raw SQL, no ORM), Tailwind. **No test framework configured** — verification via `npx tsc --noEmit`, `npm run build`, and concrete browser checks on the Vercel preview.

**Spec source of truth:** `docs/superpowers/specs/2026-05-22-player-payments-design.md` (the "Phase 3, one-tap pay" section).

**Phase 1 + 2 dependencies:** This plan builds on merged Phases 1 and 2. It uses the `people` table, `players.person_id` FK, `lib/people.ts` (`backfillPeopleForPool`), the `PaymentMethod` type, and the existing PayoutInfo block in the leaderboard page.

**Decisions locked in (call out if you want any changed):**
- **Placement:** Inline in the existing PayoutInfo block. No dedicated payouts screen.
- **App scope:** Venmo, Cash App, PayPal. No Zelle (no universal link).
- **Picked handle:** the recipient's preferred method, falling back to Venmo → Cash App → PayPal. Same logic as the Players tab `preferredHandle` helper from Phase 1.
- **Payout mode scope:** **Honor system only.** Chairman-collects pools keep the existing text instruction. (Chairmen don't have payment handles in Phases 1 and 2; adding chairman handles is a future enhancement.)
- **Fallback when no handle:** The existing "Pay X $Y" text renders with a small "No handle on file. Ask X for theirs." hint.
- **Privacy:** Payment handles will appear in the public leaderboard's JSON response and rendered button URLs. Acceptable because leaderboards are shared with pool members, who informally exchange handles already. Documented in the plan and the spec.
- **Note prefilled in each link:** the pool name (e.g. "Blue Rock Mafia payout"). Lets the recipient and sender see what the payment was for in their app's transaction history.
- **URL formats:**
  - Venmo: `https://venmo.com/{handle}?txn=pay&amount={X.XX}&note={encoded note}`
  - Cash App: `https://cash.app/${handle}/{X.XX}`
  - PayPal: `https://paypal.me/{handle}/{X.XX}`
- **Visual style:** the existing red-tinted "Owes" block keeps its label; each owe line becomes a gold pill button. App name is shown in the button as small uppercase ("via VENMO →").

---

## File Structure

**New files:**
- `lib/payment-links.ts` — URL builders, `paymentMethodLabel`, and `pickHandleForPerson` (shared by future callers; the page-level duplicates from Phases 1/2 stay as-is to avoid touching working code).

**Modified files:**
- `lib/types.ts` — add an optional `paymentInfo` field to `Player`.
- `app/api/pool/[slug]/route.ts` — JOIN players with people in the public leaderboard query; run `backfillPeopleForPool` so legacy pools light up; expose `paymentInfo` per player.
- `app/pool/[slug]/page.tsx` — update the `PayoutInfo` component to render one-tap pay buttons when handles are present; thread `poolName` through so the prefilled note has context.

**Out of scope for Phase 3:**
- Chairman payment handles (chairman-collects pools).
- Choose-a-different-app dropdown on the button (just uses preferred-or-first).
- Refactoring the duplicated `preferredHandle` helpers in `app/pool/[slug]/players/page.tsx` and `app/groups/[id]/page.tsx` (they keep working; consolidation is a separate cleanup).

---

## Task 1: Add `lib/payment-links.ts`

**Files:**
- Create: `lib/payment-links.ts`

- [ ] **Step 1: Write the helper module**

Write `lib/payment-links.ts`:

```typescript
import type { PaymentMethod } from "@/lib/types";

export interface PaymentLinkOptions {
  /** Dollar amount, can include cents. Formatted to 2 decimal places in the URL. */
  amount: number;
  /** Optional human-readable note prefilled in the payment app where supported. */
  note?: string;
}

/** Strip a leading @ if present (Person handles are stored without @, but accept either). */
function cleanHandle(handle: string): string {
  return handle.trim().replace(/^@+/, "");
}

export function buildVenmoLink(handle: string, opts: PaymentLinkOptions): string {
  const params = new URLSearchParams({
    txn: "pay",
    amount: opts.amount.toFixed(2),
  });
  if (opts.note) params.set("note", opts.note);
  return `https://venmo.com/${encodeURIComponent(cleanHandle(handle))}?${params.toString()}`;
}

export function buildCashappLink(handle: string, opts: PaymentLinkOptions): string {
  // Cash App's universal-link format: cash.app/$USERNAME/AMOUNT. The note isn't supported.
  return `https://cash.app/$${encodeURIComponent(cleanHandle(handle))}/${opts.amount.toFixed(2)}`;
}

export function buildPaypalLink(handle: string, opts: PaymentLinkOptions): string {
  // paypal.me/{handle}/{amount} prefills the amount and opens the PayPal app/web flow.
  // The note isn't supported in the URL.
  return `https://paypal.me/${encodeURIComponent(cleanHandle(handle))}/${opts.amount.toFixed(2)}`;
}

/** Build a payment-app deep link for the given method. */
export function buildPaymentLink(
  method: PaymentMethod,
  handle: string,
  opts: PaymentLinkOptions,
): string {
  switch (method) {
    case "venmo": return buildVenmoLink(handle, opts);
    case "cashapp": return buildCashappLink(handle, opts);
    case "paypal": return buildPaypalLink(handle, opts);
  }
}

/** Human-readable label per app. */
export function paymentMethodLabel(method: PaymentMethod): string {
  switch (method) {
    case "venmo": return "Venmo";
    case "cashapp": return "Cash App";
    case "paypal": return "PayPal";
  }
}

/**
 * Pick the preferred handle for a Person. If they have a preferred method with a handle,
 * use that. Otherwise fall back to Venmo, then Cash App, then PayPal. Returns null if
 * none of the three has a handle on file.
 */
export function pickHandleForPerson(person: {
  venmoHandle: string | null;
  cashappHandle: string | null;
  paypalHandle: string | null;
  preferredMethod: PaymentMethod | null;
}): { method: PaymentMethod; handle: string } | null {
  const order: PaymentMethod[] = person.preferredMethod
    ? [person.preferredMethod, "venmo", "cashapp", "paypal"]
    : ["venmo", "cashapp", "paypal"];
  for (const m of order) {
    const value =
      m === "venmo" ? person.venmoHandle
      : m === "cashapp" ? person.cashappHandle
      : person.paypalHandle;
    if (value) return { method: m, handle: value };
  }
  return null;
}
```

- [ ] **Step 2: Smoke-check the URL formats**

This module has no DB or framework dependencies, so a one-off script in the gitignored `scripts/` directory is the lightest way to verify the URL shapes.

Create `scripts/check-payment-links.ts`:

```typescript
// Run with: npx tsx scripts/check-payment-links.ts
import { buildPaymentLink, pickHandleForPerson } from "../lib/payment-links";

const cases = [
  { method: "venmo" as const, handle: "@whitlock", amount: 20, note: "Blue Rock Mafia payout" },
  { method: "venmo" as const, handle: "whitlock", amount: 12.5, note: "" },
  { method: "cashapp" as const, handle: "$jake", amount: 7.75, note: "ignored" },
  { method: "paypal" as const, handle: "samp", amount: 100, note: "ignored" },
];

for (const c of cases) {
  const url = buildPaymentLink(c.method, c.handle, { amount: c.amount, note: c.note });
  console.log(`${c.method.padEnd(8)} ${c.handle.padEnd(12)} $${c.amount}  ->  ${url}`);
}

const picked = pickHandleForPerson({
  venmoHandle: null,
  cashappHandle: "jake",
  paypalHandle: "jakep",
  preferredMethod: "paypal",
});
console.log("\nPicked (preferred=paypal):", picked);
```

Run it:

```bash
npx tsx scripts/check-payment-links.ts
```

Expected output:

```
venmo    whitlock     $20  ->  https://venmo.com/whitlock?txn=pay&amount=20.00&note=Blue+Rock+Mafia+payout
venmo    whitlock     $12.5  ->  https://venmo.com/whitlock?txn=pay&amount=12.50
cashapp  $jake        $7.75  ->  https://cash.app/$jake/7.75
paypal   samp         $100  ->  https://paypal.me/samp/100.00

Picked (preferred=paypal): { method: 'paypal', handle: 'jakep' }
```

Confirm: the `@` is stripped from the venmo handle, the `$` is stripped from the cash-app handle, the amount is always 2-decimal, and the encoded note replaces spaces with `+`.

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit (don't commit the script, `scripts/` is gitignored)**

```bash
git add lib/payment-links.ts
git commit -m "feat(payments): add payment-links helpers (Venmo, Cash App, PayPal)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Add `paymentInfo` to the `Player` type

**Files:**
- Modify: `lib/types.ts`

The public leaderboard already exposes `Player` (`{ id, name }`). We add an optional `paymentInfo` that the server attaches when it can resolve the player's linked Person handle.

- [ ] **Step 1: Read the current `Player` type**

Open `lib/types.ts` and find the `Player` interface (it's defined alongside `Golfer`, `PoolConfig`, `PlayerStanding`).

- [ ] **Step 2: Extend it**

Replace the existing `Player` interface:

```typescript
export interface Player {
  id: string;
  name: string;
}
```

with:

```typescript
export interface Player {
  id: string;
  name: string;
  /**
   * Server-attached payment info, used by the leaderboard's one-tap pay buttons.
   * Resolved from the player's linked Person (handles + preferred method) at fetch time.
   * `null` means the player has no handle on file yet. `undefined` means the field
   * wasn't fetched (e.g. older clients).
   */
  paymentInfo?: { method: PaymentMethod; handle: string } | null;
}
```

`PaymentMethod` is already imported/exported in the same file from Phase 1, so no new imports needed.

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors. The field is optional, so existing callers don't need to change.

- [ ] **Step 4: Commit**

```bash
git add lib/types.ts
git commit -m "feat(payments): add optional paymentInfo to Player type

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Expose `paymentInfo` from the public leaderboard API

**Files:**
- Modify: `app/api/pool/[slug]/route.ts`

The current GET handler runs two SQL queries: one for the pool/chairman info, one for `players`, and one for `golfers`. The players query selects `id, name`. We extend it to JOIN people, run the Phase 1 backfill defensively, and compute `paymentInfo` per player using `pickHandleForPerson`.

- [ ] **Step 1: Add the imports**

In `app/api/pool/[slug]/route.ts`, the imports at the top currently include `getDb`, the types, `DEFAULT_SETTINGS`, and `fetchLeaderboard/extractRoundScores`. Add two more:

```typescript
import { backfillPeopleForPool } from "@/lib/people";
import { pickHandleForPerson } from "@/lib/payment-links";
```

- [ ] **Step 2: Run the backfill before reading players**

In the GET handler, find the existing `players` query:

```typescript
  const players = await sql`
    SELECT id, name FROM players WHERE pool_id = ${pool.id} ORDER BY pick_order
  `;
```

Replace those two lines with:

```typescript
  // Defense in depth: backfill links any player that pre-dates Phase 1. Idempotent —
  // a second call touches zero rows. This is also done by the commissioner-only
  // /api/pool/[slug]/people endpoint (Phase 1), but the public leaderboard now needs
  // payment handles to render one-tap pay buttons, so we run it here too.
  await backfillPeopleForPool(sql, pool.id);

  const players = await sql`
    SELECT pl.id, pl.name,
           pe.venmo_handle, pe.cashapp_handle, pe.paypal_handle, pe.preferred_method
    FROM players pl
    LEFT JOIN people pe ON pe.id = pl.person_id
    WHERE pl.pool_id = ${pool.id}
    ORDER BY pl.pick_order
  `;
```

- [ ] **Step 3: Map `paymentInfo` into the response**

In the same handler, find the existing `players` mapping inside the `config` object:

```typescript
    players: players.map((p) => ({ id: p.id, name: p.name })),
```

Replace it with:

```typescript
    players: players.map((p) => ({
      id: p.id,
      name: p.name,
      paymentInfo: pickHandleForPerson({
        venmoHandle: (p.venmo_handle as string | null) ?? null,
        cashappHandle: (p.cashapp_handle as string | null) ?? null,
        paypalHandle: (p.paypal_handle as string | null) ?? null,
        preferredMethod: (p.preferred_method as "venmo" | "cashapp" | "paypal" | null) ?? null,
      }),
    })),
```

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Smoke-check the API response**

Start the dev server (`npm run dev` in another shell), then curl any pool with handles already collected (e.g. the CJ CUP pool):

```bash
curl -sS http://localhost:3000/api/pool/<slug> | jq '.players'
```

Expected: each player object now has a `paymentInfo` field. Players whose Person has a handle on file show `{ method, handle }`; players whose Person has no handles show `null`.

- [ ] **Step 6: Commit**

```bash
git add app/api/pool/[slug]/route.ts
git commit -m "feat(payments): expose player payment handles on public leaderboard API

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Render one-tap pay buttons in `PayoutInfo`

**Files:**
- Modify: `app/pool/[slug]/page.tsx`

The `PayoutInfo` component currently renders one `<p>` per "Pay X $Y" line. We replace each owe line with either a gold pill button (when the recipient has a handle) or the existing text plus a "no handle" hint (when they don't).

- [ ] **Step 1: Add the imports**

At the top of `app/pool/[slug]/page.tsx`, find the existing imports. Add:

```typescript
import { buildPaymentLink, paymentMethodLabel } from "@/lib/payment-links";
```

- [ ] **Step 2: Thread `poolName` into the `PayoutInfo` props**

Find the `PayoutInfo` function signature:

```typescript
function PayoutInfo({ standing, buyIn, allStandings, payoutMethod, chairmanName }: {
  standing: PlayerStanding;
  buyIn: number;
  allStandings: PlayerStanding[];
  payoutMethod: string;
  chairmanName: string;
}) {
```

Replace with:

```typescript
function PayoutInfo({ standing, buyIn, allStandings, payoutMethod, chairmanName, poolName }: {
  standing: PlayerStanding;
  buyIn: number;
  allStandings: PlayerStanding[];
  payoutMethod: string;
  chairmanName: string;
  poolName: string;
}) {
```

- [ ] **Step 3: Replace the honor-system "Owes" block with buttons + fallback**

Inside `PayoutInfo`, find the honor-system branch (the `if (!isWinner && winners.length > 0)` block that ends with `}`). The current honor-system code at the end of that branch looks like:

```typescript
    // Honor system: show individual payments to each winner
    const totalPrize = winners.reduce((s, w) => s + w.prize, 0);
    const payments = winners.map(w => ({
      name: w.player.name,
      amount: Math.round((w.prize / totalPrize) * buyIn * 100) / 100,
    }));

    return (
      <div className="mt-3 bg-red-50 rounded-xl p-3">
        <p className="text-[10px] text-red-400 uppercase tracking-wider font-semibold mb-1.5">Owes</p>
        {payments.map(p => (
          <p key={p.name} className="text-xs font-medium text-red-700">
            Pay {p.name} <strong>${p.amount.toFixed(2)}</strong>
          </p>
        ))}
      </div>
    );
  }
```

Replace it with:

```typescript
    // Honor system: show individual payments to each winner, with one-tap pay buttons
    // when the recipient has a handle on file.
    const totalPrize = winners.reduce((s, w) => s + w.prize, 0);
    const note = `${poolName} payout`;
    const payments = winners.map(w => ({
      name: w.player.name,
      amount: Math.round((w.prize / totalPrize) * buyIn * 100) / 100,
      paymentInfo: w.player.paymentInfo ?? null,
    }));

    return (
      <div className="mt-3 bg-red-50 rounded-xl p-3">
        <p className="text-[10px] text-red-400 uppercase tracking-wider font-semibold mb-1.5">Owes</p>
        <div className="space-y-2">
          {payments.map(p => {
            if (!p.paymentInfo) {
              return (
                <div key={p.name} className="text-xs font-medium text-red-700">
                  Pay {p.name} <strong>${p.amount.toFixed(2)}</strong>
                  <span className="block text-[10px] text-red-400 mt-0.5">
                    No handle on file. Ask {p.name} for theirs.
                  </span>
                </div>
              );
            }
            const url = buildPaymentLink(p.paymentInfo.method, p.paymentInfo.handle, {
              amount: p.amount,
              note,
            });
            return (
              <a
                key={p.name}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between bg-tp-accent text-white rounded-lg px-3 py-2 active:opacity-90 transition-opacity"
              >
                <span className="text-xs font-semibold">
                  Pay {p.name} ${p.amount.toFixed(2)}
                </span>
                <span className="text-[10px] uppercase tracking-wider font-bold opacity-80">
                  via {paymentMethodLabel(p.paymentInfo.method)} &rarr;
                </span>
              </a>
            );
          })}
        </div>
      </div>
    );
  }
```

The `chairman-collects` branch above this stays untouched (chairman handles aren't in Phase 3 scope).

- [ ] **Step 4: Pass `poolName` from the parent**

Find the only render site for `PayoutInfo` inside the leaderboard's expanded card. Search the file for `<PayoutInfo`. The current call site looks like:

```typescript
          {tournamentOver && <PayoutInfo standing={standing} buyIn={buyIn} allStandings={allStandings} payoutMethod={payoutMethod} chairmanName={chairmanNameForPayout} />}
```

Replace with:

```typescript
          {tournamentOver && <PayoutInfo standing={standing} buyIn={buyIn} allStandings={allStandings} payoutMethod={payoutMethod} chairmanName={chairmanNameForPayout} poolName={poolName} />}
```

`PayoutInfo` is rendered inside `StandingCard`. `StandingCard` needs to know `poolName` to pass it down. Find the `StandingCard` function signature:

```typescript
function StandingCard({ standing, expanded, onToggle, index, buyIn, allStandings, tournamentOver, payoutMethod, chairmanNameForPayout }: {
  standing: PlayerStanding;
  expanded: boolean;
  onToggle: () => void;
  index: number;
  buyIn: number;
  allStandings: PlayerStanding[];
  tournamentOver: boolean;
  payoutMethod: string;
  chairmanNameForPayout: string;
}) {
```

Replace with:

```typescript
function StandingCard({ standing, expanded, onToggle, index, buyIn, allStandings, tournamentOver, payoutMethod, chairmanNameForPayout, poolName }: {
  standing: PlayerStanding;
  expanded: boolean;
  onToggle: () => void;
  index: number;
  buyIn: number;
  allStandings: PlayerStanding[];
  tournamentOver: boolean;
  payoutMethod: string;
  chairmanNameForPayout: string;
  poolName: string;
}) {
```

Finally, find the `StandingCard` render site inside `PoolLeaderboardPage` (search for `<StandingCard`). The current call looks like:

```tsx
              <StandingCard
                key={standing.player.id}
                standing={standing}
                expanded={expandedId === standing.player.id}
                onToggle={() =>
                  setExpandedId(expandedId === standing.player.id ? null : standing.player.id)
                }
                index={i}
                buyIn={config.buyIn}
                allStandings={standings}
                tournamentOver={currentRound >= 4}
                payoutMethod={config.settings.payoutMethod || "honor-system"}
                chairmanNameForPayout={chairmanName}
              />
```

Replace with (adds `poolName={config.poolName || "Golf Pool"}`):

```tsx
              <StandingCard
                key={standing.player.id}
                standing={standing}
                expanded={expandedId === standing.player.id}
                onToggle={() =>
                  setExpandedId(expandedId === standing.player.id ? null : standing.player.id)
                }
                index={i}
                buyIn={config.buyIn}
                allStandings={standings}
                tournamentOver={currentRound >= 4}
                payoutMethod={config.settings.payoutMethod || "honor-system"}
                chairmanNameForPayout={chairmanName}
                poolName={config.poolName || "Golf Pool"}
              />
```

- [ ] **Step 5: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add app/pool/[slug]/page.tsx
git commit -m "feat(payments): one-tap pay buttons in PayoutInfo (honor system)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Build verification + smoke test

This task verifies the implementation end-to-end. No commits — just a checklist.

- [ ] **Step 1: Build**

```bash
npm run build
```

Expected: no errors. Existing routes are unchanged; no new routes are added in Phase 3.

- [ ] **Step 2: TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Local browser smoke test**

With `npm run dev` running:

1. Open a pool whose tournament has finished (round 4 data present) in honor-system payout mode. The CJ CUP pools satisfy this if Phase 1 already collected handles.
2. Tap a losing player's expanded card. The "Owes" block should now show:
   - A gold pill button per winner that has a handle: "Pay [Name] $X.XX  via [APP] →"
   - For winners with no handle: plain "Pay [Name] $X.XX" with "No handle on file" hint below.
3. Tap a gold pill button. The right URL should open in a new tab. The URL format should be one of:
   - `https://venmo.com/HANDLE?txn=pay&amount=X.XX&note=Blue+Rock+Mafia+payout`
   - `https://cash.app/$HANDLE/X.XX`
   - `https://paypal.me/HANDLE/X.XX`
4. On a mobile device (or a Vercel preview from a phone), the same tap should open the corresponding native app.
5. Verify chairman-collects pools are UNCHANGED: still show the plain "Pay [Chairman] $X.XX" text. No button.
6. Verify a pool with a winner who has NO handle on file shows the fallback text plus the "No handle on file" hint.

- [ ] **Step 4: API response sanity check**

```bash
SLUG=<a-pool-slug>
curl -sS http://localhost:3000/api/pool/$SLUG | jq '.players[] | {name, paymentInfo}'
```

Expected: every player has a `paymentInfo` field. Players with handles show `{ method: "...", handle: "..." }`; players without show `null`.

Confirm no handle data leaks in unexpected places: the response should NOT include `chairman_id`, `venmo_handle`, `cashapp_handle`, etc. as separate fields. Only the `paymentInfo` object (which contains the picked handle and method).

---

## Spec coverage check

| Spec section | Implemented in task |
|---|---|
| One-tap prefilled payment links for Venmo, Cash App, PayPal | 1 (URL builders), 4 (rendered in UI) |
| Default to each person's preferred method | 1 (`pickHandleForPerson` order) |
| Post-tournament payout view | 4 (inline in existing PayoutInfo, gated by `tournamentOver`) |
| Chairman-collects one-tap | Out of scope — chairmen don't have payment handles in Phases 1-2 |
| Browser/desktop fallback when app isn't installed | Out of scope — payment-app URLs handle this themselves (open web flow if the app isn't installed) |
