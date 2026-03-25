// ================================================================
// UPGRADE ROUTES — /api/upgrade
// Conversion engine API. All upgrade suggestions are INTENTS.
// Never auto-upgrades. Returns trigger data for frontend rendering.
// ================================================================

import { Hono } from 'hono'
import type { Env } from '../lib/platform'
import { requireAuth } from '../lib/auth'
import { getTokenStatus } from '../lib/platform'
import { ProfileStore, genId } from '../lib/store'
import {
  checkTrigger, logTriggerEvent, recordTriggerAction,
  logBehavior, getUserBehaviorScore,
  isHighValueIntent, getIntentValueEstimate,
  getConversionAnalytics, LOCKED_FEATURES, getABVariant
} from '../lib/conversion'

const router = new Hono<{ Bindings: Env }>()

// ================================================================
// GET /api/upgrade/check — Main trigger evaluation endpoint
// Call on page load, after intent generation, after feature block.
// Returns zero or one trigger (never spam multiple).
// ================================================================
router.get('/check', requireAuth, async (c) => {
  const userId = c.get('userId') as string
  const db = c.env?.DB
  const { context } = c.req.query()  // optional context hint: 'dashboard', 'intent', etc

  if (!db) {
    return c.json({ success: true, data: { trigger: null, shouldShow: false }, timestamp: new Date().toISOString() })
  }

  // Get token status + behavior in parallel
  const [tokenStatus, behavior] = await Promise.all([
    getTokenStatus(userId, db),
    getUserBehaviorScore(userId, db)
  ])

  const planName = tokenStatus.planName ?? 'free'
  const pct = tokenStatus.percentage ?? 0
  const niche = ProfileStore.get()?.niche ?? 'e-commerce'

  // Priority order: most urgent trigger wins
  // Rule: only ONE trigger per check (anti-spam)

  // 1. HARD BLOCK — 100%
  if (pct >= 100) {
    const result = await checkTrigger(userId, 'token_100', { tokenPct: pct, planName, niche }, db)
    if (result.shouldTrigger && result.trigger) {
      await logTriggerEvent(db, userId, result.trigger, planName)
      return c.json({ success: true, data: { trigger: result.trigger, shouldShow: true }, timestamp: new Date().toISOString() })
    }
  }

  // 2. TOKEN 80% warning
  if (pct >= 80 && pct < 100) {
    const result = await checkTrigger(userId, 'token_80', { tokenPct: pct, planName, niche }, db)
    if (result.shouldTrigger && result.trigger) {
      await logTriggerEvent(db, userId, result.trigger, planName)
      return c.json({ success: true, data: { trigger: result.trigger, shouldShow: true }, timestamp: new Date().toISOString() })
    }
  }

  // 3. TOKEN 50% awareness (only free users — paid users don't need this nudge)
  if (pct >= 50 && pct < 80 && planName === 'free') {
    const result = await checkTrigger(userId, 'token_50', { tokenPct: pct, planName, niche }, db)
    if (result.shouldTrigger && result.trigger) {
      await logTriggerEvent(db, userId, result.trigger, planName)
      return c.json({ success: true, data: { trigger: result.trigger, shouldShow: true }, timestamp: new Date().toISOString() })
    }
  }

  // 4. FREQUENCY trigger — power user pattern
  if (behavior.shouldFireFrequency && planName === 'free') {
    const result = await checkTrigger(userId, 'frequency', { planName, niche }, db)
    if (result.shouldTrigger && result.trigger) {
      await logTriggerEvent(db, userId, result.trigger, planName)
      return c.json({ success: true, data: { trigger: result.trigger, shouldShow: true }, timestamp: new Date().toISOString() })
    }
  }

  // 5. SUCCESS trigger — user acting on recommendations
  if (behavior.shouldFireSuccess && planName === 'free') {
    const result = await checkTrigger(userId, 'success_based', { planName, niche }, db)
    if (result.shouldTrigger && result.trigger) {
      await logTriggerEvent(db, userId, result.trigger, planName)
      return c.json({ success: true, data: { trigger: result.trigger, shouldShow: true }, timestamp: new Date().toISOString() })
    }
  }

  // No trigger fires
  return c.json({ success: true, data: { trigger: null, shouldShow: false }, timestamp: new Date().toISOString() })
})

