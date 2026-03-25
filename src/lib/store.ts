// ============================================================
// IN-MEMORY STORE (Simulates KV / D1 for this environment)
// ============================================================
// In production: replace with Cloudflare D1 or KV bindings.
// The store is fully read/write through the Intent Layer only.
// The Action Layer is NEVER touched by this module.
// ============================================================

import type {
  Intent,
  ScheduledTask,
  UserProfile,
  DashboardStats
} from '../types/intent'

// ============================================================
// INTENT STORE
// ============================================================

const intentStore: Map<string, Intent> = new Map()

export function saveIntent(intent: Intent): void {
  intentStore.set(intent.id, intent)
}

export function getIntent(id: string): Intent | undefined {
  return intentStore.get(id)
}

export function updateIntent(id: string, updates: Partial<Intent>): Intent | null {
  const existing = intentStore.get(id)
  if (!existing) return null
  const updated = { ...existing, ...updates }
  intentStore.set(id, updated)
  return updated
}

export function getAllIntents(): Intent[] {
  return Array.from(intentStore.values()).sort(
    (a, b) =>
      new Date(b.metadata.generatedAt).getTime() -
      new Date(a.metadata.generatedAt).getTime()
  )
}

export function getIntentsByStatus(status: Intent['status']): Intent[] {
  return getAllIntents().filter(i => i.status === status)
}

export function getIntentsByType(type: Intent['type']): Intent[] {
  return getAllIntents().filter(i => i.type === type)
}

export function deleteIntent(id: string): boolean {
  return intentStore.delete(id)
}

// ============================================================
// SCHEDULE STORE
// ============================================================

const scheduleStore: Map<string, ScheduledTask> = new Map()

export function saveSchedule(task: ScheduledTask): void {
  scheduleStore.set(task.id, task)
}

export function getSchedule(id: string): ScheduledTask | undefined {
  return scheduleStore.get(id)
}

export function getAllSchedules(): ScheduledTask[] {
  return Array.from(scheduleStore.values()).sort(
    (a, b) => new Date(a.nextRun).getTime() - new Date(b.nextRun).getTime()
  )
}

export function updateSchedule(id: string, updates: Partial<ScheduledTask>): ScheduledTask | null {
  const existing = scheduleStore.get(id)
  if (!existing) return null
  const updated = { ...existing, ...updates }
  scheduleStore.set(id, updated)
  return updated
}

export function deleteSchedule(id: string): boolean {
  return scheduleStore.delete(id)
}

// ============================================================
// USER PROFILE STORE (Single Profile for now)
// ============================================================

let userProfile: UserProfile = {
  id: 'default',
  businessName: 'My E-Commerce Store',
  niche: 'hair products',
  pricingStyle: 'moderate',
  preferredAI: 'claude',
  notifyOnHighRisk: true,
  autoRejectHighRisk: false,
  focusCategories: ['hair care', 'beauty', 'accessories'],
  monthlyBudget: 5000,
  competitorUrls: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
}

export function getUserProfile(): UserProfile {
  return userProfile
}

export function updateUserProfile(updates: Partial<UserProfile>): UserProfile {
  userProfile = { ...userProfile, ...updates, updatedAt: new Date().toISOString() }
  return userProfile
}

// ============================================================
// DASHBOARD STATS
// ============================================================

export function getDashboardStats(): DashboardStats {
  const all = getAllIntents()
  const today = new Date().toDateString()

  const approvedToday = all.filter(
    i => i.status === 'approved' && i.reviewedAt && new Date(i.reviewedAt).toDateString() === today
  ).length

  const rejectedToday = all.filter(
    i => i.status === 'rejected' && i.reviewedAt && new Date(i.reviewedAt).toDateString() === today
  ).length

  const lastIntent = all[0]

  return {
    totalIntents: all.length,
    pendingIntents: all.filter(i => i.status === 'pending').length,
    approvedToday,
    rejectedToday,
    highRiskPending: all.filter(i => i.status === 'pending' && i.riskLevel === 'high').length,
    scheduledTasks: getAllSchedules().filter(s => s.isActive).length,
    lastAnalysisAt: lastIntent?.metadata.generatedAt
  }
}

// ============================================================
// SEED DEFAULT SCHEDULES
// ============================================================

export function seedDefaultSchedules(): void {
  if (getAllSchedules().length > 0) return

  const defaults: ScheduledTask[] = [
    {
      id: 'sched-market-weekly',
      name: 'Weekly Market Analysis',
      intentType: 'market_analysis',
      frequency: 'weekly',
      dayOfWeek: 'wednesday',
      hour: 9,
      isActive: true,
      nextRun: getNextWeekday('wednesday'),
      createdAt: new Date().toISOString(),
      description: 'Full market analysis every Wednesday morning',
      aiModel: 'claude',
      contextParams: {}
    },
    {
      id: 'sched-product-weekly',
      name: 'Saturday Product Review',
      intentType: 'performance_review',
      frequency: 'weekly',
      dayOfWeek: 'saturday',
      hour: 10,
      isActive: true,
      nextRun: getNextWeekday('saturday'),
      createdAt: new Date().toISOString(),
      description: 'Review all product performance every Saturday',
      aiModel: 'claude',
      contextParams: {}
    },
    {
      id: 'sched-competitor-daily',
      name: 'Daily Competitor Scan',
      intentType: 'competitor_scan',
      frequency: 'daily',
      hour: 7,
      isActive: true,
      nextRun: getTomorrow(),
      createdAt: new Date().toISOString(),
      description: 'Daily morning competitor price and trend scan',
      aiModel: 'openai',
      contextParams: {}
    }
  ]

  defaults.forEach(saveSchedule)
}

function getNextWeekday(day: string): string {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  const now = new Date()
  const target = days.indexOf(day)
  const current = now.getDay()
  const diff = (target - current + 7) % 7 || 7
  const next = new Date(now)
  next.setDate(now.getDate() + diff)
  next.setHours(9, 0, 0, 0)
  return next.toISOString()
}

function getTomorrow(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  d.setHours(7, 0, 0, 0)
  return d.toISOString()
}
