-- People (the chairman's roster) gain an optional phone number, used to power the
-- chairman-only "Text the Pool" button. Stored in E.164 (+1XXXXXXXXXX) by the API
-- so the sms: URL builder can concatenate directly.
--
-- Plaintext for v1 per the spec ("encrypted if straightforward, else plaintext is
-- fine"). Phone is chairman-only-visible at every render site, never returned by
-- the public leaderboard endpoint, never logged, never embedded in OG images.

ALTER TABLE people ADD COLUMN IF NOT EXISTS phone TEXT;
