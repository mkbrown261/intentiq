// ============================================================
// SCHEDULE API ROUTES
// ============================================================
// Manages recurring AI tasks that generate intents on schedule.
// Schedules NEVER auto-execute actions — they only trigger
// intent generation for user review.
// ============================================================

import { Hono } from 'hono'
import type { ScheduledTask, IntentType, DayOfWeek, ScheduleFrequency } from '../types/intent'
import { generateIntent, type Env } from '../lib/aiService'
import {
  saveSchedule,
  getSchedule,
  getAllSchedules,
  updateSchedule,
  deleteSchedule,
  saveIntent,
  getUserProfile
} from '../lib/store'

const schedules = new Hono<{ Bindings: Env }>()

// ── GET /api/schedules ───────────────────────────────────────
schedules.get('/', (c) => {
  return c.json({
    success: true,
    data: getAllSchedules(),
    timestamp: new Date().toISOString()
  })
})

// ── GET /api/schedules/:id ───────────────────────────────────
schedules.get('/:id', (c) => {
  const id = c.req.param('id')
  const task = getSchedule(id)

  if (!task) {
    return c.json({ success: false, error: 'Schedule not found' }, 404)
  }

  return c.json({ success: true, data: task, timestamp: new Date().toISOString() })
})

// ── POST /api/schedules ──────────────────────────────────────
// Creates a new scheduled task
// ─────────────────────────────────────────────────────────────
schedules.post('/', async (c) => {
  const body = await c.req.json() as Partial<ScheduledTask>

  if (!body.intentType || !body.name || !body.frequency) {
    return c.json({
      success: false,
      error: 'name, intentType, and frequency are required'
    }, 400)
  }

  const task: ScheduledTask = {
    id: `sched-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    name: body.name,
    intentType: body.intentType as IntentType,
    frequency: body.frequency as ScheduleFrequency,
    dayOfWeek: body.dayOfWeek as DayOfWeek | undefined,
    hour: body.hour ?? 9,
    isActive: true,
    nextRun: computeNextRun(body.frequency as ScheduleFrequency, body.dayOfWeek as DayOfWeek | undefined, body.hour ?? 9),
    createdAt: new Date().toISOString(),
    description: body.description ?? `Scheduled ${body.intentType} task`,
    aiModel: body.aiModel ?? 'claude',
    contextParams: body.contextParams ?? {}
  }

  saveSchedule(task)

  return c.json({
    success: true,
    data: task,
    message: `✅ Schedule "${task.name}" created. It will generate intents for your review, not take automatic actions.`,
    timestamp: new Date().toISOString()
  })
})

// ── PATCH /api/schedules/:id ─────────────────────────────────
schedules.patch('/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json() as Partial<ScheduledTask>

  const existing = getSchedule(id)
  if (!existing) {
    return c.json({ success: false, error: 'Schedule not found' }, 404)
  }

  const updated = updateSchedule(id, {
    ...body,
    nextRun: body.frequency
      ? computeNextRun(body.frequency, body.dayOfWeek, body.hour ?? existing.hour)
      : existing.nextRun
  })

  return c.json({
    success: true,
    data: updated,
    message: 'Schedule updated',
    timestamp: new Date().toISOString()
  })
})

// ── DELETE /api/schedules/:id ────────────────────────────────
schedules.delete('/:id', (c) => {
  const id = c.req.param('id')
  const deleted = deleteSchedule(id)

  if (!deleted) {
    return c.json({ success: false, error: 'Schedule not found' }, 404)
  }

  return c.json({ success: true, message: 'Schedule deleted', timestamp: new Date().toISOString() })
})

// ── POST /api/schedules/:id/run ──────────────────────────────
// Manually triggers a scheduled task immediately
// Generates an intent for review — DOES NOT execute any action
// ─────────────────────────────────────────────────────────────
schedules.post('/:id/run', async (c) => {
  const id = c.req.param('id')
  const task = getSchedule(id)

  if (!task) {
    return c.json({ success: false, error: 'Schedule not found' }, 404)
  }

  try {
    const userProfile = getUserProfile()
    const intent = await generateIntent(
      task.intentType,
      task.contextParams ?? {},
      userProfile,
      c.env,
      task.id
    )

    saveIntent(intent)
    updateSchedule(id, { lastRun: new Date().toISOString() })

    return c.json({
      success: true,
      data: { intent, task },
      message: `✅ "${task.name}" ran successfully. Intent generated and awaiting your review.`,
      timestamp: new Date().toISOString()
    })
  } catch (err) {
    return c.json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to run scheduled task'
    }, 500)
  }
})

// ── POST /api/schedules/run-due ──────────────────────────────
// Runs all tasks that are due (called by cron or polling)
// ─────────────────────────────────────────────────────────────
schedules.post('/run-due', async (c) => {
  const now = new Date()
  const activeTasks = getAllSchedules().filter(t => t.isActive && new Date(t.nextRun) <= now)

  const results: Array<{ taskId: string; intentId: string; success: boolean }> = []

  for (const task of activeTasks) {
    try {
      const userProfile = getUserProfile()
      const intent = await generateIntent(
        task.intentType,
        task.contextParams ?? {},
        userProfile,
        c.env,
        task.id
      )
      saveIntent(intent)
      updateSchedule(task.id, {
        lastRun: new Date().toISOString(),
        nextRun: computeNextRun(task.frequency, task.dayOfWeek, task.hour ?? 9)
      })
      results.push({ taskId: task.id, intentId: intent.id, success: true })
    } catch {
      results.push({ taskId: task.id, intentId: '', success: false })
    }
  }

  return c.json({
    success: true,
    data: { ran: results.length, results },
    message: `Processed ${results.length} due tasks`,
    timestamp: new Date().toISOString()
  })
})

// ============================================================
// HELPERS
// ============================================================

function computeNextRun(
  frequency: ScheduleFrequency,
  dayOfWeek?: DayOfWeek,
  hour = 9
): string {
  const now = new Date()
  const next = new Date(now)
  next.setHours(hour, 0, 0, 0)

  if (frequency === 'daily') {
    if (next <= now) next.setDate(next.getDate() + 1)
    return next.toISOString()
  }

  if (frequency === 'weekly' && dayOfWeek) {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
    const target = days.indexOf(dayOfWeek)
    const current = now.getDay()
    let diff = (target - current + 7) % 7
    if (diff === 0 && next <= now) diff = 7
    next.setDate(now.getDate() + diff)
    return next.toISOString()
  }

  if (frequency === 'biweekly' && dayOfWeek) {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
    const target = days.indexOf(dayOfWeek)
    const current = now.getDay()
    let diff = (target - current + 7) % 7
    if (diff === 0 && next <= now) diff = 14
    else diff += 7
    next.setDate(now.getDate() + diff)
    return next.toISOString()
  }

  if (frequency === 'monthly') {
    next.setMonth(next.getMonth() + 1)
    next.setDate(1)
    return next.toISOString()
  }

  // Default: tomorrow
  next.setDate(next.getDate() + 1)
  return next.toISOString()
}

export default schedules
