// ================================================================
// CONVERSION ENGINE — Intent-Layer Upgrade System
// ================================================================
// Architecture Rule: All upgrade suggestions are INTENTS.
// This engine DETECTS moments, SCORES them, and GENERATES
// upgrade suggestion intents. Never executes. Never auto-upgrades.
// ================================================================

import { genId } from './store'
import type { Env } from './platform'

// ── Trigger types ─────────────────────────────────────────────────
export type TriggerType =
  | 'token_50'        // Light awareness at 50% usage
  | 'token_80'        // Strong suggestion at 80%
  | 'token_100'       // Hard block — upgrade required
  | 'feature_lock'    // Tried to access locked feature
  | 'value_moment'    // High-value intent generated
  | 'frequency'       // Power user pattern detected
  | 'success_based'   // User is acting on recommendations

// ── Feature lock metadata ─────────────────────────────────────────
export const LOCKED_FEATURES: Record<string, {
  name: string
  description: string
  benefit: string
  icon: string
  requiredPlan: string
  previewText: string
}> = {
  scheduling: {
    name: 'Automated Scheduling',
    description: 'Set AI agents to run on autopilot — daily, weekly, or monthly.',
    benefit: 'Saves 2-3 hours/week. Never miss a market shift or restock alert.',
    icon: 'fa-calendar-alt',
    requiredPlan: 'starter',
    previewText: 'Your agents could be running analysis while you sleep'
  },
  market_research: {
    name: 'Market Research Agent',
    description: 'Deep competitor analysis, trend detection, and opportunity spotting.',
    benefit: 'Pro users average +18% margin improvement from market insights.',
    icon: 'fa-chart-line',
    requiredPlan: 'starter',
    previewText: 'Currently tracking 3 pricing opportunities in your niche'
  },
  advanced_agents: {
    name: 'Advanced AI Agents',
    description: 'Strategy Agent + Ad Optimization + Customer Segmentation.',
    benefit: 'Full 7-agent suite for complete business intelligence coverage.',
    icon: 'fa-robot',
    requiredPlan: 'pro',
    previewText: 'Your Strategy Agent would have 2 high-value insights waiting'
  },
  analytics: {
    name: 'Business Analytics',
    description: 'Deep revenue trend analysis, cohort insights, performance tracking.',
    benefit: 'Know exactly what\'s working and what\'s not — with data.',
    icon: 'fa-chart-bar',
    requiredPlan: 'starter',
    previewText: 'Revenue up 12% this week — see the breakdown'
  },
  workflows: {
    name: 'Multi-Step Workflows',
    description: 'Chain multiple agents into guided business improvement flows.',
    benefit: 'Launch new products, run marketing sprints, restock cycles — all automated.',
    icon: 'fa-project-diagram',
    requiredPlan: 'starter',
    previewText: 'Product launch workflow ready for your next SKU'
  }
}

// ── Plan upgrade paths ─────────────────────────────────────────────
const UPGRADE_PATHS: Record<string, { next: string; price: number; tokens: string; keyBenefits: string[] }> = {
  free: {
    next: 'starter', price: 10,
    tokens: '1.2M tokens/mo',
    keyBenefits: [
      'Scheduling + automation',
      '1.2M tokens (120× more)',
      'Market Research Agent',
      'Up to 5 agents active',
      'Business analytics'
    ]
  },
  starter: {
    next: 'pro', price: 30,
    tokens: '3.6M tokens/mo',
    keyBenefits: [
      'Strategy + Ad Optimization agents',
      '3.6M tokens (3× more)',
      'Advanced AI model routing',
      'Up to 20 schedules',
      'Priority AI processing'
    ]
  },
  pro: {
    next: 'scale', price: 100,
    tokens: '12M tokens/mo',
    keyBenefits: [
      '12M tokens (unlimited feels)',
      '100 concurrent schedules',
      'Full automation suite',
      'Fastest cooldowns',
      'Scale-ready infrastructure'
    ]
  }
}

