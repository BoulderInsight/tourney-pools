import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { draftGolfers } from "@/lib/pool";
import { findOrCreatePersonForPool, setPersonPhone } from "@/lib/people";
import { normalizeUsPhoneE164 } from "@/lib/phone";

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
  const poolId = poolRows[0].id;

  const body = await req.json();
  const { poolName, players, golferEntries, golferNames, buyIn, settings, tournamentId, awaitingField } = body;

  // Support both new format (golferEntries with rankings) and legacy (golferNames)
  const entries: { name: string; ranking: number | null }[] = golferEntries
    || (golferNames || []).map((n: string) => ({ name: n, ranking: null }));

  // Clear golfer-side data for re-setup (the draft is re-run after). Player
  // rows are NOT blindly deleted here because that would reset rsvp_status
  // and invited_at on every wizard save. Instead we merge below.
  await sql`DELETE FROM assignments WHERE pool_id = ${poolId}`;
  await sql`DELETE FROM golfers WHERE pool_id = ${poolId}`;

  // Update pool settings (including tournament_id if provided)
  await sql`
    UPDATE pools SET
      pool_name = ${poolName},
      buy_in = ${buyIn},
      settings = ${JSON.stringify(settings)},
      setup_complete = true,
      draft_complete = ${
        !awaitingField &&
        (settings.draftType === "random" || settings.draftType === "auto-snake")
      },
      awaiting_field = ${awaitingField === true},
      tournament_id = ${tournamentId || null}
    WHERE id = ${poolId}
  `;

  // Player merge:
  //   - existing rows whose ids aren't in the incoming list -> DELETE
  //   - incoming rows with a real (UUID) id matching an existing row -> UPDATE
  //     name + pick_order; re-link person if the name changed. rsvp_status,
  //     invited_at, and the row identity are all preserved.
  //   - incoming rows without a matching id (newly added in the wizard) ->
  //     INSERT with rsvp_status='pending', no invited_at.
  //
  // findOrCreatePerson runs for every incoming player so handles travel with
  // renames and a previously-handled Person of the same name picks back up.
  // Phone validation is the same loud-fail behavior as before: a bad value
  // aborts the whole save with 400.
  const existingRows = await sql`SELECT id FROM players WHERE pool_id = ${poolId}`;
  const existingIds = new Set(existingRows.map((r) => r.id as string));
  const incomingIds = new Set(
    players
      .filter((p: { id?: string }) => typeof p.id === "string" && existingIds.has(p.id))
      .map((p: { id: string }) => p.id),
  );

  // Remove players the chairman dropped from the form.
  const removed = Array.from(existingIds).filter((id) => !incomingIds.has(id));
  if (removed.length > 0) {
    await sql`DELETE FROM players WHERE pool_id = ${poolId} AND id = ANY(${removed}::uuid[])`;
  }

  // Track Person ids already taken in this batch so two same-name players
  // entered in one wizard save (two 'Christi') each get their own Person row
  // instead of silently sharing one.
  const insertedPlayers: { id: string; name: string }[] = [];
  const personsUsedInBatch = new Set<string>();
  for (let i = 0; i < players.length; i++) {
    const p = players[i];
    const name: string = p.name;
    const isExisting = typeof p.id === "string" && existingIds.has(p.id);
    const person = await findOrCreatePersonForPool(sql, session.chairmanId, name, poolId, {
      excludePlayerId: isExisting ? (p.id as string) : undefined,
      alreadyUsedPersonIds: personsUsedInBatch,
    });
    personsUsedInBatch.add(person.id);

    if (typeof p.phone === "string" && p.phone.trim().length > 0) {
      const e164 = normalizeUsPhoneE164(p.phone);
      if (!e164) {
        return NextResponse.json(
          { error: `Invalid US phone number for ${name}` },
          { status: 400 },
        );
      }
      await setPersonPhone(sql, person.id, e164);
    }

    if (isExisting) {
      const updated = await sql`
        UPDATE players
        SET name = ${name}, pick_order = ${i}, person_id = ${person.id}
        WHERE id = ${p.id} AND pool_id = ${poolId}
        RETURNING id, name
      `;
      if (updated.length > 0) insertedPlayers.push({ id: updated[0].id, name: updated[0].name });
    } else {
      const inserted = await sql`
        INSERT INTO players (pool_id, name, pick_order, person_id, rsvp_status)
        VALUES (${poolId}, ${name}, ${i}, ${person.id}, 'pending')
        RETURNING id, name
      `;
      insertedPlayers.push({ id: inserted[0].id, name: inserted[0].name });
    }
  }

  // Awaiting-field pool: the field isn't published yet, so save the players
  // and rules but skip golfers + drafting. The cron drafts it once the field
  // publishes.
  if (awaitingField) {
    return NextResponse.json({ ok: true, awaitingField: true });
  }

  // Insert golfers with rankings, linked to shared tournament_golfers
  const insertedGolfers = [];
  for (let i = 0; i < entries.length; i++) {
    // Find or create tournament golfer, scoped to tournament if provided
    let tgRows;
    if (tournamentId) {
      tgRows = await sql`SELECT id FROM tournament_golfers WHERE name = ${entries[i].name} AND tournament_id = ${tournamentId}`;
      if (tgRows.length === 0) {
        tgRows = await sql`
          INSERT INTO tournament_golfers (name, world_ranking, tournament_id)
          VALUES (${entries[i].name}, ${entries[i].ranking}, ${tournamentId})
          RETURNING id
        `;
      }
    } else {
      tgRows = await sql`SELECT id FROM tournament_golfers WHERE name = ${entries[i].name} AND tournament_id IS NULL`;
      if (tgRows.length === 0) {
        tgRows = await sql`
          INSERT INTO tournament_golfers (name, world_ranking)
          VALUES (${entries[i].name}, ${entries[i].ranking})
          RETURNING id
        `;
      }
    }
    const tgId = tgRows[0].id;

    const result = await sql`
      INSERT INTO golfers (pool_id, name, world_ranking, tournament_golfer_id)
      VALUES (${poolId}, ${entries[i].name}, ${entries[i].ranking}, ${tgId})
      RETURNING id, name
    `;
    insertedGolfers.push({
      id: result[0].id,
      name: result[0].name,
      r1: null, r2: null, r3: null, r4: null,
      madeCut: null,
    });
  }

  // Auto-draft for random and auto-snake. Live snake draft is handled interactively on the draft page.
  if (settings.draftType === "random" || settings.draftType === "auto-snake") {
    // For auto-snake, attach rankings so draftGolfers can sort by seed
    const golferPool = settings.draftType === "auto-snake"
      ? insertedGolfers.map((g, i) => ({ ...g, worldRanking: entries[i].ranking }))
      : insertedGolfers;
    const draftResult = draftGolfers(insertedPlayers, golferPool, settings.draftType);

    for (const a of draftResult) {
      await sql`
        INSERT INTO assignments (pool_id, player_id, golfer_id, pick_number)
        VALUES (${poolId}, ${a.playerId}, ${a.golferId}, ${a.pickNumber})
      `;
    }
  }
  // For snake draft, assignments are created pick-by-pick on /pool/[slug]/draft

  return NextResponse.json({ ok: true, draftType: settings.draftType });
}
