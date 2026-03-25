// ================================================================
// PROFILE, HEALTH & INSIGHTS ROUTES
// ================================================================
import { Hono } from 'hono'
import type { Env } from '../lib/agents'
import { ProfileStore, HealthStore, InsightStore, AgentLogStore } from '../lib/store'

const router = new Hono<{ Bindings: Env }>()

// ── Profile ──────────────────────────────────────────────────────
router.get('/profile', (c) =>
  c.json({ success: true, data: ProfileStore.get(), timestamp: new Date().toISOString() }))

router.patch('/profile', async (c) => {
  const body = await c.req.json()
  const updated = ProfileStore.update(body)
  return c.json({ success: true, data: updated, message: 'Profile updated. AI agents will use your new settings.', timestamp: new Date().toISOString() })
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

export default router
