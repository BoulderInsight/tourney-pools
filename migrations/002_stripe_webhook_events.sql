-- Migration 002: Add stripe_webhook_events table for idempotency
-- Required for PR #60 webhook idempotency
-- Deploy BEFORE merging PR #60

CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT UNIQUE NOT NULL,
  event_type TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_event_id ON stripe_webhook_events(event_id);
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_received_at ON stripe_webhook_events(received_at);

-- Cleanup old events (optional, can be run periodically)
-- DELETE FROM stripe_webhook_events WHERE received_at < now() - INTERVAL '90 days';
