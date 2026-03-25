// ================================================================
// AUTH SERVICE — User Auth, Sessions, JWT
// ================================================================
// Simple session-based auth using D1.
// In production: add bcrypt for password hashing.
// ================================================================

import type { Context, Next } from 'hono'
import { genId } from './store'
import type { Env } from './platform'

const SESSION_TTL_HOURS = 24 * 7  // 7 days

// ── Simple hash (demo-safe, not prod-grade) ───────────────────────
// In production: use bcrypt or Argon2 via a worker-compatible lib
export function hashPassword(password: string): string {
  // XOR + base64 encode — for demo only
  // Replace with a proper hash in production
  let hash = 0
  for (let i = 0; i < password.length; i++) {
    hash = ((hash << 5) - hash) + password.charCodeAt(i)
    hash |= 0
  }
  return `demo-hash-${Math.abs(hash).toString(16)}-${password.length}`
}

export function verifyPassword(password: string, hash: string): boolean {
  return hashPassword(password) === hash
}

// ── Create session token ──────────────────────────────────────────
export function generateSessionToken(): string {
  const arr = new Uint8Array(32)
  crypto.getRandomValues(arr)
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('')
}

// ── Register new user ─────────────────────────────────────────────
export async function registerUser(
  db: D1Database,
  email: string,
  name: string,
  password: string
): Promise<{ user: Record<string, unknown>; sessionToken: string } | { error: string }> {
  // Check existing
  const existing = await db.prepare('SELECT id FROM users WHERE email = ?').bind(email).first()
  if (existing) return { error: 'Email already registered' }

  const userId = genId('user')
  const passwordHash = hashPassword(password)
  const now = new Date().toISOString()

  // Create user
  await db.prepare(`
    INSERT INTO users (id, email, name, password_hash, role, created_at, updated_at, is_active, onboarding_complete)
    VALUES (?, ?, ?, ?, 'user', ?, ?, 1, 0)
  `).bind(userId, email, name, passwordHash, now, now).run()

  // Assign free plan
  const subId = genId('sub')
  const periodEnd = new Date()
  periodEnd.setMonth(periodEnd.getMonth() + 1)

  await db.prepare(`
    INSERT INTO subscriptions (id, user_id, plan_id, status, current_period_start, current_period_end)
    VALUES (?, ?, 'plan-free', 'active', ?, ?)
  `).bind(subId, userId, now, periodEnd.toISOString()).run()

  // Create token ledger for current period
  const period = getPeriodStart()
  const periodEndStr = getPeriodEnd()
  await db.prepare(`
    INSERT OR IGNORE INTO token_ledger (id, user_id, period_start, period_end, tokens_granted, tokens_used, cost_usd)
    VALUES (?, ?, ?, ?, 10000, 0, 0)
  `).bind(`ledger-${userId}-${period}`, userId, period, periodEndStr).run()

  // Create business profile
  await db.prepare(`
    INSERT INTO business_profiles (id, user_id, business_name, owner_name, created_at, updated_at)
    VALUES (?, ?, 'My Business', ?, ?, ?)
  `).bind(genId('bp'), userId, name, now, now).run()

  // Create session
  const sessionToken = generateSessionToken()
  const expiresAt = new Date(Date.now() + SESSION_TTL_HOURS * 3600 * 1000).toISOString()

  await db.prepare(`
    INSERT INTO sessions (id, user_id, token, expires_at, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).bind(genId('sess'), userId, sessionToken, expiresAt, now).run()

  const user = await db.prepare('SELECT id, email, name, role, onboarding_complete FROM users WHERE id = ?').bind(userId).first()
  return { user: user as Record<string, unknown>, sessionToken }
}

// ── Login ─────────────────────────────────────────────────────────
export async function loginUser(
  db: D1Database,
  email: string,
  password: string
): Promise<{ user: Record<string, unknown>; sessionToken: string } | { error: string }> {
  const user = await db.prepare(
    'SELECT id, email, name, role, password_hash, onboarding_complete, is_active FROM users WHERE email = ?'
  ).bind(email).first<{
    id: string; email: string; name: string; role: string;
    password_hash: string; onboarding_complete: number; is_active: number
  }>()

  if (!user || !user.is_active) return { error: 'Invalid email or password' }
  if (!verifyPassword(password, user.password_hash)) return { error: 'Invalid email or password' }

  // Update last login
  await db.prepare("UPDATE users SET last_login = datetime('now'), updated_at = datetime('now') WHERE id = ?")
    .bind(user.id).run()

  // Create session
  const sessionToken = generateSessionToken()
  const expiresAt = new Date(Date.now() + SESSION_TTL_HOURS * 3600 * 1000).toISOString()
  const now = new Date().toISOString()

  await db.prepare(`
    INSERT INTO sessions (id, user_id, token, expires_at, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).bind(genId('sess'), user.id, sessionToken, expiresAt, now).run()

  // Ensure token ledger exists
  const period = getPeriodStart()
  const periodEnd = getPeriodEnd()
  const sub = await db.prepare(`
    SELECT p.monthly_tokens FROM subscriptions s JOIN plans p ON p.id = s.plan_id
    WHERE s.user_id = ? AND s.status = 'active' LIMIT 1
  `).bind(user.id).first<{ monthly_tokens: number }>()

  await db.prepare(`
    INSERT OR IGNORE INTO token_ledger (id, user_id, period_start, period_end, tokens_granted, tokens_used, cost_usd)
    VALUES (?, ?, ?, ?, ?, 0, 0)
  `).bind(`ledger-${user.id}-${period}`, user.id, period, periodEnd, sub?.monthly_tokens ?? 10000).run()

  return {
    user: { id: user.id, email: user.email, name: user.name, role: user.role, onboarding_complete: user.onboarding_complete },
    sessionToken
  }
}

// ── Get session ───────────────────────────────────────────────────
export async function getSession(
  db: D1Database,
  token: string
): Promise<{ userId: string; user: Record<string, unknown> } | null> {
  const session = await db.prepare(`
    SELECT s.user_id, s.expires_at, u.id, u.email, u.name, u.role, u.onboarding_complete, u.is_active
    FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token = ? AND s.expires_at > datetime('now')
  `).bind(token).first<{
    user_id: string; expires_at: string;
    id: string; email: string; name: string; role: string;
    onboarding_complete: number; is_active: number
  }>()

  if (!session || !session.is_active) return null

  return {
    userId: session.user_id,
    user: {
      id: session.id,
      email: session.email,
      name: session.name,
      role: session.role,
      onboardingComplete: Boolean(session.onboarding_complete)
    }
  }
}

// ── Auth Middleware ───────────────────────────────────────────────
export async function requireAuth(c: Context<{ Bindings: Env }>, next: Next) {
  const db = c.env?.DB
  if (!db) {
    // No DB: demo mode, use default user
    c.set('userId', 'user-demo')
    c.set('user', { id: 'user-demo', email: 'demo@intentiq.com', name: 'Demo User', role: 'user', onboardingComplete: false })
    await next()
    return
  }

  const authHeader = c.req.header('Authorization')
  const cookieToken = getCookieToken(c.req.header('Cookie') ?? '')
  const token = authHeader?.replace('Bearer ', '') ?? cookieToken

  if (!token) {
    // No token: use demo user for now (proper auth can be added later)
    c.set('userId', 'user-demo')
    c.set('user', { id: 'user-demo', name: 'Demo User', role: 'user', onboardingComplete: false })
    await next()
    return
  }

  const session = await getSession(db, token)
  if (!session) {
    return c.json({ success: false, error: 'Session expired. Please log in.' }, 401)
  }

  c.set('userId', session.userId)
  c.set('user', session.user)
  await next()
}

function getCookieToken(cookieHeader: string): string | null {
  const match = cookieHeader.match(/intentiq_session=([^;]+)/)
  return match ? match[1] : null
}

function getPeriodStart(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

function getPeriodEnd(): string {
  const d = new Date()
  d.setMonth(d.getMonth() + 1, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}