// ================================================================
// POST /api/upgrade/intent-value — Check if intent is high-value
// Called after intent generation to potentially fire value_moment
// ================================================================
router.post('/intent-value', requireAuth, async (c) => {
  const userId = c.get('userId') as string
  const db = c.env?.DB

  let body: { intentType?: string; planName?: string }
  try { body = await c.req.json() } catch { return c.json({ success: false, error: 'Invalid JSON' }, 400) }

  const { intentType, planName = 'free' } = body
  if (!intentType) return c.json({ success: false, error: 'intentType required' }, 400)

  const isHighValue = isHighValueIntent(intentType)

  if (!isHighValue || !db) {
    return c.json({ success: true, data: { trigger: null, shouldShow: false, isHighValue: false }, timestamp: new Date().toISOString() })
  }

  // Log behavior
  await logBehavior(db, userId, 'intent_generated', { intentType })

  // Only fire value_moment for free/starter users
  if (['pro', 'scale'].includes(planName)) {
    return c.json({ success: true, data: { trigger: null, shouldShow: false, isHighValue: true }, timestamp: new Date().toISOString() })
  }

  const niche = ProfileStore.get()?.niche ?? 'e-commerce'
  const valueEstimate = getIntentValueEstimate(intentType)
  const result = await checkTrigger(userId, 'value_moment', {
    intentType, intentValue: valueEstimate, planName, niche
  }, db)

  if (result.shouldTrigger && result.trigger) {
    await logTriggerEvent(db, userId, result.trigger, planName)
    return c.json({ success: true, data: { trigger: result.trigger, shouldShow: true, isHighValue: true }, timestamp: new Date().toISOString() })
  }

  return c.json({ success: true, data: { trigger: null, shouldShow: false, isHighValue: true }, timestamp: new Date().toISOString() })
})

// ================================================================
// POST /api/upgrade/feature-lock — Feature access denied trigger
// ================================================================
router.post('/feature-lock', requireAuth, async (c) => {
  const userId = c.get('userId') as string
  const db = c.env?.DB

  let body: { featureKey?: string; planName?: string }
  try { body = await c.req.json() } catch { return c.json({ success: false, error: 'Invalid JSON' }, 400) }

  const { featureKey, planName = 'free' } = body
  if (!featureKey) return c.json({ success: false, error: 'featureKey required' }, 400)

  const featureData = LOCKED_FEATURES[featureKey]
  if (!featureData) return c.json({ success: false, error: 'Unknown feature' }, 404)

  if (db) {
    await logBehavior(db, userId, 'feature_locked_hit', { featureKey, planName })
  }

  const niche = ProfileStore.get()?.niche ?? 'e-commerce'
  const result = db
    ? await checkTrigger(userId, 'feature_lock', { featureKey, planName, niche }, db)
    : { shouldTrigger: true, trigger: buildFallbackFeatureTrigger(userId, featureKey, featureData, planName) }

  if (result.shouldTrigger && result.trigger) {
    if (db) await logTriggerEvent(db, userId, result.trigger, planName)
    return c.json({
      success: true,
      data: {
        trigger: result.trigger,
        shouldShow: true,
        featureData,
        requiredPlan: featureData.requiredPlan
      },
      timestamp: new Date().toISOString()
    })
  }

  return c.json({ success: true, data: { trigger: null, shouldShow: false, featureData }, timestamp: new Date().toISOString() })
})

