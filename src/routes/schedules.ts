// ================================================================
// SCHEDULE ROUTES — /api/schedules
// Schedules use token gating: each run deducts from user allowance.
// ================================================================
import { Hono } from 'hono'
import type { Env } from '../lib/platform'
import type { Schedule, AgentName, IntentType } from '../types/core'
import { runAgent } from '../lib/agents'
import { ScheduleStore, IntentStore, AgentStore, AgentLogStore, genId, computeNextRun } from '../lib/store'
import { callPlatformAI } from '../lib/platform'

const router = new Hono<{ Bindings: Env }>()

router.get('/', (c) => {
  return c.json({ success: true, data: ScheduleStore.all(), timestamp: new Date().toISOString() })
})

router.get('/:id', (c) => {
  const s = ScheduleStore.get(c.req.param('id'))
  if (!s) return c.json({ success: false, error: 'Schedule not found' }, 404)
  return c.json({ success: true, data: s, timestamp: new Date().toISOString() })
})

router.post('/', async (c) => {
  const body = await c.req.json() as Partial<Schedule>
  if (!body.name || !body.intentType || !body.frequency)
    return c.json({ success: false, error: 'name, intentType, frequency required' }, 400)

  const s: Schedule = {
    id: genId('sched'),
    name: body.name,
    description: body.description ?? '',
    intentType: body.intentType as IntentType,
    agentName: body.agentName ?? 'BusinessHealthAgent',
    frequency: body.frequency,
    dayOfWeek: body.dayOfWeek,
    hour: body.hour ?? 9,
    isActive: true,
    nextRun: computeNextRun(body.frequency, body.dayOfWeek, body.hour ?? 9),
    createdAt: new Date().toISOString(),
    contextParams: body.contextParams ?? {},
    totalRuns: 0,
    intentsGenerated: 0
  }
  ScheduleStore.save(s)
  return c.json({
    success: true, data: s,
    message: '✅ Schedule created. Intents will be generated automatically for your review.',
    timestamp: new Date().toISOString()
  })
})

router.patch('/:id', async (c) => {
  const body = await c.req.json()
  const ex = ScheduleStore.get(c.req.param('id'))
  if (!ex) return c.json({ success: false, error: 'Schedule not found' }, 404)
  const updated = ScheduleStore.update(c.req.param('id'), {
    ...body,
    nextRun: body.frequency ? computeNextRun(body.frequency, body.dayOfWeek, body.hour ?? ex.hour) : ex.nextRun
  })
  return c.json({ success: true, data: updated, timestamp: new Date().toISOString() })
})

router.delete('/:id', (c) => {
  if (!ScheduleStore.delete(c.req.param('id')))
    return c.json({ success: false, error: 'Schedule not found' }, 404)
  return c.json({ success: true, message: 'Schedule deleted', timestamp: new Date().toISOString() })
})

// POST /api/schedules/:id/run — Manually run a schedule with token gating
router.post('/:id/run', async (c) => {
  const s = ScheduleStore.get(c.req.param('id'))
  if (!s) return c.json({ success: false, error: 'Schedule not found' }, 404)

  const userId = (c.get('userId') as string) ?? 'user-demo'

  // ── Token gate ────────────────────────────────────────────────
  if (c.env?.DB) {
    const tokenCheck = await callPlatformAI({
      userId,
      requestType: 'schedule_run',
      systemPrompt: 'token_check_only',
      userPrompt: `schedule:${s.id}:${s.intentType}`,
      preferredModel: 'demo',
      cacheKey: `sched-${s.id}-${new Date().toISOString().substring(0, 10)}`
    }, c.env as Env)

    if (!tokenCheck.tokenUsageResult.allowed) {
      return c.json({
        success: false,
        error: tokenCheck.tokenUsageResult.reason ?? 'Token limit reached for schedule run',
        upgradeRequired: true,
        tokensRemaining: tokenCheck.tokenUsageResult.tokensRemaining
      }, 429)
    }
  }

  try {
    const intent = await runAgent(s.agentName as AgentName, s.intentType as IntentType, s.contextParams, c.env, s.id)
    IntentStore.save(intent)
    AgentStore.incrementIntents(s.agentName as AgentName)
    ScheduleStore.update(s.id, {
      lastRun: new Date().toISOString(),
      totalRuns: s.totalRuns + 1,
      intentsGenerated: s.intentsGenerated + 1
    })
    AgentLogStore.push({
      id: genId('log'), agentName: s.agentName as AgentName, action: 'schedule_run',
      intentId: intent.id, status: 'success',
      message: `Schedule "${s.name}" ran successfully`, timestamp: new Date().toISOString()
    })
    return c.json({
      success: true, data: { intent, schedule: s },
      message: `✅ "${s.name}" ran. Intent generated for your review.`,
      timestamp: new Date().toISOString()
    })
  } catch (err) {
    return c.json({ success: false, error: err instanceof Error ? err.message : 'Run failed' }, 500)
  }
})

// POST /api/schedules/run-due — Process all due scheduled tasks with token gating
router.post('/run-due', async (c) => {
  const due = ScheduleStore.due()
  const results: Array<{ scheduleId: string; intentId: string; success: boolean; error?: string }> = []
  const userId = (c.get('userId') as string) ?? 'user-demo'

  for (const s of due) {
    // Token gate each schedule run
    if (c.env?.DB) {
      const tokenCheck = await callPlatformAI({
        userId,
        requestType: 'schedule_run',
        systemPrompt: 'token_check_only',
        userPrompt: `schedule:${s.id}`,
        preferredModel: 'demo'
      }, c.env as Env)

      if (!tokenCheck.tokenUsageResult.allowed) {
        results.push({ scheduleId: s.id, intentId: '', success: false, error: 'Token limit reached' })
        continue // Skip remaining if monthly limit hit
      }
    }

    try {
      const intent = await runAgent(s.agentName as AgentName, s.intentType as IntentType, s.contextParams, c.env, s.id)
      IntentStore.save(intent)
      AgentStore.incrementIntents(s.agentName as AgentName)
      ScheduleStore.update(s.id, {
        lastRun: new Date().toISOString(),
        nextRun: computeNextRun(s.frequency, s.dayOfWeek, s.hour),
        totalRuns: s.totalRuns + 1,
        intentsGenerated: s.intentsGenerated + 1
      })
      AgentLogStore.push({
        id: genId('log'), agentName: s.agentName as AgentName, action: 'schedule_run',
        intentId: intent.id, status: 'success',
        message: `Scheduled "${s.name}" completed`, timestamp: new Date().toISOString()
      })
      results.push({ scheduleId: s.id, intentId: intent.id, success: true })
    } catch (err) {
      results.push({ scheduleId: s.id, intentId: '', success: false, error: String(err) })
    }
  }

  const successCount = results.filter(r => r.success).length
  return c.json({
    success: true,
    data: { ran: successCount, total: results.length, results },
    message: successCount > 0 ? `✅ ${successCount} scheduled tasks ran successfully.` : 'No tasks ran.',
    timestamp: new Date().toISOString()
  })
})

export default router
