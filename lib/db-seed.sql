CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE chairmen (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  name TEXT NOT NULL,
  email_verified BOOLEAN DEFAULT false,
  verification_token TEXT,
  is_super_admin BOOLEAN DEFAULT false,
  tier TEXT DEFAULT 'free',
  stripe_customer_id TEXT,
  custom_ad_image TEXT,
  custom_ad_url TEXT,
  custom_ad_headline TEXT,
  custom_ad_description TEXT,
  ad_removed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE tournaments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  course_name TEXT,
  location TEXT,
  start_date DATE,
  end_date DATE,
  year INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
  api_source TEXT,
  api_tournament_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE pools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  chairman_id UUID NOT NULL REFERENCES chairmen(id),
  pool_name TEXT NOT NULL,
  buy_in INTEGER NOT NULL DEFAULT 20,
  settings JSONB NOT NULL DEFAULT '{}',
  setup_complete BOOLEAN DEFAULT false,
  draft_complete BOOLEAN DEFAULT false,
  tournament_id UUID REFERENCES tournaments(id),
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id UUID NOT NULL REFERENCES pools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  pick_order INTEGER
);

CREATE TABLE tournament_golfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID REFERENCES tournaments(id),
  name TEXT NOT NULL,
  r1 INTEGER,
  r2 INTEGER,
  r3 INTEGER,
  r4 INTEGER,
  made_cut BOOLEAN,
  world_ranking INTEGER,
  odds_api_id TEXT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
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
  manual_override BOOLEAN DEFAULT false,
  world_ranking INTEGER,
  tournament_golfer_id UUID REFERENCES tournament_golfers(id)
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
CREATE INDEX idx_pools_tournament ON pools(tournament_id);
CREATE INDEX idx_players_pool ON players(pool_id);
CREATE INDEX idx_golfers_pool ON golfers(pool_id);
CREATE INDEX idx_golfers_tournament_golfer ON golfers(tournament_golfer_id);
CREATE INDEX idx_assignments_pool ON assignments(pool_id);
CREATE INDEX idx_chairmen_email ON chairmen(email);
CREATE INDEX idx_tournaments_slug ON tournaments(slug);
CREATE INDEX idx_tournaments_status ON tournaments(status);
CREATE INDEX idx_tournament_golfers_tournament ON tournament_golfers(tournament_id);

-- Seed 2026 major tournaments
INSERT INTO tournaments (name, slug, course_name, location, start_date, end_date, year, status) VALUES
  ('The Masters', 'masters-2026', 'Augusta National Golf Club', 'Augusta, GA', '2026-04-09', '2026-04-12', 2026, 'scheduled'),
  ('PGA Championship', 'pga-championship-2026', 'Aronimink Golf Club', 'Newtown Square, PA', '2026-05-14', '2026-05-17', 2026, 'scheduled'),
  ('U.S. Open', 'us-open-2026', 'Oakmont Country Club', 'Oakmont, PA', '2026-06-18', '2026-06-21', 2026, 'scheduled'),
  ('The Open Championship', 'the-open-2026', 'Royal Portrush Golf Club', 'County Antrim, Northern Ireland', '2026-07-16', '2026-07-19', 2026, 'scheduled');