// ── Personalization: niche-specific messaging ──────────────────────
const NICHE_MESSAGING: Record<string, { valueProp: string; example: string }> = {
  'hair products':        { valueProp: 'pricing and product bundling insights',    example: 'hair care bundles at $45+ convert 3x better' },
  'skincare':             { valueProp: 'trend detection and competitor analysis',  example: 'trending ingredients in your category right now' },
  'fitness':              { valueProp: 'seasonal demand and product launch intel', example: 'Q1 equipment surge — optimize your listings now' },
  'fashion':              { valueProp: 'trend forecasting and inventory planning', example: 'avoid overstock with AI demand signals' },
  'electronics':          { valueProp: 'competitor pricing and bundle strategy',  example: 'competitive price windows in your SKUs' },
  'home decor':           { valueProp: 'seasonal patterns and bundle curation',   example: 'peak decor season prep — 8 weeks out' },
  'supplements':          { valueProp: 'subscription optimization and retention', example: 'subscription users spend 4x more long-term' },
  'default':              { valueProp: 'AI-powered business intelligence',        example: 'market patterns specific to your niche' }
}

// ── A/B Variant assignment (deterministic by userId) ──────────────
export function getABVariant(userId: string): 'A' | 'B' {
  let hash = 0
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash) + userId.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash) % 2 === 0 ? 'A' : 'B'
}

// ── Suppress: don't show trigger if shown recently ─────────────────
const TRIGGER_COOLDOWNS: Record<TriggerType, number> = {
  token_50:      24 * 60,  // once per 24h
  token_80:       6 * 60,  // once per 6h
  token_100:      1 * 60,  // once per 1h (can't suppress hard block)
  feature_lock:  30,        // 30 min cooldown per feature
  value_moment:  60,        // 60 min between value moments
  frequency:     48 * 60,  // once per 48h
  success_based: 72 * 60   // once per 3 days
}

// ================================================================
// CORE: Check if a trigger should fire
// ================================================================

export interface TriggerCheckResult {
  shouldTrigger: boolean
  trigger?: UpgradeTrigger
  cooldownMinutes?: number
}

export interface UpgradeTrigger {
  id: string
  type: TriggerType
  headline: string
  body: string
  cta: string
  urgency: 'low' | 'medium' | 'high' | 'critical'
  suggestedPlan: string
  suggestedPlanPrice: number
  benefits: string[]
  featureData?: typeof LOCKED_FEATURES[string]
  abVariant: 'A' | 'B'
  intentValue?: number    // estimated $ value for value_moment
  personalizedFor?: string
}

export async function checkTrigger(
  userId: string,
  triggerType: TriggerType,
  context: {
    tokenPct?: number
    featureKey?: string
    intentType?: string
    intentValue?: number
    planName?: string
    niche?: string
  },
  db: D1Database
): Promise<TriggerCheckResult> {
  const planName = context.planName ?? 'free'

  // No trigger for paid plans on basic triggers
  if (planName === 'scale') return { shouldTrigger: false }

  // Check cooldown: was this trigger shown recently?
  const cooldownMins = TRIGGER_COOLDOWNS[triggerType]
  const recent = await db.prepare(`
    SELECT id FROM upgrade_trigger_events
    WHERE user_id = ? AND trigger_type = ?
    AND created_at > datetime('now', ? )
    ORDER BY created_at DESC LIMIT 1
  `).bind(userId, triggerType, `-${cooldownMins} minutes`).first()

  if (recent) return { shouldTrigger: false, cooldownMinutes: cooldownMins }

  // Build trigger message (A/B variant)
  const variant = getABVariant(userId)
  const trigger = await buildTriggerMessage(userId, triggerType, context, variant, db)

  return { shouldTrigger: true, trigger }
}

// ================================================================
// BUILD TRIGGER MESSAGE
// ================================================================