// ================================================================
// POST /api/upgrade/behavior — Log a behavior event
// ================================================================
router.post('/behavior', requireAuth, async (c) => {
  const userId = c.get('userId') as string
  const db = c.env?.DB
  if (!db) return c.json({ success: true, timestamp: new Date().toISOString() })

  let body: { eventType?: string; eventData?: Record<string, unknown> }
  try { body = await c.req.json() } catch { return c.json({ success: false, error: 'Invalid JSON' }, 400) }

  const { eventType, eventData = {} } = body
  if (!eventType) return c.json({ success: false, error: 'eventType required' }, 400)

  await logBehavior(db, userId, eventType, eventData)
  return c.json({ success: true, timestamp: new Date().toISOString() })
})

// ================================================================
// POST /api/upgrade/action — User acted on a trigger
// ================================================================
router.post('/action', requireAuth, async (c) => {
  const userId = c.get('userId') as string
  const db = c.env?.DB
  if (!db) return c.json({ success: true, timestamp: new Date().toISOString() })

  let body: { triggerId?: string; action?: string }
  try { body = await c.req.json() } catch { return c.json({ success: false, error: 'Invalid JSON' }, 400) }

  const { triggerId, action } = body
  if (!triggerId || !action) return c.json({ success: false, error: 'triggerId and action required' }, 400)

  await recordTriggerAction(db, triggerId, action as 'dismissed' | 'clicked' | 'converted' | 'ignored')

  return c.json({ success: true, timestamp: new Date().toISOString() })
})

// ================================================================
// GET /api/upgrade/analytics — Conversion funnel data (admin use)
// ================================================================
router.get('/analytics', async (c) => {
  const db = c.env?.DB
  if (!db) {
    return c.json({ success: true, data: getDemoAnalytics(), note: 'Demo data', timestamp: new Date().toISOString() })
  }

  const data = await getConversionAnalytics(db)
  return c.json({ success: true, data, timestamp: new Date().toISOString() })
})

// ================================================================
// GET /api/upgrade/locked-features — Get all locked features for current plan
// ================================================================
router.get('/locked-features', requireAuth, async (c) => {
  const userId = c.get('userId') as string
  const db = c.env?.DB

  let planName = 'free'
  if (db) {
    const status = await getTokenStatus(userId, db)
    planName = status.planName ?? 'free'
  }

  const planHierarchy = ['free', 'starter', 'pro', 'scale']
  const currentLevel = planHierarchy.indexOf(planName)

  const locked = Object.entries(LOCKED_FEATURES)
    .filter(([_, f]) => planHierarchy.indexOf(f.requiredPlan) > currentLevel)
    .map(([key, f]) => ({ key, ...f }))

  return c.json({
    success: true,
    data: { locked, planName, count: locked.length },
    timestamp: new Date().toISOString()
  })
})

// ================================================================
// HELPERS
// ================================================================

function buildFallbackFeatureTrigger(
  userId: string,
  featureKey: string,
  featureData: typeof LOCKED_FEATURES[string],
  planName: string
) {
  const variant = getABVariant(userId)
  return {
    id: genId('trigger'),
    type: 'feature_lock' as const,
    headline: `Unlock ${featureData.name}`,
    body: `${featureData.description} ${featureData.benefit}`,
    cta: 'Upgrade to Starter',
    urgency: 'medium' as const,
    suggestedPlan: featureData.requiredPlan,
    suggestedPlanPrice: featureData.requiredPlan === 'starter' ? 10 : featureData.requiredPlan === 'pro' ? 30 : 100,
    benefits: ['Scheduling', 'Market research', 'More AI tokens', 'Analytics'],
    featureData,
    abVariant: variant,
    personalizedFor: 'general'
  }
}

function getDemoAnalytics() {
  return {
    period: new Date().toISOString().substring(0, 7) + '-01',
    summary: { triggersShown: 0, totalConversions: 0, totalRevenue: 0 },
    byTriggerType: [],
    topTriggers: [],
    abTestResults: []
  }
}

export default router
