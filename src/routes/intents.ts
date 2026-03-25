// ================================================================
// INTENT ROUTES — /api/intents
// All outputs are INTENTS. All actions require human approval.
// ================================================================
import { Hono } from 'hono'
import type { Env } from '../lib/agents'
import type { IntentType, AgentName, ApproveIntentRequest } from '../types/core'
import { runAgent } from '../lib/agents'
import {
  IntentStore, ApprovalStore, ProfileStore, HealthStore,
  AgentStore, AgentLogStore, getDashboardStats, genId
} from '../lib/store'

const router = new Hono<{ Bindings: Env }>()

// GET /api/intents
router.get('/', (c) => {
  const { status, type, agent, priority, limit = '50' } = c.req.query()
  let results = IntentStore.all()
  if (status)   results = results.filter(i => i.status === status)
  if (type)     results = results.filter(i => i.type === type)
  if (agent)    results = results.filter(i => i.generatedBy === agent)
  if (priority) results = results.filter(i => i.priority === priority)
  results = results.slice(0, parseInt(limit))
  return c.json({ success: true, data: results, count: results.length, timestamp: new Date().toISOString() })
})

// GET /api/intents/stats
router.get('/stats', (c) => {
  return c.json({ success: true, data: getDashboardStats(), timestamp: new Date().toISOString() })
})

// GET /api/intents/:id
router.get('/:id', (c) => {
  const intent = IntentStore.get(c.req.param('id'))
  if (!intent) return c.json({ success: false, error: 'Intent not found' }, 404)
  return c.json({ success: true, data: intent, timestamp: new Date().toISOString() })
})

// POST /api/intents/generate — Core intent generation endpoint
router.post('/generate', async (c) => {
  try {
    const body = await c.req.json() as {
      agentName?: AgentName
      intentType: IntentType
      context?: Record<string, unknown>
      scheduleId?: string
      workflowId?: string
    }
    if (!body.intentType) return c.json({ success: false, error: 'intentType required' }, 400)

    // Determine which agent handles this intent type
    const agentName = body.agentName ?? resolveAgent(body.intentType)
    const intent = await runAgent(agentName, body.intentType, body.context ?? {}, c.env, body.scheduleId, body.workflowId)

    IntentStore.save(intent)
    AgentStore.incrementIntents(agentName)
    AgentLogStore.push({
      id: genId('log'), agentName, action: 'generate_intent',
      intentId: intent.id, status: 'success',
      message: `Generated ${intent.type} intent: "${intent.summary.substring(0, 60)}..."`,
      timestamp: new Date().toISOString()
    })
    HealthStore.recalculate()

    return c.json({
      success: true, data: intent,
      message: '✅ Intent generated. Review and approve before any action is taken.',
      timestamp: new Date().toISOString()
    })
  } catch (err) {
    return c.json({ success: false, error: err instanceof Error ? err.message : 'Generation failed' }, 500)
  }
})

// PATCH /api/intents/:id — Human Verification Layer (Approve/Reject/Modify)
router.patch('/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json() as ApproveIntentRequest
  const intent = IntentStore.get(id)
  if (!intent) return c.json({ success: false, error: 'Intent not found' }, 404)
  if (!['approved','rejected','modified'].includes(body.decision))
    return c.json({ success: false, error: 'decision must be: approved, rejected, or modified' }, 400)

  const updated = IntentStore.update(id, {
    status: body.decision, modificationNote: body.note, reviewedAt: new Date().toISOString()
  })

  // Record approval for personalization
  ProfileStore.recordApproval(intent.type, body.decision as 'approved' | 'rejected' | 'modified')

  // Save approval record
  const approval = { id: genId('approval'), intentId: id, decision: body.decision, note: body.note, decidedAt: new Date().toISOString() }
  ApprovalStore.save(approval)
  HealthStore.recalculate()

  const messages: Record<string, string> = {
    approved: '✅ Intent approved. Execute the suggested steps manually when ready.',
    rejected:  '❌ Intent rejected and archived.',
    modified:  '✏️ Intent modified. Your note has been saved.'
  }
  return c.json({ success: true, data: updated, message: messages[body.decision], timestamp: new Date().toISOString() })
})

// DELETE /api/intents/:id
router.delete('/:id', (c) => {
  const deleted = IntentStore.delete(c.req.param('id'))
  if (!deleted) return c.json({ success: false, error: 'Intent not found' }, 404)
  return c.json({ success: true, message: 'Intent deleted', timestamp: new Date().toISOString() })
})

// ── Agent resolver ────────────────────────────────────────────────
function resolveAgent(intentType: IntentType): AgentName {
  const map: Record<string, AgentName> = {
    inventory_restock: 'InventoryAgent', inventory_liquidate: 'InventoryAgent',
    pricing_adjust: 'PricingAgent', pricing_bundle: 'PricingAgent', pricing_discount: 'PricingAgent',
    market_trend: 'MarketResearchAgent', market_opportunity: 'MarketResearchAgent',
    competitor_alert: 'MarketResearchAgent', seasonality_alert: 'MarketResearchAgent',
    email_campaign: 'EmailMarketingAgent', email_abandoned_cart: 'EmailMarketingAgent',
    email_reengagement: 'EmailMarketingAgent', customer_segment: 'EmailMarketingAgent',
    product_create: 'ProductCreationAgent', product_bundle: 'ProductCreationAgent',
    product_variation: 'ProductCreationAgent',
    business_health: 'BusinessHealthAgent', performance_alert: 'BusinessHealthAgent',
    financial_insight: 'BusinessHealthAgent',
    strategy_review: 'StrategyAgent', workflow_suggestion: 'StrategyAgent',
    ad_optimization: 'StrategyAgent'
  }
  return map[intentType] ?? 'BusinessHealthAgent'
}

export default router
