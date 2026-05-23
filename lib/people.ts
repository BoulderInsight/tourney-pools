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
 * Matching is by exact name. Renaming a player ("John" -> "John Smith") will not match;
 * the chairman will need to re-collect that player. This is acceptable for Phase 1.
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
    ORDER BY created_at ASC
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
 * For each player in the pool that has no linked Person, create one (owned by the
 * pool's chairman, name copied from the player) and link it. Safe to re-run
 * sequentially: subsequent calls touch zero rows. Concurrent calls may produce
 * orphaned Person rows; this is acceptable for the backfill's intent.
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
