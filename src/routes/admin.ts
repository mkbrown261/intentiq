// ================================================================
// ADMIN ROUTES — /api/admin
// Profit Dashboard + Abuse Monitoring + System Stats
// Admin-only: requires X-Admin-Key header matching ADMIN_SECRET
// ================================================================

import { Hono } from 'hono'
import type { Env } from '../lib/platform'
import { getAdminProfitData, getAbuseFlags } from '../lib/platform'

// Extend Env to include ADMIN_SECRET
interface AdminEnv extends Env {
  ADMIN_SECRET?: string
}

const router = new Hono<{ Bindings: AdminEnv }>()

// ── Admin auth middleware ─────────────────────────────────────────
router.use('*', async (c, next) => {
  // Allow demo access if no ADMIN_SECRET set (dev mode)
  const secret = c.env?.ADMIN_SECRET
  if (secret) {
    const key = c.req.header('X-Admin-Key') ?? c.req.query('admin_key')
    if (key !== secret) {
      return c.json({ success: false, error: 'Unauthorized. Admin access required.' }, 401)
    }
  }
  await next()
})

// ================================================================
// GET /api/admin/profit — Profit dashboard data
// ================================================================
router.get('/profit', async (c) => {
  const db = c.env?.DB
  if (!db) {
    return c.json({
      success: true,
      data: getDemoProfitData(),
      note: 'Demo data — DB not connected',
      timestamp: new Date().toISOString()
    })
  }

  try {
    const data = await getAdminProfitData(db)
    return c.json({ success: true, data, timestamp: new Date().toISOString() })
  } catch (err) {
    console.error('[Admin/profit]', err)
    return c.json({ success: false, error: String(err) }, 500)
  }
})

// ================================================================
// GET /api/admin/abuse — Active abuse flags
// ================================================================
router.get('/abuse', async (c) => {
  const db = c.env?.DB
  if (!db) {
    return c.json({ success: true, data: [], note: 'DB not connected', timestamp: new Date().toISOString() })
  }

  try {
    const flags = await getAbuseFlags(db)
    return c.json({ success: true, data: flags, count: flags.length, timestamp: new Date().toISOString() })
  } catch (err) {
    return c.json({ success: false, error: String(err) }, 500)
  }
})

// ================================================================
// POST /api/admin/abuse/:id/resolve — Resolve an abuse flag
// ================================================================
router.post('/abuse/:id/resolve', async (c) => {
  const db = c.env?.DB
  if (!db) return c.json({ success: false, error: 'DB not connected' }, 503)

  const id = c.req.param('id')
  await db.prepare(`
    UPDATE abuse_flags SET auto_resolved = 1, resolved_at = datetime('now')
    WHERE id = ?
  `).bind(id).run()

  return c.json({ success: true, message: 'Flag resolved', timestamp: new Date().toISOString() })
})

// ================================================================
// POST /api/admin/abuse/:userId/ban — Ban a user
// ================================================================
router.post('/abuse/:userId/ban', async (c) => {
  const db = c.env?.DB
  if (!db) return c.json({ success: false, error: 'DB not connected' }, 503)

  const userId = c.req.param('userId')
  const { reason } = await c.req.json().catch(() => ({ reason: 'Admin ban' }))

  // Insert ban flag
  const id = `flag-ban-${Date.now()}`
  await db.prepare(`
    INSERT INTO abuse_flags (id, user_id, flag_type, severity, details)
    VALUES (?, ?, 'admin_ban', 'banned', ?)
  `).bind(id, userId, reason ?? 'Admin ban').run()

  return c.json({ success: true, message: `User ${userId} banned`, timestamp: new Date().toISOString() })
})

// ================================================================
// GET /api/admin/users — User list with subscription status
// ================================================================
router.get('/users', async (c) => {
  const db = c.env?.DB
  if (!db) return c.json({ success: true, data: [], note: 'DB not connected', timestamp: new Date().toISOString() })

  try {
    const users = await db.prepare(`
      SELECT u.id, u.email, u.name, u.role, u.created_at, u.last_login,
             p.name as plan_name, p.display_name, p.price_monthly,
             s.status as sub_status,
             tl.tokens_granted, tl.tokens_used, tl.cost_usd,
             (tl.tokens_granted - tl.tokens_used) as tokens_remaining
      FROM users u
      LEFT JOIN subscriptions s ON s.user_id = u.id AND s.status = 'active'
      LEFT JOIN plans p ON p.id = s.plan_id
      LEFT JOIN token_ledger tl ON tl.user_id = u.id
        AND tl.period_start = date('now', 'start of month')
      ORDER BY u.created_at DESC
      LIMIT 100
    `).all()

    return c.json({
      success: true, data: users.results,
      count: users.results.length,
      timestamp: new Date().toISOString()
    })
  } catch (err) {
    return c.json({ success: false, error: String(err) }, 500)
  }
})

