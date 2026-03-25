-- ================================================================
-- IntentIQ OS — Migration 0004
-- Token Usage Log + Chat Messages + Profit Tracking Fixes
-- ================================================================

-- ── token_usage: actual AI call log ──────────────────────────────
CREATE TABLE IF NOT EXISTS token_usage (
  id                TEXT PRIMARY KEY,
  user_id           TEXT NOT NULL,
  request_type      TEXT NOT NULL DEFAULT 'intent_generate',
  model_used        TEXT NOT NULL DEFAULT 'demo',
  prompt_tokens     INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens      INTEGER NOT NULL DEFAULT 0,
  cost_usd          REAL NOT NULL DEFAULT 0.0,
  period_start      TEXT NOT NULL,
  agent_name        TEXT,
  intent_type       TEXT,
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── chat_messages: store chat history ────────────────────────────
CREATE TABLE IF NOT EXISTS chat_messages (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'user',
  content     TEXT NOT NULL DEFAULT '',
  tokens_used INTEGER NOT NULL DEFAULT 0,
  model_used  TEXT NOT NULL DEFAULT 'demo',
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── onboarding: track setup state ────────────────────────────────
CREATE TABLE IF NOT EXISTS onboarding (
  user_id     TEXT PRIMARY KEY,
  step        INTEGER NOT NULL DEFAULT 0,
  data        TEXT NOT NULL DEFAULT '{}',
  is_complete INTEGER NOT NULL DEFAULT 0,
  completed_at TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── user_profiles: store business context ────────────────────────
CREATE TABLE IF NOT EXISTS user_profiles (
  user_id         TEXT PRIMARY KEY,
  business_name   TEXT NOT NULL DEFAULT 'My Business',
  niche           TEXT NOT NULL DEFAULT 'e-commerce',
  platform        TEXT NOT NULL DEFAULT 'shopify',
  pricing_style   TEXT NOT NULL DEFAULT 'moderate',
  risk_tolerance  TEXT NOT NULL DEFAULT 'balanced',
  monthly_revenue REAL NOT NULL DEFAULT 0,
  team_size       TEXT NOT NULL DEFAULT 'solo',
  goals           TEXT NOT NULL DEFAULT '[]',
  focus_categories TEXT NOT NULL DEFAULT '[]',
  top_products    TEXT NOT NULL DEFAULT '[]',
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── Indexes ───────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_token_usage_user    ON token_usage(user_id, period_start);
CREATE INDEX IF NOT EXISTS idx_token_usage_type    ON token_usage(request_type, period_start);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user  ON chat_messages(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_onboarding_user     ON onboarding(user_id);

-- ── Seed: demo user onboarding ────────────────────────────────────
INSERT OR IGNORE INTO onboarding (user_id, step, data, is_complete)
VALUES ('user-demo', 5, '{"businessName":"Demo Hair Co.","niche":"natural hair products","platform":"shopify"}', 1);

INSERT OR IGNORE INTO user_profiles (user_id, business_name, niche, platform, monthly_revenue)
VALUES ('user-demo', 'Demo Hair Co.', 'natural hair products', 'shopify', 8500);
