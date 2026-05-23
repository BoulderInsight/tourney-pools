-- Pool invitation / RSVP flow. Every player row is also an invitee record:
--   pending  = chairman has added them, no response yet
--   accepted = they tapped "I'm In" (or chairman manually accepted them)
--   declined = they tapped "I'm Out"
-- Only accepted players appear on the public leaderboard, in draft assignments,
-- and in payouts. Pending/declined are visible only on the chairman's roster.
--
-- invited_at tracks the most recent time the chairman texted this invitee. NULL
-- means they've never been texted; the "Invite to Pool" button only includes
-- pending invitees with NULL invited_at, so re-tapping after adding late
-- additions only re-texts the newcomers.
--
-- Existing players are backfilled to 'accepted' because they're already in
-- active pools; no one should suddenly disappear from a live leaderboard.

ALTER TABLE players ADD COLUMN IF NOT EXISTS rsvp_status TEXT;
UPDATE players SET rsvp_status = 'accepted' WHERE rsvp_status IS NULL;
ALTER TABLE players ALTER COLUMN rsvp_status SET NOT NULL;
ALTER TABLE players ALTER COLUMN rsvp_status SET DEFAULT 'pending';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'players_rsvp_status_check') THEN
    ALTER TABLE players ADD CONSTRAINT players_rsvp_status_check
      CHECK (rsvp_status IN ('pending', 'accepted', 'declined'));
  END IF;
END $$;

ALTER TABLE players ADD COLUMN IF NOT EXISTS invited_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_players_pool_rsvp ON players(pool_id, rsvp_status);
