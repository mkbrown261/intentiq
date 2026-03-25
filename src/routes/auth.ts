// ================================================================
// AUTH ROUTES — /api/auth
// ================================================================
import { Hono } from 'hono'
import type { Env } from '../lib/platform'
import { registerUser, loginUser } from '../lib/auth'
import { getTokenStatus } from '../lib/platform'

const router = new Hono<{ Bindings: Env }>()

// POST /api/auth/register
router.post('/register', async (c) => {
  const db = c.env?.DB
  if (!db) return c.json({ success: false, error: 'Database not available' }, 503)

  let body: { email?: string; name?: string; password?: string }
  try { body = await c.req.json() } catch { return c.json({ success: false, error: 'Invalid JSON' }, 400) }

  const { email, name, password } = body
  if (!email || !name || !password) return c.json({ success: false, error: 'email, name, and password are required' }, 400)
  if (password.length < 6) return c.json({ success: false, error: 'Password must be at least 6 characters' }, 400)

  const result = await registerUser(db, email.toLowerCase().trim(), name.trim(), password)
  if ('error' in result) return c.json({ success: false, error: result.error }, 400)

  return c.json({
    success: true,
    data: {
      user: result.user,
      sessionToken: result.sessionToken,
      message: 'Account created. Complete onboarding to get started.'
    },
    timestamp: new Date().toISOString()
  }, 201)
})

// POST /api/auth/login
router.post('/login', async (c) => {
  const db = c.env?.DB
  if (!db) {
    // Demo mode: accept any login
    return c.json({
      success: true,
      data: {
        user: { id: 'user-demo', email: 'demo@intentiq.com', name: 'Demo User', role: 'user', onboardingComplete: false },
        sessionToken: 'demo-session-token',
        message: 'Demo mode — no database connected'
      },
      timestamp: new Date().toISOString()
    })
  }

  let body: { email?: string; password?: string }
  try { body = await c.req.json() } catch { return c.json({ success: false, error: 'Invalid JSON' }, 400) }

  const { email, password } = body
  if (!email || !password) return c.json({ success: false, error: 'email and password are required' }, 400)

  const result = await loginUser(db, email.toLowerCase().trim(), password)
  if ('error' in result) return c.json({ success: false, error: result.error }, 401)

  return c.json({
    success: true,
    data: {
      user: result.user,
      sessionToken: result.sessionToken
    },
    timestamp: new Date().toISOString()
  })
})

// GET /api/auth/me — get current user + token status
router.get('/me', async (c) => {
  const db = c.env?.DB
  const authHeader = c.req.header('Authorization')
  const token = authHeader?.replace('Bearer ', '')

  if (!db || !token || token === 'demo-session-token') {
    return c.json({
      success: true,
      data: {
        user: { id: 'user-demo', email: 'demo@intentiq.com', name: 'Demo User', role: 'user', onboardingComplete: false },
        tokens: { tokensGranted: 50000, tokensUsed: 0, tokensRemaining: 50000, planName: 'starter', percentage: 0, hasChat: true },
        mode: 'demo'
      },
      timestamp: new Date().toISOString()
    })
  }

  // Validate session
  const session = await db.prepare(`
    SELECT s.user_id, u.email, u.name, u.role, u.onboarding_complete
    FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token = ? AND s.expires_at > datetime('now')
  `).bind(token).first<{ user_id: string; email: string; name: string; role: string; onboarding_complete: number }>()

  if (!session) return c.json({ success: false, error: 'Invalid session' }, 401)

  const tokenStatus = await getTokenStatus(session.user_id, db)

  return c.json({
    success: true,
    data: {
      user: {
        id: session.user_id,
        email: session.email,
        name: session.name,
        role: session.role,
        onboardingComplete: Boolean(session.onboarding_complete)
      },
      tokens: tokenStatus
    },
    timestamp: new Date().toISOString()
  })
})

// POST /api/auth/logout
router.post('/logout', async (c) => {
  const db = c.env?.DB
  const authHeader = c.req.header('Authorization')
  const token = authHeader?.replace('Bearer ', '')

  if (db && token) {
    await db.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run()
  }

  return c.json({ success: true, message: 'Logged out', timestamp: new Date().toISOString() })
})

// GET /api/auth/plans — public endpoint
router.get('/plans', async (c) => {
  const db = c.env?.DB
  if (!db) {
    return c.json({
      success: true,
      data: [
        { id: 'plan-free', name: 'free', displayName: 'Free', monthlyTokens: 10000, priceMonthly: 0 },
        { id: 'plan-starter', name: 'starter', displayName: 'Starter', monthlyTokens: 50000, priceMonthly: 29 },
        { id: 'plan-pro', name: 'pro', displayName: 'Pro', monthlyTokens: 200000, priceMonthly: 79 }
      ],
      timestamp: new Date().toISOString()
    })
  }

  const plans = await db.prepare('SELECT * FROM plans WHERE is_active = 1 ORDER BY monthly_tokens ASC').all()
  return c.json({ success: true, data: plans.results, timestamp: new Date().toISOString() })
})

export default router
