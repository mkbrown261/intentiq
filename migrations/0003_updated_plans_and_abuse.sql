-- ================================================================
-- IntentIQ OS — Migration 0003
-- Updated Subscription Tiers + Anti-Abuse + Profit Tracking Schema
-- ================================================================

-- ── Add new columns to plans table ───────────────────────────────
ALTER TABLE plans ADD COLUMN daily_tokens INTEGER NOT NULL DEFAULT 0;
ALTER TABLE plans ADD COLUMN has_scheduling INTEGER NOT NULL DEFAULT 0;
ALTER TABLE plans ADD COLUMN has_advanced_agents INTEGER NOT NULL DEFAULT 0;

-- ── Disable FK checks, update plans in place ─────────────────────
PRAGMA foreign_keys = OFF;

-- Insert new plans (or replace if exist)
INSERT OR REPLACE INTO plans (id, name, display_name, monthly_tokens, daily_tokens, price_monthly, price_yearly, max_agents, max_schedules, max_workflows, has_chat, has_analytics, has_integrations, has_priority_ai, has_scheduling, has_advanced_agents, is_active, created_at) VALUES
  ('plan-free',    'free',    'Free',    10000,    2000,   0,   0,   2,   0,   1, 1, 0, 0, 0, 0, 0, 1, datetime('now')),
  ('plan-starter', 'starter', 'Starter', 1200000,  40000,  10,  100, 5,   5,   3, 1, 1, 0, 0, 1, 0, 1, datetime('now')),
  ('plan-pro',     'pro',     'Pro',     3600000,  120000, 30,  300, 7,   20,  10, 1, 1, 0, 1, 1, 1, 1, datetime('now')),
  ('plan-scale',   'scale',   'Scale',   12000000, 400000, 100, 1000, 7, 100, 100, 1, 1, 1, 1, 1, 1, 1, datetime('now'));

-- ── Migrate enterprise subs to scale ─────────────────────────────
UPDATE subscriptions SET plan_id = 'plan-scale' WHERE plan_id = 'plan-enterprise';

-- ── Update demo user token ledger ─────────────────────────────────
UPDATE subscriptions SET plan_id = 'plan-starter' WHERE user_id = 'user-demo';
UPDATE token_ledger SET tokens_granted = 1200000 WHERE user_id = 'user-demo';

PRAGMA foreign_keys = ON;

-- ── Daily token tracking ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS daily_token_usage (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL,
  date          TEXT NOT NULL,
  tokens_used   INTEGER NOT NULL DEFAULT 0,
  request_count INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, date)
);

-- ── Anti-abuse: request log ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS request_log (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL,
  request_type  TEXT NOT NULL,
  endpoint      TEXT NOT NULL DEFAULT '',
  ip_address    TEXT,
  user_agent    TEXT,
  tokens_used   INTEGER NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'ok',
  fingerprint   TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── Anti-abuse: flagged users ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS abuse_flags (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL,
  flag_type     TEXT NOT NULL,
  severity      TEXT NOT NULL DEFAULT 'warning',
  details       TEXT NOT NULL DEFAULT '',
  auto_resolved INTEGER NOT NULL DEFAULT 0,
  resolved_at   TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── Cooldown tracking ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cooldowns (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL,
  action_type     TEXT NOT NULL,
  cooldown_until  TEXT NOT NULL,
  reason          TEXT NOT NULL DEFAULT '',
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, action_type)
);

-- ── Profit tracking ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profit_tracking (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL,
  period_start    TEXT NOT NULL,
  plan_name       TEXT NOT NULL DEFAULT 'free',
  revenue_usd     REAL NOT NULL DEFAULT 0.0,
  cost_usd        REAL NOT NULL DEFAULT 0.0,
  tokens_used     INTEGER NOT NULL DEFAULT 0,
  request_count   INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, period_start)
);

-- ── Response cache ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS response_cache (
  cache_key   TEXT PRIMARY KEY,
  response    TEXT NOT NULL,
  intent_type TEXT,
  hits        INTEGER NOT NULL DEFAULT 0,
  expires_at  TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── Indexes ───────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_daily_usage_user_date ON daily_token_usage(user_id, date);
CREATE INDEX IF NOT EXISTS idx_request_log_user      ON request_log(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_request_log_ip        ON request_log(ip_address, created_at);
CREATE INDEX IF NOT EXISTS idx_abuse_flags_user      ON abuse_flags(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_cooldowns_user        ON cooldowns(user_id, action_type);
CREATE INDEX IF NOT EXISTS idx_profit_user_period    ON profit_tracking(user_id, period_start);
CREATE INDEX IF NOT EXISTS idx_cache_expires         ON response_cache(expires_at);
