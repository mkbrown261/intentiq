-- ================================================================
-- IntentIQ OS — Seed Data
-- Migration 0002: Plans + Default Admin User
-- ================================================================

-- ── Plans ─────────────────────────────────────────────────────────
INSERT OR IGNORE INTO plans (id, name, display_name, monthly_tokens, price_monthly, price_yearly, max_agents, max_schedules, max_workflows, has_chat, has_analytics, has_integrations, has_priority_ai) VALUES
  ('plan-free',       'free',       'Free',       10000,  0,    0,    2, 2, 1, 0, 0, 0, 0),
  ('plan-starter',    'starter',    'Starter',    50000,  29,   290,  5, 5, 3, 1, 1, 0, 0),
  ('plan-pro',        'pro',        'Pro',        200000, 79,   790,  7, 20, 10, 1, 1, 1, 1),
  ('plan-enterprise', 'enterprise', 'Enterprise', 1000000, 299, 2990, 7, 100, 100, 1, 1, 1, 1);

-- ── Default Demo User (password: demo1234) ────────────────────────
-- Password hash is bcrypt of "demo1234" — for demo/dev only
INSERT OR IGNORE INTO users (id, email, name, password_hash, role, onboarding_complete) VALUES
  ('user-demo', 'demo@intentiq.com', 'Demo User', '$2a$10$demo_hash_placeholder', 'user', 0);

-- ── Subscription for demo user ────────────────────────────────────
INSERT OR IGNORE INTO subscriptions (id, user_id, plan_id, status, current_period_start, current_period_end) VALUES
  ('sub-demo', 'user-demo', 'plan-starter', 'active', datetime('now'), datetime('now', '+30 days'));

-- ── Token Ledger for demo user ────────────────────────────────────
INSERT OR IGNORE INTO token_ledger (id, user_id, period_start, period_end, tokens_granted, tokens_used, cost_usd) VALUES
  ('ledger-demo-' || strftime('%Y%m', 'now'),
   'user-demo',
   strftime('%Y-%m-01', 'now'),
   strftime('%Y-%m-01', 'now', '+1 month'),
   50000, 0, 0.0);
