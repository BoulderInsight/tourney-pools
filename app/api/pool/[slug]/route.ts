import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { PoolConfig, CommissionerSettings } from "@/lib/types";
import { DEFAULT_SETTINGS } from "@/lib/pool";
import { syncTournamentScores } from "@/lib/odds-api";

export const dynamic = "force-dynamic";

const SYNC_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  const sql = getDb();

  const poolRows = await sql`
    SELECT p.id, p.slug, p.pool_name, p.buy_in, p.settings, p.setup_complete, p.draft_complete, p.chairman_id, p.last_sync_at,
           c.name as chairman_name, c.tier, c.custom_ad_image, c.custom_ad_url, c.custom_ad_headline, c.custom_ad_description, c.ad_removed
    FROM pools p
    JOIN chairmen c ON c.id = p.chairman_id
    WHERE p.slug = ${params.slug}
  `;
  if (poolRows.length === 0) {
    return NextResponse.json(null, { status: 404 });
  }

  const pool = poolRows[0];

  // Auto-sync scores if stale (>15 min since last sync) and pool is set up
  if (pool.setup_complete && pool.draft_complete) {
    const lastSync = pool.last_sync_at ? new Date(pool.last_sync_at).getTime() : 0;
    const now = Date.now();
    if (now - lastSync > SYNC_INTERVAL_MS) {
      try {
        await syncTournamentScores();
      } catch {
        // Sync failure shouldn't block page load
      }
    }
  }

  const players = await sql`
    SELECT id, name FROM players WHERE pool_id = ${pool.id} ORDER BY pick_order
  `;

  const golfers = await sql`
    SELECT g.id, g.name,
      COALESCE(tg.r1, g.r1) as r1,
      COALESCE(tg.r2, g.r2) as r2,
      COALESCE(tg.r3, g.r3) as r3,
      COALESCE(tg.r4, g.r4) as r4,
      COALESCE(tg.made_cut, g.made_cut) as made_cut,
      COALESCE(tg.odds_api_id, g.odds_api_id) as odds_api_id,
      g.manual_override,
      COALESCE(tg.world_ranking, g.world_ranking) as world_ranking
    FROM golfers g
    LEFT JOIN tournament_golfers tg ON g.tournament_golfer_id = tg.id
    WHERE g.pool_id = ${pool.id}
    ORDER BY g.name
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
      worldRanking: g.world_ranking,
    })),
    buyIn: pool.buy_in,
    settings: { ...DEFAULT_SETTINGS, ...(pool.settings as Partial<CommissionerSettings>) },
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
    chairmanName: pool.chairman_name,
    chairmanTier: pool.tier || "free",
    customAdImage: pool.custom_ad_image,
    customAdUrl: pool.custom_ad_url,
    customAdHeadline: pool.custom_ad_headline,
    customAdDescription: pool.custom_ad_description,
    adRemoved: pool.ad_removed,
    draftComplete: pool.draft_complete,
    lastSyncAt: pool.last_sync_at,
  });
}
