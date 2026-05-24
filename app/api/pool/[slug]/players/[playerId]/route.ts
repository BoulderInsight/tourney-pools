import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { findOrCreatePerson } from "@/lib/people";

export const dynamic = "force-dynamic";

/**
 * Chairman-only player edits for a pool that hasn't drafted yet. Once
 * draft_complete=true the roster is locked (409) since renames could split
 * audit trails and removes would orphan assignments.
 *
 * PATCH  rename a player
 * DELETE remove a player
 *
 * RSVP override has its own sub-route (./rsvp) since it semantically belongs
 * to a different concept (status, not identity).
 */

async function loadPoolForChairman(slug: string, chairmanId: string) {
  const sql = getDb();
  const rows = await sql`
    SELECT id, draft_complete FROM pools
    WHERE slug = ${slug} AND chairman_id = ${chairmanId}
  `;
  return rows.length > 0 ? (rows[0] as { id: string; draft_complete: boolean }) : null;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { slug: string; playerId: string } },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (name.length === 0) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const pool = await loadPoolForChairman(params.slug, session.chairmanId);
  if (!pool) {
    return NextResponse.json({ error: "Pool not found" }, { status: 404 });
  }
  if (pool.draft_complete) {
    return NextResponse.json(
      { error: "Draft is complete. Pool roster is locked." },
      { status: 409 },
    );
  }

  // Re-link to the Person matching the new name. findOrCreatePerson will pick
  // up any existing handle-bearing Person for this chairman with that name
  // (Brack with Venmo on file in another pool, etc), so a rename doesn't lose
  // payment info if the new name already has data on it. The old Person row
  // stays (it may be linked from other pools).
  const sql = getDb();
  const person = await findOrCreatePerson(sql, session.chairmanId, name);

  const updated = await sql`
    UPDATE players
    SET name = ${name}, person_id = ${person.id}
    WHERE id = ${params.playerId} AND pool_id = ${pool.id}
    RETURNING id, name
  `;
  if (updated.length === 0) {
    return NextResponse.json({ error: "Player not found" }, { status: 404 });
  }
  return NextResponse.json({
    player: { id: updated[0].id as string, name: updated[0].name as string },
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { slug: string; playerId: string } },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pool = await loadPoolForChairman(params.slug, session.chairmanId);
  if (!pool) {
    return NextResponse.json({ error: "Pool not found" }, { status: 404 });
  }
  if (pool.draft_complete) {
    return NextResponse.json(
      { error: "Draft is complete. Pool roster is locked." },
      { status: 409 },
    );
  }

  const sql = getDb();
  // Pre-draft there should be no assignments to clean up. Belt-and-suspenders:
  // delete any stray rows scoped to this player so the FK doesn't bite if a
  // half-completed draft attempt left orphans.
  await sql`DELETE FROM assignments WHERE player_id = ${params.playerId} AND pool_id = ${pool.id}`;
  const deleted = await sql`
    DELETE FROM players
    WHERE id = ${params.playerId} AND pool_id = ${pool.id}
    RETURNING id
  `;
  if (deleted.length === 0) {
    return NextResponse.json({ error: "Player not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