// ================================================================
// GET /api/admin/stats — Platform-wide stats
// ================================================================
router.get('/stats', async (c) => {
  const db = c.env?.DB
  if (!db) {
    return c.json({ success: true, data: getDemoStats(), note: 'Demo data', timestamp: new Date().toISOString() })
  }

  try {
    const period = getPeriodStart()
    const today = getToday()

    const [users, subs, tokens, requests, cache, topUsers] = await Promise.all([
      db.prepare(`SELECT COUNT(*) as total, COUNT(CASE WHEN created_at > date('now', '-7 days') THEN 1 END) as new_7d FROM users`).first(),
      db.prepare(`
        SELECT p.name, COUNT(*) as count, SUM(p.price_monthly) as mrr
        FROM subscriptions s JOIN plans p ON p.id = s.plan_id
        WHERE s.status = 'active'
        GROUP BY p.name
      `).all(),
      db.prepare(`
        SELECT SUM(tokens_used) as total_tokens_used, SUM(cost_usd) as total_cost,
               COUNT(*) as total_requests
        FROM token_ledger WHERE period_start = ?
      `).bind(period).first(),
      db.prepare(`
        SELECT status, COUNT(*) as count FROM request_log
        WHERE created_at > date('now', '-1 day')
        GROUP BY status
      `).all(),
      db.prepare(`
        SELECT COUNT(*) as entries, SUM(hits) as total_hits,
               SUM(CASE WHEN expires_at > datetime('now') THEN 1 ELSE 0 END) as active
        FROM response_cache
      `).first(),
      db.prepare(`
        SELECT u.email, tl.tokens_used, tl.cost_usd
        FROM token_ledger tl JOIN users u ON u.id = tl.user_id
        WHERE tl.period_start = ?
        ORDER BY tl.tokens_used DESC LIMIT 5
      `).bind(period).all()
    ])

    const u = users as Record<string, number>
    const t = tokens as Record<string, number>

    return c.json({
      success: true,
      data: {
        users: { total: u?.total ?? 0, new7d: u?.new_7d ?? 0 },
        subscriptions: subs.results,
        tokens: {
          totalUsed: t?.total_tokens_used ?? 0,
          totalCost: t?.total_cost ?? 0,
          totalRequests: t?.total_requests ?? 0,
          period
        },
        requests: requests.results,
        cache: cache,
        topUsers: topUsers.results,
        today
      },
      timestamp: new Date().toISOString()
    })
  } catch (err) {
    return c.json({ success: false, error: String(err) }, 500)
  }
})

// ================================================================
// GET /api/admin/usage-breakdown — Per-feature cost breakdown
// ================================================================
router.get('/usage-breakdown', async (c) => {
  const db = c.env?.DB
  if (!db) return c.json({ success: true, data: [], timestamp: new Date().toISOString() })

  const period = getPeriodStart()
  try {
    const breakdown = await db.prepare(`
      SELECT
        request_type,
        model_used,
        COUNT(*) as requests,
        SUM(prompt_tokens) as prompt_tokens,
        SUM(completion_tokens) as completion_tokens,
        SUM(total_tokens) as total_tokens,
        SUM(cost_usd) as cost_usd,
        AVG(total_tokens) as avg_tokens
      FROM token_usage
      WHERE period_start = ?
      GROUP BY request_type, model_used
      ORDER BY cost_usd DESC
    `).bind(period).all()

    return c.json({ success: true, data: breakdown.results, period, timestamp: new Date().toISOString() })
  } catch (err) {
    return c.json({ success: false, error: String(err) }, 500)
  }
})

// ================================================================
// GET /api/admin/cache-stats — Response cache performance
// ================================================================
router.get('/cache-stats', async (c) => {
  const db = c.env?.DB
  if (!db) return c.json({ success: true, data: {}, timestamp: new Date().toISOString() })

  try {
    const [stats, topHits] = await Promise.all([
      db.prepare(`
        SELECT
          COUNT(*) as total_entries,
          SUM(hits) as total_hits,
          SUM(CASE WHEN expires_at > datetime('now') THEN 1 ELSE 0 END) as active_entries,
          SUM(CASE WHEN expires_at <= datetime('now') THEN 1 ELSE 0 END) as expired_entries
        FROM response_cache
      `).first(),
      db.prepare(`
        SELECT cache_key, intent_type, hits, expires_at
        FROM response_cache WHERE expires_at > datetime('now')
        ORDER BY hits DESC LIMIT 10
      `).all()
    ])

    return c.json({ success: true, data: { stats, topHits: topHits.results }, timestamp: new Date().toISOString() })
  } catch (err) {
    return c.json({ success: false, error: String(err) }, 500)
  }
})

// ================================================================
// DELETE /api/admin/cache — Clear expired cache entries
// ================================================================
router.delete('/cache', async (c) => {
  const db = c.env?.DB
  if (!db) return c.json({ success: false, error: 'DB not connected' }, 503)

  const result = await db.prepare(`DELETE FROM response_cache WHERE expires_at <= datetime('now')`).run()
  return c.json({
    success: true,
    message: `Cleared ${result.meta.changes} expired cache entries`,
    timestamp: new Date().toISOString()
  })
})

// ================================================================
// DEMO DATA (no DB)
// ================================================================
function getDemoProfitData() {
  return {
    period: getPeriodStart(),
    summary: {
      totalRevenue: 290.00,
      totalCost: 0.0012,
      totalProfit: 289.9988,
      profitMargin: 99.9,
      totalUsers: 1,
      totalTokens: 500
    },
    perUser: [
      { email: 'demo@intentiq.com', plan_name: 'starter', price_monthly: 10, tokens_used: 500, cost_usd: 0.0012, profit: 9.9988, is_profitable: 1 }
    ],
    featureBreakdown: [
      { request_type: 'chat_message', model_used: 'demo', requests: 3, tokens: 300, cost: 0 },
      { request_type: 'intent_generate', model_used: 'demo', requests: 2, tokens: 200, cost: 0 }
    ],
    highCostAlerts: []
  }
}

function getDemoStats() {
  return {
    users: { total: 1, new7d: 1 },
    subscriptions: [{ name: 'starter', count: 1, mrr: 10 }],
    tokens: { totalUsed: 500, totalCost: 0, totalRequests: 5, period: getPeriodStart() },
    requests: [{ status: 'ok', count: 5 }],
    cache: { total_entries: 0, total_hits: 0, active_entries: 0, expired_entries: 0 },
    topUsers: [],
    today: getToday()
  }
}

function getPeriodStart(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

function getToday(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default router
