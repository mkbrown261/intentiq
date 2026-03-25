// ================================================================
// AGENT ROUTES — /api/agents
// ================================================================
import { Hono } from 'hono'
import type { Env } from '../lib/agents'
import { AgentStore, AgentLogStore, IntentStore } from '../lib/store'

const router = new Hono<{ Bindings: Env }>()

router.get('/', (c) => {
  const agents = AgentStore.all()
  return c.json({ success: true, data: agents, timestamp: new Date().toISOString() })
})

router.get('/:id', (c) => {
  const agent = AgentStore.get(c.req.param('id') as any)
  if (!agent) return c.json({ success: false, error: 'Agent not found' }, 404)
  const intents = IntentStore.byAgent(c.req.param('id') as any).slice(0, 10)
  return c.json({ success: true, data: { agent, recentIntents: intents }, timestamp: new Date().toISOString() })
})

router.get('/:id/logs', (c) => {
  const logs = AgentLogStore.byAgent(c.req.param('id') as any).slice(0, 30)
  return c.json({ success: true, data: logs, timestamp: new Date().toISOString() })
})

router.patch('/:id', async (c) => {
  const body = await c.req.json()
  const updated = AgentStore.update(c.req.param('id') as any, body)
  if (!updated) return c.json({ success: false, error: 'Agent not found' }, 404)
  return c.json({ success: true, data: updated, timestamp: new Date().toISOString() })
})

export default router
