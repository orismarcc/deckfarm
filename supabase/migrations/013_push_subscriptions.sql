-- Migration 013: Web Push Subscriptions
-- Stores browser push subscription objects per user.

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint     TEXT NOT NULL UNIQUE,
  keys         JSONB NOT NULL,  -- { p256dh, auth }
  updated_at   TIMESTAMPTZ DEFAULT now()
);

-- Index for fast lookup by user
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_usuario
  ON push_subscriptions (usuario_id);

-- RLS: users can only manage their own subscriptions
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS push_subscriptions_select ON push_subscriptions;
DROP POLICY IF EXISTS push_subscriptions_insert ON push_subscriptions;
DROP POLICY IF EXISTS push_subscriptions_delete ON push_subscriptions;

CREATE POLICY push_subscriptions_select ON push_subscriptions
  FOR SELECT USING (usuario_id = auth.uid());

CREATE POLICY push_subscriptions_insert ON push_subscriptions
  FOR INSERT WITH CHECK (usuario_id = auth.uid());

CREATE POLICY push_subscriptions_delete ON push_subscriptions
  FOR DELETE USING (usuario_id = auth.uid());

-- Service role can select all (for sending notifications)
CREATE POLICY push_subscriptions_service_select ON push_subscriptions
  FOR SELECT USING (true);