async function buildTriggerMessage(
  userId: string,
  type: TriggerType,
  context: {
    tokenPct?: number
    featureKey?: string
    intentType?: string
    intentValue?: number
    planName?: string
    niche?: string
  },
  variant: 'A' | 'B',
  db: D1Database
): Promise<UpgradeTrigger> {
  const planName = context.planName ?? 'free'
  const upgradePath = UPGRADE_PATHS[planName] ?? UPGRADE_PATHS.free
  const niche = context.niche ?? 'default'
  const nicheMsg = getNicheMessaging(niche)

  // Fetch A/B config from DB
  const abConfig = await db.prepare(`
    SELECT variant_a, variant_b FROM ab_test_config
    WHERE trigger_type = ? AND is_active = 1 LIMIT 1
  `).bind(type).first<{ variant_a: string; variant_b: string }>()

  let headline = '', body = '', cta = ''
  let urgency: UpgradeTrigger['urgency'] = 'medium'

  if (abConfig) {
    try {
      const v = variant === 'A'
        ? JSON.parse(abConfig.variant_a)
        : JSON.parse(abConfig.variant_b)
      headline = v.headline ?? ''
      body = v.body ?? ''
      cta = v.cta ?? 'Upgrade'
      urgency = v.urgency ?? 'medium'
    } catch (_) { /* fall through to defaults */ }
  }

  // Fill in defaults / override with context-specific copy
  switch (type) {
    case 'token_50':
      if (!headline) headline = "You're halfway through your AI power"
      if (!body)     body = `You've used 50% of your monthly tokens. ${nicheMsg.valueProp} insights are waiting — make sure you have room for them.`
      if (!cta)      cta = 'View Plans'
      urgency = 'low'
      break

    case 'token_80':
      if (!headline) headline = "80% of your AI power is used"
      if (!body)     body = `Only 20% of your tokens remain. Don't let limits interrupt your momentum — upgrade to ${upgradePath.next} for ${upgradePath.tokens}.`
      if (!cta)      cta = 'Upgrade Now'
      urgency = 'high'
      break

    case 'token_100':
      if (!headline) headline = "You've reached your monthly AI limit"
      if (!body)     body = `Your AI agents are ready with more insights but your ${planName} plan tokens are exhausted. Upgrade to continue generating recommendations.`
      if (!cta)      cta = 'Unlock Unlimited'
      urgency = 'critical'
      break

    case 'feature_lock': {
      const feat = context.featureKey ? LOCKED_FEATURES[context.featureKey] : null
      if (feat) {
        if (!headline) headline = `Unlock ${feat.name}`
        if (!body)     body = `${feat.description} ${feat.benefit}`
        if (!cta)      cta = `Upgrade to ${upgradePath.next.charAt(0).toUpperCase() + upgradePath.next.slice(1)}`
      } else {
        if (!headline) headline = 'This feature requires an upgrade'
        if (!body)     body = 'Access advanced AI capabilities by upgrading your plan.'
        if (!cta)      cta = 'Upgrade'
      }
      urgency = 'medium'
      break
    }

    case 'value_moment': {
      const val = context.intentValue
      const valText = val ? ` This insight could be worth $${val}+.` : ''
      if (!headline) headline = 'Your AI just found a real opportunity'
      if (!body)     body = `This ${fmtIntentType(context.intentType)} recommendation could improve your results.${valText} Upgrade to ${upgradePath.next} for more insights like this all month.`
      if (!cta)      cta = 'Unlock More Insights'
      urgency = 'low'
      break
    }

    case 'frequency':
      if (!headline) headline = "You're using IntentIQ like a power user"
      if (!body)     body = `Daily AI usage is a strong signal your business is growing. Upgrade to ${upgradePath.next} for ${upgradePath.tokens} and uninterrupted access.`
      if (!cta)      cta = 'Upgrade for More'
      urgency = 'medium'
      break

    case 'success_based':
      if (!headline) headline = 'Your business decisions are paying off'
      if (!body)     body = `You're actively approving and acting on AI recommendations — that's exactly how to grow. Unlock automation to scale what's working.`
      if (!cta)      cta = 'Unlock Automation'
      urgency = 'low'
      break
  }

  return {
    id: genId('trigger'),
    type,
    headline,
    body,
    cta,
    urgency,
    suggestedPlan: upgradePath.next,
    suggestedPlanPrice: upgradePath.price,
    benefits: upgradePath.keyBenefits,
    featureData: context.featureKey ? LOCKED_FEATURES[context.featureKey] : undefined,
    abVariant: variant,
    intentValue: context.intentValue,
    personalizedFor: niche
  }
}

