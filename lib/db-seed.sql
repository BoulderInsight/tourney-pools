CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE chairmen (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE pools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  chairman_id UUID NOT NULL REFERENCES chairmen(id),
  pool_name TEXT NOT NULL,
  buy_in INTEGER NOT NULL DEFAULT 20,
  settings JSONB NOT NULL DEFAULT '{}',
  setup_complete BOOLEAN DEFAULT false,
  tournament_id TEXT,
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id UUID NOT NULL REFERENCES pools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  pick_order INTEGER
);

CREATE TABLE golfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id UUID NOT NULL REFERENCES pools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  r1 INTEGER,
  r2 INTEGER,
  r3 INTEGER,
  r4 INTEGER,
  made_cut BOOLEAN,
  odds_api_id TEXT,
  manual_override BOOLEAN DEFAULT false
);

CREATE TABLE assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id UUID NOT NULL REFERENCES pools(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  golfer_id UUID NOT NULL REFERENCES golfers(id) ON DELETE CASCADE,
  pick_number INTEGER NOT NULL
);

CREATE INDEX idx_pools_slug ON pools(slug);
CREATE INDEX idx_pools_chairman ON pools(chairman_id);
CREATE INDEX idx_players_pool ON players(pool_id);
CREATE INDEX idx_golfers_pool ON golfers(pool_id);
CREATE INDEX idx_assignments_pool ON assignments(pool_id);
CREATE INDEX idx_chairmen_email ON chairmen(email);
