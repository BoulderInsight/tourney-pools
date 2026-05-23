-- Player Payments Phase 2: groups, group_members
-- Idempotent (safe to re-run).

CREATE TABLE IF NOT EXISTS groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chairman_id UUID NOT NULL REFERENCES chairmen(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_groups_chairman ON groups(chairman_id);

CREATE TABLE IF NOT EXISTS group_members (
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, person_id)
);

CREATE INDEX IF NOT EXISTS idx_group_members_person ON group_members(person_id);
