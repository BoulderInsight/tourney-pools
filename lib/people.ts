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

/**
 * Find an existing Person owned by this chairman with this name, or create a new one.
 * Preserves payment handles across re-runs of the setup wizard (typo fixes, late entrants,
 * settings changes) so collected data is not silently lost.
 *
 * Matching is by exact name. When more than one Person matches (e.g. a legacy empty
 * backfill row coexists with a handle-bearing row added later from a Group), we
 * prefer the row that has at least one payment handle set, then by oldest.
 *
 * Renaming a player ("John" -> "John Smith") will not match; the chairman will need
 * to re-collect that player.
 */
export async function findOrCreatePerson(
  sql: Sql,
  chairmanId: string,
  name: string,
): Promise<Person> {
  const rows = await sql`
    SELECT id, chairman_id, name, venmo_handle, cashapp_handle, paypal_handle, preferred_method
    FROM people
    WHERE chairman_id = ${chairmanId} AND name = ${name}
    ORDER BY
      (CASE WHEN venmo_handle IS NULL AND cashapp_handle IS NULL AND paypal_handle IS NULL THEN 1 ELSE 0 END),
      created_at ASC
    LIMIT 1
  `;
  if (rows.length > 0) return rowToPerson(rows[0]);
  return createPerson(sql, chairmanId, name);
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
  if (rows.length === 0) {
    throw new Error(`setPersonHandles: person ${personId} not found`);
  }
  return rowToPerson(rows[0]);
}

/**
 * For each player in the pool that has no linked Person, link to one owned by the
 * chairman with a matching name (creating a fresh empty Person only if no match
 * exists). Uses `findOrCreatePerson` so a player named "Brack" picks up the handles
 * already collected for "Brack" via a Group, instead of getting a separate empty
 * row that orphans those handles. Safe to re-run; subsequent calls touch zero rows.
 * Returns the count of backfilled players.
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
    const person = await findOrCreatePerson(sql, r.chairman_id as string, r.name as string);
    await sql`UPDATE players SET person_id = ${person.id} WHERE id = ${r.id}`;
    count++;
  }
  return count;
}

/**
 * For each player in the pool currently linked to a handle-less Person, look for
 * another Person owned by the same chairman with the same name that DOES have at
 * least one handle. If found, relink the player to it. Fixes pools where an earlier
 * buggy backfill created empty Person rows that orphaned the handles a chairman
 * later collected via a Group or another pool. Returns the count of relinked players.
 *
 * Idempotent: a second call after the first one converged touches zero rows.
 * Does NOT delete the now-orphaned empty Person rows; they're harmless and a
 * future cleanup can sweep them.
 */
export async function reconcilePoolPersonsByName(
  sql: Sql,
  poolId: string,
): Promise<number> {
  // Find candidates: players whose currently-linked Person has no handles, and where
  // another same-name Person owned by the same chairman has at least one handle.
  const candidates = await sql`
    WITH pool_chairman AS (
      SELECT id, chairman_id FROM pools WHERE id = ${poolId}
    ),
    handled AS (
      SELECT DISTINCT name
      FROM people
      WHERE chairman_id = (SELECT chairman_id FROM pool_chairman)
        AND (venmo_handle IS NOT NULL OR cashapp_handle IS NOT NULL OR paypal_handle IS NOT NULL)
    )
    SELECT pl.id AS player_id, pl.name AS player_name, pc.chairman_id
    FROM players pl
    JOIN pool_chairman pc ON true
    LEFT JOIN people cur ON cur.id = pl.person_id
    WHERE pl.pool_id = ${poolId}
      AND pl.name IN (SELECT name FROM handled)
      AND (
        pl.person_id IS NULL
        OR (cur.venmo_handle IS NULL AND cur.cashapp_handle IS NULL AND cur.paypal_handle IS NULL)
      )
  `;

  let relinked = 0;
  for (const c of candidates) {
    const best = await findOrCreatePerson(
      sql,
      c.chairman_id as string,
      c.player_name as string,
    );
    // findOrCreatePerson picked the handled row by ORDER BY; relink if it's a change.
    const updated = await sql`
      UPDATE players
      SET person_id = ${best.id}
      WHERE id = ${c.player_id} AND (person_id IS DISTINCT FROM ${best.id})
      RETURNING id
    `;
    if (updated.length > 0) relinked += 1;
  }
  return relinked;
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
