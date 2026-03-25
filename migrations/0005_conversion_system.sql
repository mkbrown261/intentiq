-- ================================================================
-- IntentIQ OS — Migration 0005
-- Conversion Optimization: Triggers, Events, A/B Tests
-- ================================================================

-- ── upgrade_trigger_events: log every upgrade prompt shown ────────
CREATE TABLE IF NOT EXISTS upgrade_trigger_events (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL,
  trigger_type  TEXT NOT NULL,  -- token_50, token_80, token_100, feature_lock,
                                 -- value_moment, frequency, success_based
  trigger_data  TEXT NOT NULL DEFAULT '{}',   -- JSON: reason, feature, intent_type etc
  plan_name     TEXT NOT NULL DEFAULT 'free',
  suggested_plan TEXT NOT NULL DEFAULT 'starter',
  urgency       TEXT NOT NULL DEFAULT 'medium', -- low, medium, high, critical
  ab_variant    TEXT NOT NULL DEFAULT 'A',
  was_shown     INTEGER NOT NULL DEFAULT 1,
  user_action   TEXT,           -- dismissed, clicked, converted, ignored
  acted_at      TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── conversion_events: track actual upgrade decisions ─────────────
CREATE TABLE IF NOT EXISTS conversion_events (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL,
  trigger_id      TEXT,          -- FK to upgrade_trigger_events
  from_plan       TEXT NOT NULL DEFAULT 'free',
  to_plan         TEXT NOT NULL DEFAULT 'starter',
  conversion_type TEXT NOT NULL DEFAULT 'upgrade', -- upgrade, downgrade, cancel
  revenue_delta   REAL NOT NULL DEFAULT 0.0,
  trigger_type    TEXT,          -- what caused the conversion
  time_to_convert INTEGER,       -- seconds from first trigger to convert
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── ab_test_config: message variants per trigger type ─────────────
CREATE TABLE IF NOT EXISTS ab_test_config (
  id            TEXT PRIMARY KEY,
  test_name     TEXT NOT NULL UNIQUE,
  trigger_type  TEXT NOT NULL,
  variant_a     TEXT NOT NULL DEFAULT '{}',   -- JSON: {headline, body, cta, urgency}
  variant_b     TEXT NOT NULL DEFAULT '{}',
  variant_c     TEXT,
  traffic_split TEXT NOT NULL DEFAULT '50:50', -- "50:50", "33:33:34"
  is_active     INTEGER NOT NULL DEFAULT 1,
  winner        TEXT,           -- A, B, C — set after analysis
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── user_behavior: track engagement signals ───────────────────────
CREATE TABLE IF NOT EXISTS user_behavior (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL,
  event_type      TEXT NOT NULL,  -- intent_approved, intent_generated, chat_used,
                                   -- feature_locked_hit, daily_active, value_seen
  event_data      TEXT NOT NULL DEFAULT '{}',
  session_date    TEXT NOT NULL DEFAULT (date('now')),
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── upgrade_intents: store upgrade suggestions as intents ─────────
CREATE TABLE IF NOT EXISTS upgrade_intents (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL,
  trigger_type    TEXT NOT NULL,
  suggested_plan  TEXT NOT NULL DEFAULT 'starter',
  headline        TEXT NOT NULL DEFAULT '',
  body            TEXT NOT NULL DEFAULT '',
  benefits        TEXT NOT NULL DEFAULT '[]',  -- JSON array
  urgency         TEXT NOT NULL DEFAULT 'medium',
  personalized_for TEXT NOT NULL DEFAULT 'general',
  status          TEXT NOT NULL DEFAULT 'pending', -- pending, shown, acted, dismissed
  ab_variant      TEXT NOT NULL DEFAULT 'A',
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── Indexes ───────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_trigger_user     ON upgrade_trigger_events(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_trigger_type     ON upgrade_trigger_events(trigger_type);
CREATE INDEX IF NOT EXISTS idx_conversion_user  ON conversion_events(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_behavior_user    ON user_behavior(user_id, session_date);
CREATE INDEX IF NOT EXISTS idx_upgrade_intent   ON upgrade_intents(user_id, status);

-- ── Seed A/B test configs ─────────────────────────────────────────
INSERT OR IGNORE INTO ab_test_config (id, test_name, trigger_type, variant_a, variant_b, traffic_split) VALUES
  ('ab-token80', 'token_80_message', 'token_80',
   '{"headline":"You''re using AI like a pro","body":"You''ve used 80% of your monthly AI power. Upgrade now to keep the momentum going.","cta":"Unlock More Power","urgency":"medium"}',
   '{"headline":"Don''t lose your insights","body":"80% of your tokens are gone. Your AI agents have more ideas — give them room to share.","cta":"Continue Generating","urgency":"high"}',
   '50:50'),

  ('ab-feature-lock', 'feature_lock_message', 'feature_lock',
   '{"headline":"Unlock this feature","body":"This capability is available on Starter and above. See what your competitors are doing.","cta":"Upgrade to Starter","urgency":"medium"}',
   '{"headline":"Your competitors are using this","body":"Market Research, Scheduling, and Advanced Agents are helping Starter users grow 2x faster.","cta":"Get Full Access","urgency":"high"}',
   '50:50'),

  ('ab-value-moment', 'value_moment_message', 'value_moment',
   '{"headline":"Great insight generated","body":"This recommendation could move the needle for your business. Unlock more like this with Pro.","cta":"Unlock More Insights","urgency":"low"}',
   '{"headline":"Your AI just found an opportunity","body":"Pro users get 3.6M tokens to act on insights like this all month long.","cta":"See Pro Plan","urgency":"medium"}',
   '50:50'),

  ('ab-frequency', 'frequency_trigger', 'frequency',
   '{"headline":"You''re a power user","body":"You use IntentIQ daily — upgrade to get uninterrupted AI access with higher limits.","cta":"Upgrade Plan","urgency":"medium"}',
   '{"headline":"You''re getting real value","body":"Daily users on Pro see 40% better business outcomes. Don''t let limits slow you down.","cta":"Go Pro","urgency":"high"}',
   '50:50'),

  ('ab-success', 'success_trigger', 'success_based',
   '{"headline":"Your business is growing","body":"You''re actively using AI recommendations. Automate the next step with Pro scheduling.","cta":"Unlock Automation","urgency":"low"}',
   '{"headline":"Keep the momentum going","body":"You''ve approved intents and acted on them. Scale faster with automated AI workflows.","cta":"Automate Now","urgency":"medium"}',
   '50:50');
