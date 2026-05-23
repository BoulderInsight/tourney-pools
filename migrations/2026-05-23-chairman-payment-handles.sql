-- Chairmen own payment handles too: tip jars on every pool's leaderboard, and
-- (later) chairman-collects payouts that can deep-link into the chairman's app.
-- Same shape as people.{venmo,cashapp,paypal}_handle + preferred_method so
-- lib/payment-links.ts pickHandleForPerson can be reused.

ALTER TABLE chairmen
  ADD COLUMN IF NOT EXISTS venmo_handle TEXT,
  ADD COLUMN IF NOT EXISTS cashapp_handle TEXT,
  ADD COLUMN IF NOT EXISTS paypal_handle TEXT,
  ADD COLUMN IF NOT EXISTS preferred_method TEXT
    CHECK (preferred_method IN ('venmo', 'cashapp', 'paypal') OR preferred_method IS NULL);
