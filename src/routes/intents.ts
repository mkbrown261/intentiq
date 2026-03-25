// ============================================================
// INTENT API ROUTES
// ============================================================
// All routes in this file operate on the INTENT LAYER only.
// NO action is taken automatically. All outputs are intents
// that require explicit user approval.
// ============================================================

import { Hono } from 'hono'
import type { Intent, IntentType, IntentUpdateRequest } from '../types/intent'
import { generateIntent, type Env } from '../lib/aiService'
import {
  saveIntent,
  getIntent,
  updateIntent,
  getAllIntents,
  getIntentsByStatus,
  deleteIntent,
  getUserProfile,
  getDashboardStats
} from '../lib/store'

const intents = new Hono<{ Bindings: Env }>()

// ── GET /api/intents ─────────────────────────────────────────
// Returns all intents, sorted by recency
// ─────────────────────────────────────────────────────────────
intents.get('/', (c) => {
  const status = c.req.query('status')
  const type = c.req.query('type')
  const limit = parseInt(c.req.query('limit') ?? '50')

  let results = getAllIntents()

  if (status) results = results.filter(i => i.status === status)
  if (type) results = results.filter(i => i.type === type)
  results = results.slice(0, limit)

  return c.json({
    success: true,
    data: results,
    count: results.length,
    timestamp: new Date().toISOString()
  })
})

// ── GET /api/intents/stats ───────────────────────────────────
// Dashboard statistics
// ─────────────────────────────────────────────────────────────
intents.get('/stats', (c) => {
  return c.json({
    success: true,
    data: getDashboardStats(),
    timestamp: new Date().toISOString()
  })
})

// ── GET /api/intents/pending ─────────────────────────────────
// Returns all pending intents awaiting user decision
// ─────────────────────────────────────────────────────────────
intents.get('/pending', (c) => {
  const pending = getIntentsByStatus('pending')
  return c.json({
    success: true,
    data: pending,
    count: pending.length,
    timestamp: new Date().toISOString()
  })
})

// ── GET /api/intents/:id ─────────────────────────────────────
// Returns a single intent by ID
// ─────────────────────────────────────────────────────────────
intents.get('/:id', (c) => {
  const id = c.req.param('id')
  const intent = getIntent(id)

  if (!intent) {
    return c.json({ success: false, error: 'Intent not found' }, 404)
  }

  return c.json({ success: true, data: intent, timestamp: new Date().toISOString() })
})

// ── POST /api/intents/generate ───────────────────────────────
// Generates a new intent using AI
// This ONLY generates an intent — it does NOT execute any action
// ─────────────────────────────────────────────────────────────
intents.post('/generate', async (c) => {
  try {
    const body = await c.req.json() as {
      intentType: IntentType
      context?: Record<string, unknown>
      scheduledTaskId?: string
    }

    if (!body.intentType) {
      return c.json({ success: false, error: 'intentType is required' }, 400)
    }

    const userProfile = getUserProfile()
    const intent = await generateIntent(
      body.intentType,
      body.context ?? {},
      userProfile,
      c.env,
      body.scheduledTaskId
    )

    saveIntent(intent)

    return c.json({
      success: true,
      data: intent,
      message: '✅ Intent generated successfully. Review and approve before any action is taken.',
      timestamp: new Date().toISOString()
    })
  } catch (err) {
    return c.json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to generate intent'
    }, 500)
  }
})

// ── PATCH /api/intents/:id ───────────────────────────────────
// Updates intent status (approve/reject/modify)
// This is the HUMAN VERIFICATION LAYER
// ─────────────────────────────────────────────────────────────
intents.patch('/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json() as IntentUpdateRequest

  const existing = getIntent(id)
  if (!existing) {
    return c.json({ success: false, error: 'Intent not found' }, 404)
  }

  if (!['approved', 'rejected', 'modified'].includes(body.status)) {
    return c.json({ success: false, error: 'Invalid status. Must be: approved, rejected, or modified' }, 400)
  }

  const updated = updateIntent(id, {
    status: body.status,
    modificationNote: body.modificationNote,
    reviewedAt: new Date().toISOString()
  })

  const messages: Record<string, string> = {
    approved: '✅ Intent approved. You may now execute the suggested actions manually.',
    rejected: '❌ Intent rejected and archived.',
    modified: '✏️ Intent marked as modified. Please review your changes.'
  }

  return c.json({
    success: true,
    data: updated,
    message: messages[body.status],
    timestamp: new Date().toISOString()
  })
})

// ── DELETE /api/intents/:id ──────────────────────────────────
// Removes an intent from the store
// ─────────────────────────────────────────────────────────────
intents.delete('/:id', (c) => {
  const id = c.req.param('id')
  const deleted = deleteIntent(id)

  if (!deleted) {
    return c.json({ success: false, error: 'Intent not found' }, 404)
  }

  return c.json({
    success: true,
    message: 'Intent deleted',
    timestamp: new Date().toISOString()
  })
})

export default intents
