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
  const { poolName, players, golferEntries, golferNames, buyIn, settings } = body;

  // Support both new format (golferEntries with rankings) and legacy (golferNames)
  const entries: { name: string; ranking: number | null }[] = golferEntries
    || (golferNames || []).map((n: string) => ({ name: n, ranking: null }));

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

  // Insert golfers with rankings
  const insertedGolfers = [];
  for (let i = 0; i < entries.length; i++) {
    const result = await sql`
      INSERT INTO golfers (pool_id, name, world_ranking)
      VALUES (${poolId}, ${entries[i].name}, ${entries[i].ranking})
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
