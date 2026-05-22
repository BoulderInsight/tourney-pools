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

  // Clear existing data for re-setup
  await sql`DELETE FROM assignments WHERE pool_id = ${poolId}`;
  await sql`DELETE FROM golfers WHERE pool_id = ${poolId}`;
  await sql`DELETE FROM players WHERE pool_id = ${poolId}`;

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
