import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { PoolConfig, CommissionerSettings } from "@/lib/types";

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
    settings: pool.settings as CommissionerSettings,
    setupComplete: pool.setup_complete,
    assignments: assignments.map((a) => ({
      playerId: a.player_id,
      golferId: a.golfer_id,
      pickNumber: a.pick_number,
    })),
  };

  return NextResponse.json({
    ...config,
    chairmanId: pool.chairman_id,
    lastSyncAt: pool.last_sync_at,
  });
}
