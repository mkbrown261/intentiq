-- ================================================================
-- IntentIQ OS — Core Database Schema
-- Migration 0001: Users, Auth, Subscriptions, Token Economy
-- ================================================================

-- ── Users ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id          TEXT PRIMARY KEY,
  email       TEXT UNIQUE NOT NULL,
  name        TEXT NOT NULL DEFAULT '',
  password_hash TEXT NOT NULL DEFAULT '',
  role        TEXT NOT NULL DEFAULT 'user',  -- user | admin
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  last_login  TEXT,
  is_active   INTEGER NOT NULL DEFAULT 1,
  onboarding_complete INTEGER NOT NULL DEFAULT 0
);

-- ── Sessions ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sessions (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token       TEXT UNIQUE NOT NULL,
  expires_at  TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  user_agent  TEXT,
  ip_address  TEXT
);

-- ── Subscription Plans (platform-defined) ────────────────────────
CREATE TABLE IF NOT EXISTS plans (
  id               TEXT PRIMARY KEY,
  name             TEXT NOT NULL,           -- free | starter | pro | enterprise
  display_name     TEXT NOT NULL,
  monthly_tokens   INTEGER NOT NULL,        -- token allowance per month
  price_monthly    REAL NOT NULL DEFAULT 0, -- USD
  price_yearly     REAL NOT NULL DEFAULT 0,
  max_agents       INTEGER NOT NULL DEFAULT 2,
  max_schedules    INTEGER NOT NULL DEFAULT 2,
  max_workflows    INTEGER NOT NULL DEFAULT 1,
  has_chat         INTEGER NOT NULL DEFAULT 0,
  has_analytics    INTEGER NOT NULL DEFAULT 0,
  has_integrations INTEGER NOT NULL DEFAULT 0,
  has_priority_ai  INTEGER NOT NULL DEFAULT 0,
  is_active        INTEGER NOT NULL DEFAULT 1,
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── User Subscriptions ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subscriptions (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id         TEXT NOT NULL REFERENCES plans(id),
  status          TEXT NOT NULL DEFAULT 'active', -- active | cancelled | past_due | trialing
  current_period_start TEXT NOT NULL DEFAULT (datetime('now')),
  current_period_end   TEXT NOT NULL,
  stripe_subscription_id TEXT,
  stripe_customer_id     TEXT,
  cancelled_at    TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── Token Ledger (per-user monthly tracking) ─────────────────────
CREATE TABLE IF NOT EXISTS token_ledger (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  period_start    TEXT NOT NULL,   -- YYYY-MM-01 format
  period_end      TEXT NOT NULL,
  tokens_granted  INTEGER NOT NULL DEFAULT 0,  -- from plan
  tokens_used     INTEGER NOT NULL DEFAULT 0,
  tokens_remaining INTEGER GENERATED ALWAYS AS (tokens_granted - tokens_used) STORED,
  cost_usd        REAL NOT NULL DEFAULT 0.0,   -- platform cost tracking
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, period_start)
);

-- ── Token Usage Log (per AI request) ─────────────────────────────
CREATE TABLE IF NOT EXISTS token_usage (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  intent_id       TEXT,
  request_type    TEXT NOT NULL,   -- intent_generate | chat | analysis
  model_used      TEXT NOT NULL,   -- claude-3-5-haiku | gpt-4o-mini | demo
  prompt_tokens   INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens    INTEGER NOT NULL DEFAULT 0,
  cost_usd        REAL NOT NULL DEFAULT 0.0,
  period_start    TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'success', -- success | error | blocked
  agent_name      TEXT,
  intent_type     TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── Business Profiles ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS business_profiles (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  business_name   TEXT NOT NULL DEFAULT 'My Business',
  owner_name      TEXT NOT NULL DEFAULT '',
  niche           TEXT NOT NULL DEFAULT 'e-commerce',
  sub_niche       TEXT,
  platform        TEXT NOT NULL DEFAULT 'shopify',
  pricing_style   TEXT NOT NULL DEFAULT 'moderate',
  risk_tolerance  TEXT NOT NULL DEFAULT 'balanced',
  monthly_revenue REAL,
  monthly_budget  REAL,
  team_size       TEXT NOT NULL DEFAULT 'solo',
  focus_categories TEXT NOT NULL DEFAULT '[]',  -- JSON array
  top_products    TEXT NOT NULL DEFAULT '[]',   -- JSON array
  preferred_ai    TEXT NOT NULL DEFAULT 'hybrid',
  auto_reject_high_risk INTEGER NOT NULL DEFAULT 0,
  notify_urgent   INTEGER NOT NULL DEFAULT 1,
  onboarding_step INTEGER NOT NULL DEFAULT 0,   -- 0=not started, 5=complete
  goals           TEXT NOT NULL DEFAULT '[]',   -- JSON array
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── Intents (persisted) ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS intents (
  id                  TEXT PRIMARY KEY,
  user_id             TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type                TEXT NOT NULL,
  summary             TEXT NOT NULL,
  detailed_reasoning  TEXT NOT NULL DEFAULT '',
  why_this_matters    TEXT NOT NULL DEFAULT '',
  suggested_next_steps TEXT NOT NULL DEFAULT '[]',  -- JSON
  expected_result     TEXT NOT NULL DEFAULT '',
  alternative_options TEXT NOT NULL DEFAULT '[]',   -- JSON
  risk_level          TEXT NOT NULL DEFAULT 'medium',
  confidence_level    INTEGER NOT NULL DEFAULT 75,
  requires_approval   INTEGER NOT NULL DEFAULT 1,   -- ALWAYS 1
  priority            TEXT NOT NULL DEFAULT 'medium',
  status              TEXT NOT NULL DEFAULT 'pending',
  generated_by        TEXT NOT NULL,
  workflow_id         TEXT,
  schedule_id         TEXT,
  tags                TEXT NOT NULL DEFAULT '[]',   -- JSON
  metadata            TEXT NOT NULL DEFAULT '{}',   -- JSON
  modification_note   TEXT,
  reviewed_at         TEXT,
  tokens_used         INTEGER NOT NULL DEFAULT 0,
  model_used          TEXT NOT NULL DEFAULT 'demo',
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── Workflows (persisted) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS workflows (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  description     TEXT NOT NULL DEFAULT '',
  trigger_type    TEXT NOT NULL DEFAULT 'manual',
  status          TEXT NOT NULL DEFAULT 'draft',
  steps           TEXT NOT NULL DEFAULT '[]',   -- JSON
  current_step    INTEGER NOT NULL DEFAULT 0,
  progress        INTEGER NOT NULL DEFAULT 0,
  agents_involved TEXT NOT NULL DEFAULT '[]',   -- JSON
  total_intents   INTEGER NOT NULL DEFAULT 0,
  approved_intents INTEGER NOT NULL DEFAULT 0,
  tags            TEXT NOT NULL DEFAULT '[]',   -- JSON
  completed_at    TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── Schedules (persisted) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS schedules (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  description     TEXT NOT NULL DEFAULT '',
  intent_type     TEXT NOT NULL,
  agent_name      TEXT NOT NULL,
  frequency       TEXT NOT NULL DEFAULT 'weekly',
  day_of_week     TEXT,
  hour            INTEGER NOT NULL DEFAULT 9,
  is_active       INTEGER NOT NULL DEFAULT 1,
  last_run        TEXT,
  next_run        TEXT NOT NULL,
  total_runs      INTEGER NOT NULL DEFAULT 0,
  intents_generated INTEGER NOT NULL DEFAULT 0,
  context_params  TEXT NOT NULL DEFAULT '{}',   -- JSON
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── Approval Records ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS approvals (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  intent_id   TEXT NOT NULL REFERENCES intents(id) ON DELETE CASCADE,
  decision    TEXT NOT NULL,   -- approved | rejected | modified
  note        TEXT,
  decided_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── Chat History ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_messages (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role        TEXT NOT NULL,   -- user | assistant
  content     TEXT NOT NULL,
  tokens_used INTEGER NOT NULL DEFAULT 0,
  model_used  TEXT NOT NULL DEFAULT 'demo',
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── Approval Patterns (personalization) ──────────────────────────
CREATE TABLE IF NOT EXISTS approval_patterns (
  id                  TEXT PRIMARY KEY,
  user_id             TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  intent_type         TEXT NOT NULL,
  approval_rate       INTEGER NOT NULL DEFAULT 70,
  avg_modification    INTEGER NOT NULL DEFAULT 10,
  last_decision       TEXT,
  total_decisions     INTEGER NOT NULL DEFAULT 0,
  updated_at          TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, intent_type)
);

-- ── Agent Logs ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agent_logs (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  agent_name  TEXT NOT NULL,
  action      TEXT NOT NULL,
  intent_id   TEXT,
  status      TEXT NOT NULL DEFAULT 'success',
  message     TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── Indexes ───────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_sessions_token       ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_user        ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires     ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user   ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_token_ledger_user    ON token_ledger(user_id, period_start);
CREATE INDEX IF NOT EXISTS idx_token_usage_user     ON token_usage(user_id, period_start);
CREATE INDEX IF NOT EXISTS idx_intents_user         ON intents(user_id, status);
CREATE INDEX IF NOT EXISTS idx_intents_created      ON intents(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_workflows_user       ON workflows(user_id);
CREATE INDEX IF NOT EXISTS idx_schedules_user       ON schedules(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_user            ON chat_messages(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_agent_logs_user      ON agent_logs(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_approvals_intent     ON approvals(intent_id);