// ================================================================
// LOG TRIGGER EVENT
// ================================================================

export async function logTriggerEvent(
  db: D1Database,
  userId: string,
  trigger: UpgradeTrigger,
  planName: string
): Promise<void> {
  await db.prepare(`
    INSERT INTO upgrade_trigger_events
    (id, user_id, trigger_type, trigger_data, plan_name, suggested_plan, urgency, ab_variant)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    trigger.id, userId, trigger.type,
    JSON.stringify({ headline: trigger.headline, featureKey: trigger.featureData?.name }),
    planName, trigger.suggestedPlan, trigger.urgency, trigger.abVariant
  ).run().catch(e => console.error('[ConversionLog]', e))
}

// ================================================================
// LOG USER ACTION ON TRIGGER
// ================================================================

export async function recordTriggerAction(
  db: D1Database,
  triggerId: string,
  action: 'dismissed' | 'clicked' | 'converted' | 'ignored'
): Promise<void> {
  await db.prepare(`
    UPDATE upgrade_trigger_events
    SET user_action = ?, acted_at = datetime('now')
    WHERE id = ?
  `).bind(action, triggerId).run().catch(e => console.error('[TriggerAction]', e))
}

// ================================================================
// LOG BEHAVIOR SIGNAL
// ================================================================

export async function logBehavior(
  db: D1Database,
  userId: string,
  eventType: string,
  eventData: Record<string, unknown>
): Promise<void> {
  await db.prepare(`
    INSERT INTO user_behavior (id, user_id, event_type, event_data)
    VALUES (?, ?, ?, ?)
  `).bind(genId('beh'), userId, eventType, JSON.stringify(eventData))
  .run().catch(e => console.error('[BehaviorLog]', e))
}

// ================================================================
// GET USER BEHAVIOR SCORE (for trigger timing)
// ================================================================

export async function getUserBehaviorScore(userId: string, db: D1Database): Promise<{
  dailyActiveStreak: number
  totalApprovalsThisMonth: number
  intentsGeneratedThisWeek: number
  featuresLockedHit: number
  shouldFireFrequency: boolean
  shouldFireSuccess: boolean
}> {
  try {
    const [streak, approvals, generated, locked] = await Promise.all([
      // Daily active streak
      db.prepare(`
        SELECT COUNT(DISTINCT session_date) as streak
        FROM user_behavior
        WHERE user_id = ? AND session_date >= date('now', '-7 days')
      `).bind(userId).first<{ streak: number }>(),

      // Intent approvals this month
      db.prepare(`
        SELECT COUNT(*) as cnt FROM user_behavior
        WHERE user_id = ? AND event_type = 'intent_approved'
        AND created_at >= date('now', 'start of month')
      `).bind(userId).first<{ cnt: number }>(),

      // Intents generated this week
      db.prepare(`
        SELECT COUNT(*) as cnt FROM user_behavior
        WHERE user_id = ? AND event_type = 'intent_generated'
        AND created_at >= date('now', '-7 days')
      `).bind(userId).first<{ cnt: number }>(),

      // Feature lock hits
      db.prepare(`
        SELECT COUNT(*) as cnt FROM user_behavior
        WHERE user_id = ? AND event_type = 'feature_locked_hit'
        AND created_at >= date('now', '-7 days')
      `).bind(userId).first<{ cnt: number }>()
    ])

    const s = streak?.streak ?? 0
    const a = approvals?.cnt ?? 0
    const g = generated?.cnt ?? 0
    const l = locked?.cnt ?? 0

    return {
      dailyActiveStreak: s,
      totalApprovalsThisMonth: a,
      intentsGeneratedThisWeek: g,
      featuresLockedHit: l,
      shouldFireFrequency: s >= 3 || g >= 5,  // Active 3+ days or 5+ intents
      shouldFireSuccess: a >= 3               // Approved 3+ intents
    }
  } catch (_) {
    return { dailyActiveStreak: 0, totalApprovalsThisMonth: 0, intentsGeneratedThisWeek: 0, featuresLockedHit: 0, shouldFireFrequency: false, shouldFireSuccess: false }
  }
}

// ================================================================
// HIGH-VALUE INTENT DETECTOR
// ================================================================

const HIGH_VALUE_TYPES = new Set([
  'pricing_adjust', 'pricing_bundle', 'market_opportunity',
  'competitor_alert', 'product_create', 'product_bundle',
  'strategy_review', 'financial_insight', 'ad_optimization'
])

const INTENT_VALUE_ESTIMATES: Record<string, number> = {
  pricing_adjust: 400,
  pricing_bundle: 300,
  market_opportunity: 600,
  competitor_alert: 500,
  product_create: 700,
  product_bundle: 350,
  strategy_review: 1000,
  financial_insight: 500,
  ad_optimization: 450,
  email_campaign: 250
}

export function isHighValueIntent(intentType: string): boolean {
  return HIGH_VALUE_TYPES.has(intentType)
}

export function getIntentValueEstimate(intentType: string): number {
  return INTENT_VALUE_ESTIMATES[intentType] ?? 200
}

// ================================================================
// CONVERSION ANALYTICS
// ================================================================

export async function getConversionAnalytics(db: D1Database) {
  const period = getPeriodStart()
  try {
    const [triggers, conversions, topTriggers, abResults] = await Promise.all([
      db.prepare(`
        SELECT trigger_type, COUNT(*) as shown, urgency,
               SUM(CASE WHEN user_action = 'clicked' THEN 1 ELSE 0 END) as clicked,
               SUM(CASE WHEN user_action = 'converted' THEN 1 ELSE 0 END) as converted,
               SUM(CASE WHEN user_action = 'dismissed' THEN 1 ELSE 0 END) as dismissed
        FROM upgrade_trigger_events
        WHERE created_at >= ?
        GROUP BY trigger_type
        ORDER BY shown DESC
      `).bind(period).all(),

      db.prepare(`
        SELECT COUNT(*) as total, SUM(revenue_delta) as revenue
        FROM conversion_events WHERE created_at >= ?
      `).bind(period).first(),

      db.prepare(`
        SELECT trigger_type,
               ROUND(100.0 * SUM(CASE WHEN user_action='clicked' THEN 1 ELSE 0 END) / COUNT(*), 1) as ctr,
               ROUND(100.0 * SUM(CASE WHEN user_action='converted' THEN 1 ELSE 0 END) / COUNT(*), 1) as cvr
        FROM upgrade_trigger_events
        WHERE created_at >= ?
        GROUP BY trigger_type ORDER BY cvr DESC
      `).bind(period).all(),

      db.prepare(`
        SELECT trigger_type, ab_variant, COUNT(*) as shown,
               ROUND(100.0 * SUM(CASE WHEN user_action='clicked' THEN 1 ELSE 0 END) / COUNT(*), 1) as ctr
        FROM upgrade_trigger_events
        WHERE created_at >= ?
        GROUP BY trigger_type, ab_variant
      `).bind(period).all()
    ])

    const c = conversions as Record<string, number>
    return {
      period,
      summary: { triggersShown: 0, totalConversions: c?.total ?? 0, totalRevenue: c?.revenue ?? 0 },
      byTriggerType: triggers.results,
      topTriggers: topTriggers.results,
      abTestResults: abResults.results
    }
  } catch (_) {
    return { period, summary: { triggersShown: 0, totalConversions: 0, totalRevenue: 0 }, byTriggerType: [], topTriggers: [], abTestResults: [] }
  }
}

// ================================================================
// UTILITIES
// ================================================================

function getNicheMessaging(niche: string): { valueProp: string; example: string } {
  const lower = niche.toLowerCase()
  for (const [key, msg] of Object.entries(NICHE_MESSAGING)) {
    if (lower.includes(key)) return msg
  }
  return NICHE_MESSAGING.default
}

function fmtIntentType(t?: string): string {
  return (t ?? 'AI').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function getPeriodStart(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}
