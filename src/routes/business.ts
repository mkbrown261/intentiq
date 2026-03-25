// ================================================================
// PROFILE, HEALTH & INSIGHTS ROUTES
// ================================================================
import { Hono } from 'hono'
import type { Env } from '../lib/agents'
import { requireAuth } from '../lib/auth'
import { ProfileStore, HealthStore, InsightStore, AgentLogStore } from '../lib/store'

const router = new Hono<{ Bindings: Env }>()

// Default demo profile used when no DB row exists
const DEMO_PROFILE = {
  id: 'user-demo',
  businessName: 'Natural Hair Co.',
  ownerName: 'Demo Owner',
  niche: 'hair products',
  subNiche: 'natural hair care',
  platform: 'shopify',
  pricingStyle: 'moderate',
  riskTolerance: 'balanced',
  monthlyRevenue: 8500,
  monthlyBudget: 5000,
  teamSize: 'solo',
  focusCategories: ['hair care', 'beauty accessories', 'styling tools'],
  topProducts: ['Shea Moisture Curl Cream', 'Edge Control', 'Hair Oil Blend'],
  preferredAI: 'hybrid',
  autoRejectHighRisk: false,
  notifyUrgent: true,
  approvalPatterns: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
}

// ── Profile ──────────────────────────────────────────────────────
router.get('/profile', requireAuth, async (c) => {
  const userId = c.get('userId') as string
  const db = c.env?.DB

  if (!db) {
    return c.json({ success: true, data: ProfileStore.get(), timestamp: new Date().toISOString() })
  }

  // Try to read from D1
  const row = await db.prepare('SELECT * FROM business_profiles WHERE user_id = ?').bind(userId).first<Record<string, unknown>>()

  if (!row) {
    // Auto-seed demo profile for new users
    try {
      await db.prepare(`
        INSERT OR IGNORE INTO business_profiles
          (user_id, business_name, owner_name, niche, sub_niche, platform,
           pricing_style, risk_tolerance, monthly_revenue, monthly_budget,
           team_size, focus_categories, top_products, preferred_ai,
           auto_reject_high_risk, notify_urgent, onboarding_step, goals)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        userId, DEMO_PROFILE.businessName, DEMO_PROFILE.ownerName,
        DEMO_PROFILE.niche, DEMO_PROFILE.subNiche, DEMO_PROFILE.platform,
        DEMO_PROFILE.pricingStyle, DEMO_PROFILE.riskTolerance,
        DEMO_PROFILE.monthlyRevenue, DEMO_PROFILE.monthlyBudget,
        DEMO_PROFILE.teamSize,
        JSON.stringify(DEMO_PROFILE.focusCategories),
        JSON.stringify(DEMO_PROFILE.topProducts),
        DEMO_PROFILE.preferredAI, 0, 1, 0, '[]'
      ).run()
    } catch(_) {}
    return c.json({ success: true, data: DEMO_PROFILE, timestamp: new Date().toISOString() })
  }

  // Map D1 snake_case → camelCase
  const profile = {
    id: userId,
    businessName: row.business_name as string || DEMO_PROFILE.businessName,
    ownerName: row.owner_name as string || '',
    niche: row.niche as string || DEMO_PROFILE.niche,
    subNiche: row.sub_niche as string || '',
    platform: row.platform as string || 'shopify',
    pricingStyle: row.pricing_style as string || 'moderate',
    riskTolerance: row.risk_tolerance as string || 'balanced',
    monthlyRevenue: (row.monthly_revenue as number) || 0,
    monthlyBudget: (row.monthly_budget as number) || 5000,
    teamSize: row.team_size as string || 'solo',
    focusCategories: tryParseJSON(row.focus_categories as string, []),
    topProducts: tryParseJSON(row.top_products as string, []),
    preferredAI: row.preferred_ai as string || 'hybrid',
    autoRejectHighRisk: Boolean(row.auto_reject_high_risk),
    notifyUrgent: Boolean(row.notify_urgent ?? 1),
    approvalPatterns: [],
    createdAt: row.created_at as string || new Date().toISOString(),
    updatedAt: row.updated_at as string || new Date().toISOString()
  }

  // Sync in-memory store
  ProfileStore.update(profile)

  return c.json({ success: true, data: profile, timestamp: new Date().toISOString() })
})

router.patch('/profile', requireAuth, async (c) => {
  const userId = c.get('userId') as string
  const db = c.env?.DB
  const body = await c.req.json()

  if (db) {
    // Build dynamic update query for fields that were sent
    const fieldMap: Record<string, string> = {
      businessName: 'business_name', ownerName: 'owner_name',
      niche: 'niche', subNiche: 'sub_niche', platform: 'platform',
      pricingStyle: 'pricing_style', riskTolerance: 'risk_tolerance',
      monthlyRevenue: 'monthly_revenue', monthlyBudget: 'monthly_budget',
      teamSize: 'team_size', focusCategories: 'focus_categories',
      topProducts: 'top_products', preferredAI: 'preferred_ai',
      autoRejectHighRisk: 'auto_reject_high_risk', notifyUrgent: 'notify_urgent'
    }
    const sets: string[] = []
    const vals: unknown[] = []
    for (const [key, col] of Object.entries(fieldMap)) {
      if (key in body) {
        sets.push(`${col} = ?`)
        const val = body[key]
        vals.push(Array.isArray(val) ? JSON.stringify(val) : val)
      }
    }
    if (sets.length > 0) {
      sets.push("updated_at = datetime('now')")
      vals.push(userId)
      await db.prepare(`UPDATE business_profiles SET ${sets.join(', ')} WHERE user_id = ?`).bind(...vals).run()
    }
  }

  const updated = ProfileStore.update(body)
  return c.json({
    success: true, data: updated,
    message: 'Profile updated. AI agents will use your new settings.',
    timestamp: new Date().toISOString()
  })
})

// ── Health ────────────────────────────────────────────────────────
router.get('/health-score', (c) =>
  c.json({ success: true, data: HealthStore.get(), timestamp: new Date().toISOString() }))

// ── Insights ──────────────────────────────────────────────────────
router.get('/insights', (c) =>
  c.json({ success: true, data: InsightStore.all(), timestamp: new Date().toISOString() }))

// ── Agent Logs ────────────────────────────────────────────────────
router.get('/logs', (c) =>
  c.json({ success: true, data: AgentLogStore.recent(50), timestamp: new Date().toISOString() }))

function tryParseJSON(val: string | null | undefined, fallback: unknown) {
  if (!val) return fallback
  try { return JSON.parse(val) } catch { return fallback }
}

export default router
