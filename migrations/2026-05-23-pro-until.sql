-- Adds a promotional Pro window for chairmen.
--
-- When pro_until is set and in the future, the chairman is treated as Pro
-- by all gating logic (canCreatePool, maxPlayers, ad slot, etc.) even if
-- their stored tier is 'free'. When pro_until passes, behavior reverts
-- back to whatever the stored tier says.
--
-- Pools created during the promo window keep their data intact; only
-- render-time perks (sponsor banner) revert when the promo expires.
--
-- First use case: a one-time thank-you to early chairmen who set up exactly
-- one pool, granting 14 days of Pro so they can re-engage with the new
-- functionality without re-paying.

ALTER TABLE chairmen
  ADD COLUMN IF NOT EXISTS pro_until TIMESTAMPTZ;

-- Partial index so the "find chairmen with active promos" admin query
-- stays fast as the table grows. Most rows will have pro_until = NULL.
CREATE INDEX IF NOT EXISTS idx_chairmen_pro_until
  ON chairmen (pro_until)
  WHERE pro_until IS NOT NULL;
