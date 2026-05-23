-- Allow collection_requests.pool_id to be null so a chairman can mint a self-serve
-- link from the Groups context (no pool) as well as from a pool's Players tab.
-- The self-serve page renders gracefully when pool_id is null.

ALTER TABLE collection_requests
  ALTER COLUMN pool_id DROP NOT NULL;
