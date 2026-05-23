import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { PoolConfig, CommissionerSettings, PaymentMethod } from "@/lib/types";
import { DEFAULT_SETTINGS } from "@/lib/pool";
import { fetchLeaderboard, extractRoundScores } from "@/lib/golf-api";
import { pickHandleForPerson } from "@/lib/payment-links";

export const dynamic = "force-dynamic";

const SYNC_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  const sql = getDb();

  const poolRows = await sql`
    SELECT p.id, p.slug, p.pool_name, p.buy_in, p.settings, p.setup_complete, p.draft_complete, p.awaiting_field, p.chairman_id, p.last_sync_at, p.tournament_id,
           c.name as chairman_name, c.tier, c.custom_ad_image, c.custom_ad_url, c.custom_ad_headline, c.custom_ad_description, c.ad_removed,
           t.name as tournament_name, t.status as tournament_status, t.start_date as tournament_start_date
    FROM pools p
    JOIN chairmen c ON c.id = p.chairman_id
    LEFT JOIN tournaments t ON t.id = p.tournament_id
    WHERE p.slug = ${params.slug}
  `;
  if (poolRows.length === 0) {
    return NextResponse.json(null, { status: 404 });
  }

  const pool = poolRows[0];

  // Auto-sync scores if stale (>15 min since last sync) and pool is set up with a tournament
  if (pool.setup_complete && pool.draft_complete && pool.tournament_id) {
    const lastSync = pool.last_sync_at ? new Date(pool.last_sync_at).getTime() : 0;
    const now = Date.now();
    if (now - lastSync > SYNC_INTERVAL_MS) {
      try {
        // Look up the tournament's API info
        const tournRows = await sql`
          SELECT api_tournament_id, year, status FROM tournaments
          WHERE id = ${pool.tournament_id} AND api_source = 'slashgolf' AND api_tournament_id IS NOT NULL AND status = 'in_progress'
        `;
        if (tournRows.length > 0) {
          const t = tournRows[0];
          const leaderboard = await fetchLeaderboard(t.api_tournament_id, t.year);

          for (const golfer of leaderboard.golfers) {
            const { r1, r2, r3, r4 } = extractRoundScores(golfer);
            const madeCut = golfer.status === "cut" ? false : golfer.status === "active" && (r3 !== null || r4 !== null) ? true : null;

            await sql`
              UPDATE tournament_golfers SET
                r1 = COALESCE(${r1}, r1),
                r2 = COALESCE(${r2}, r2),
                r3 = COALESCE(${r3}, r3),
                r4 = COALESCE(${r4}, r4),
                made_cut = COALESCE(${madeCut}, made_cut),
                status = ${golfer.status},
                updated_at = now()
              WHERE tournament_id = ${pool.tournament_id}
                AND odds_api_id = ${golfer.playerId}
                AND (manual_override IS NULL OR manual_override = false)
            `;
          }

          // Mark tournament completed if API says so
          const apiStatus = leaderboard.status?.toLowerCase() || "";
          if (apiStatus === "completed" || apiStatus === "official") {
            await sql`UPDATE tournaments SET status = 'completed', updated_at = now() WHERE id = ${pool.tournament_id}`;
          }
        }

        // Update last_sync_at for this pool
        await sql`UPDATE pools SET last_sync_at = now() WHERE id = ${pool.id}`;
      } catch (err) {
        // Sync failure shouldn't block page load — but log it so it surfaces in Vercel
        console.error(`[pool/${params.slug}] auto-sync failed:`, err);
      }
    }
  }

  // The LEFT JOIN tolerates players with no linked Person (they get paymentInfo: null
  // and no one-tap pay button, which is the right outcome). Population is handled by
  // Phase 1's setup-time findOrCreatePerson, the commissioner-only /people backfill,
  // and the /players page. Running backfill here too would add a DB round trip per
  // poll on every viewer of every active leaderboard, which is the most-hit endpoint.
  const players = await sql`
    SELECT pl.id, pl.name,
           pe.venmo_handle, pe.cashapp_handle, pe.paypal_handle, pe.preferred_method
    FROM players pl
    LEFT JOIN people pe ON pe.id = pl.person_id
    WHERE pl.pool_id = ${pool.id}
    ORDER BY pl.pick_order
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
    players: players.map((p) => ({
      id: p.id,
      name: p.name,
      paymentInfo: pickHandleForPerson({
        venmoHandle: (p.venmo_handle as string | null) ?? null,
        cashappHandle: (p.cashapp_handle as string | null) ?? null,
        paypalHandle: (p.paypal_handle as string | null) ?? null,
        preferredMethod: (p.preferred_method as PaymentMethod | null) ?? null,
      }),
    })),
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
    awaitingField: pool.awaiting_field,
    lastSyncAt: pool.last_sync_at,
    tournamentId: pool.tournament_id,
    tournamentName: pool.tournament_name,
    tournamentStatus: pool.tournament_status,
    tournamentStartDate: pool.tournament_start_date,
  });
}
