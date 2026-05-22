-- Player Payments Phase 1: people, collection_requests, players.person_id
-- Safe to run more than once: each statement uses IF NOT EXISTS where Postgres supports it.

CREATE TABLE IF NOT EXISTS people (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chairman_id UUID NOT NULL REFERENCES chairmen(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  venmo_handle TEXT,
  cashapp_handle TEXT,
  paypal_handle TEXT,
  preferred_method TEXT
    CHECK (preferred_method IN ('venmo', 'cashapp', 'paypal') OR preferred_method IS NULL),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_people_chairman ON people(chairman_id);

CREATE TABLE IF NOT EXISTS collection_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT UNIQUE NOT NULL,
  person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  pool_id UUID NOT NULL REFERENCES pools(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  submitted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_collection_requests_token ON collection_requests(token);
CREATE INDEX IF NOT EXISTS idx_collection_requests_person ON collection_requests(person_id);
CREATE INDEX IF NOT EXISTS idx_collection_requests_pool ON collection_requests(pool_id);

ALTER TABLE players
  ADD COLUMN IF NOT EXISTS person_id UUID REFERENCES people(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_players_person ON players(person_id);
