// ================================================================
// BUSINESS OS STORE — In-Memory Data Layer
// ================================================================
// Stores all entities: intents, agents, workflows, approvals,
// schedules, profile, health, insights, agent logs.
//
// Production upgrade path: Replace Maps with Cloudflare D1 / KV.
// ================================================================

import type {
  Intent, Agent, Workflow, Approval, Schedule,
  BusinessProfile, HealthScore, BusinessInsight,
  AgentLog, DashboardStats, ApprovalPattern,
  AgentName, IntentType
} from '../types/core'

// ── Intent Store ─────────────────────────────────────────────────
const intentStore = new Map<string, Intent>()

export const IntentStore = {
  save: (i: Intent) => intentStore.set(i.id, i),
  get:  (id: string) => intentStore.get(id),
  all:  () => [...intentStore.values()].sort((a,b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
  byStatus: (s: Intent['status']) =>
    IntentStore.all().filter(i => i.status === s),
  byType:   (t: IntentType) =>
    IntentStore.all().filter(i => i.type === t),
  byAgent:  (a: AgentName) =>
    IntentStore.all().filter(i => i.generatedBy === a),
  update: (id: string, patch: Partial<Intent>): Intent | null => {
    const ex = intentStore.get(id)
    if (!ex) return null
    const updated = { ...ex, ...patch }
    intentStore.set(id, updated)
    return updated
  },
  delete: (id: string) => intentStore.delete(id),
  count:  () => intentStore.size
}

// ── Agent Store ──────────────────────────────────────────────────
const agentStore = new Map<string, Agent>()

export const AgentStore = {
  save:   (a: Agent) => agentStore.set(a.id, a),
  get:    (id: AgentName) => agentStore.get(id),
  all:    () => [...agentStore.values()],
  update: (id: AgentName, patch: Partial<Agent>): Agent | null => {
    const ex = agentStore.get(id)
    if (!ex) return null
    const updated = { ...ex, ...patch }
    agentStore.set(id, updated)
    return updated
  },
  incrementIntents: (id: AgentName) => {
    const a = agentStore.get(id)
    if (a) agentStore.set(id, { ...a, totalIntentsGenerated: a.totalIntentsGenerated + 1, lastRun: new Date().toISOString() })
  }
}

// ── Workflow Store ───────────────────────────────────────────────
const workflowStore = new Map<string, Workflow>()

export const WorkflowStore = {
  save:   (w: Workflow) => workflowStore.set(w.id, w),
  get:    (id: string) => workflowStore.get(id),
  all:    () => [...workflowStore.values()].sort((a,b) =>
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
  update: (id: string, patch: Partial<Workflow>): Workflow | null => {
    const ex = workflowStore.get(id)
    if (!ex) return null
    const updated = { ...ex, ...patch, updatedAt: new Date().toISOString() }
    workflowStore.set(id, updated)
    return updated
  },
  delete: (id: string) => workflowStore.delete(id)
}

// ── Approval Store ───────────────────────────────────────────────
const approvalStore = new Map<string, Approval>()

export const ApprovalStore = {
  save:    (a: Approval) => approvalStore.set(a.id, a),
  get:     (id: string) => approvalStore.get(id),
  all:     () => [...approvalStore.values()],
  byIntent:(intentId: string) =>
    [...approvalStore.values()].find(a => a.intentId === intentId)
}

// ── Schedule Store ───────────────────────────────────────────────
const scheduleStore = new Map<string, Schedule>()

export const ScheduleStore = {
  save:   (s: Schedule) => scheduleStore.set(s.id, s),
  get:    (id: string) => scheduleStore.get(id),
  all:    () => [...scheduleStore.values()].sort((a,b) =>
    new Date(a.nextRun).getTime() - new Date(b.nextRun).getTime()),
  active: () => ScheduleStore.all().filter(s => s.isActive),
  due:    () => ScheduleStore.active().filter(s => new Date(s.nextRun) <= new Date()),
  update: (id: string, patch: Partial<Schedule>): Schedule | null => {
    const ex = scheduleStore.get(id)
    if (!ex) return null
    const updated = { ...ex, ...patch }
    scheduleStore.set(id, updated)
    return updated
  },
  delete: (id: string) => scheduleStore.delete(id)
}

// ── Agent Log Store ──────────────────────────────────────────────
const agentLogStore: AgentLog[] = []

export const AgentLogStore = {
  push: (log: AgentLog) => {
    agentLogStore.unshift(log)
    if (agentLogStore.length > 200) agentLogStore.pop()
  },
  recent: (n = 50) => agentLogStore.slice(0, n),
  byAgent: (name: AgentName) => agentLogStore.filter(l => l.agentName === name)
}

// ── Business Profile ─────────────────────────────────────────────
let businessProfile: BusinessProfile = {
  id: 'default',
  businessName: 'My E-Commerce Business',
  ownerName: 'Owner',
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

export const ProfileStore = {
  get: () => businessProfile,
  update: (patch: Partial<BusinessProfile>): BusinessProfile => {
    businessProfile = { ...businessProfile, ...patch, updatedAt: new Date().toISOString() }
    return businessProfile
  },
  recordApproval: (intentType: IntentType, decision: Intent['status']) => {
    const existing = businessProfile.approvalPatterns.find(p => p.intentType === intentType)
    if (existing) {
      if (decision === 'approved') existing.approvalRate = Math.min(100, existing.approvalRate + 5)
      if (decision === 'rejected') existing.approvalRate = Math.max(0, existing.approvalRate - 5)
      if (decision === 'modified') existing.avgModificationRate = Math.min(100, existing.avgModificationRate + 5)
      existing.lastDecision = decision as ApprovalPattern['lastDecision']
    } else {
      businessProfile.approvalPatterns.push({
        intentType,
        approvalRate: decision === 'approved' ? 70 : 30,
        avgModificationRate: decision === 'modified' ? 60 : 10,
        lastDecision: decision as ApprovalPattern['lastDecision']
      })
    }
  }
}

// ── Health Score ─────────────────────────────────────────────────
let healthScore: HealthScore = {
  overall: 72,
  inventory: 68,
  pricing: 74,
  marketing: 65,
  products: 80,
  operations: 75,
  trend: 'up',
  lastUpdated: new Date().toISOString(),
  alerts: [
    { id: 'ha-1', severity: 'warning', message: 'Inventory levels below optimal for 2 products', area: 'Inventory', createdAt: new Date().toISOString() },
    { id: 'ha-2', severity: 'info', message: 'Marketing email open rate trending upward', area: 'Marketing', createdAt: new Date().toISOString() }
  ]
}

export const HealthStore = {
  get: () => healthScore,
  update: (patch: Partial<HealthScore>) => {
    healthScore = { ...healthScore, ...patch, lastUpdated: new Date().toISOString() }
  },
  recalculate: () => {
    const intents = IntentStore.all()
    const approved = intents.filter(i => i.status === 'approved').length
    const total = intents.length || 1
    const approvalBoost = Math.floor((approved / total) * 10)
    healthScore.overall = Math.min(100, Math.max(0, 65 + approvalBoost))
    healthScore.lastUpdated = new Date().toISOString()
  }
}

// ── Business Insights ────────────────────────────────────────────
let insights: BusinessInsight[] = [
  {
    id: 'ins-1',
    title: 'Weekly Revenue',
    summary: 'Revenue this week vs last week',
    value: '+12%',
    trend: 'up',
    trendPercent: 12,
    area: 'Finance',
    icon: 'fa-dollar-sign',
    color: 'emerald',
    createdAt: new Date().toISOString()
  },
  {
    id: 'ins-2',
    title: 'Top Product Velocity',
    summary: 'Sales velocity for top SKU',
    value: '18/day',
    trend: 'up',
    trendPercent: 22,
    area: 'Products',
    icon: 'fa-fire',
    color: 'orange',
    createdAt: new Date().toISOString()
  },
  {
    id: 'ins-3',
    title: 'Inventory Health',
    summary: 'Days of stock remaining (avg)',
    value: '14 days',
    trend: 'down',
    trendPercent: -8,
    area: 'Inventory',
    icon: 'fa-boxes',
    color: 'amber',
    createdAt: new Date().toISOString()
  },
  {
    id: 'ins-4',
    title: 'Email Open Rate',
    summary: 'Last campaign performance',
    value: '26.4%',
    trend: 'up',
    trendPercent: 4,
    area: 'Marketing',
    icon: 'fa-envelope-open',
    color: 'violet',
    createdAt: new Date().toISOString()
  }
]

export const InsightStore = {
  all:    () => insights,
  update: (id: string, patch: Partial<BusinessInsight>) => {
    insights = insights.map(i => i.id === id ? { ...i, ...patch } : i)
  }
}

// ── Dashboard Stats ──────────────────────────────────────────────
export function getDashboardStats(): DashboardStats {
  const all = IntentStore.all()
  const today = new Date().toDateString()
  return {
    totalIntents: all.length,
    pendingIntents: all.filter(i => i.status === 'pending').length,
    approvedToday: all.filter(i => i.status === 'approved' && i.reviewedAt && new Date(i.reviewedAt).toDateString() === today).length,
    rejectedToday: all.filter(i => i.status === 'rejected' && i.reviewedAt && new Date(i.reviewedAt).toDateString() === today).length,
    urgentIntents: all.filter(i => i.status === 'pending' && i.priority === 'urgent').length,
    highRiskPending: all.filter(i => i.status === 'pending' && i.riskLevel === 'high').length,
    activeWorkflows: WorkflowStore.all().filter(w => w.status === 'active').length,
    activeSchedules: ScheduleStore.active().length,
    healthScore: HealthStore.get().overall,
    intentsThisWeek: all.filter(i => {
      const d = new Date(i.createdAt)
      const now = new Date()
      return (now.getTime() - d.getTime()) < 7 * 24 * 60 * 60 * 1000
    }).length,
    lastActivityAt: all[0]?.createdAt
  }
}

// ── ID Generator ─────────────────────────────────────────────────
export function genId(prefix = 'id'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`
}

// ── Next Run Calculator ──────────────────────────────────────────
export function computeNextRun(
  frequency: Schedule['frequency'],
  dayOfWeek?: Schedule['dayOfWeek'],
  hour = 9
): string {
  const now = new Date()
  const next = new Date(now)
  next.setHours(hour, 0, 0, 0)

  if (frequency === 'daily') {
    if (next <= now) next.setDate(next.getDate() + 1)
    return next.toISOString()
  }
  if ((frequency === 'weekly' || frequency === 'biweekly') && dayOfWeek) {
    const days = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday']
    const target = days.indexOf(dayOfWeek)
    const current = now.getDay()
    let diff = (target - current + 7) % 7
    if (diff === 0 && next <= now) diff = frequency === 'biweekly' ? 14 : 7
    else if (frequency === 'biweekly') diff += 7
    next.setDate(now.getDate() + diff)
    return next.toISOString()
  }
  if (frequency === 'monthly') {
    next.setMonth(next.getMonth() + 1, 1)
    return next.toISOString()
  }
  if (frequency === 'quarterly') {
    next.setMonth(next.getMonth() + 3, 1)
    return next.toISOString()
  }
  next.setDate(next.getDate() + 1)
  return next.toISOString()
}

// ================================================================
// SEED DATA — Agents, Schedules, Workflows
// ================================================================

export function seedSystem(): void {
  seedAgents()
  seedSchedules()
  seedWorkflows()
}

function seedAgents(): void {
  if (AgentStore.all().length > 0) return

  const agents: Agent[] = [
    {
      id: 'MarketResearchAgent',
      displayName: 'Market Research Agent',
      description: 'Tracks market trends, competitor moves, and identifies growth opportunities',
      responsibilities: ['Trend analysis','Competitor monitoring','Opportunity identification','Demand forecasting'],
      intentTypes: ['market_trend','market_opportunity','competitor_alert','seasonality_alert','strategy_review'],
      icon: 'fa-chart-line',
      color: 'violet',
      isActive: true,
      totalIntentsGenerated: 0,
      successRate: 92
    },
    {
      id: 'PricingAgent',
      displayName: 'Pricing Agent',
      description: 'Optimizes pricing strategy, identifies adjustments, bundles, and discount opportunities',
      responsibilities: ['Price analysis','Competitive positioning','Bundle strategy','Margin optimization'],
      intentTypes: ['pricing_adjust','pricing_bundle','pricing_discount','financial_insight'],
      icon: 'fa-tags',
      color: 'amber',
      isActive: true,
      totalIntentsGenerated: 0,
      successRate: 88
    },
    {
      id: 'InventoryAgent',
      displayName: 'Inventory Agent',
      description: 'Monitors stock levels, predicts stockouts, and identifies slow-moving products',
      responsibilities: ['Stock monitoring','Restock alerts','Liquidation planning','Velocity analysis'],
      intentTypes: ['inventory_restock','inventory_liquidate','performance_alert'],
      icon: 'fa-boxes',
      color: 'emerald',
      isActive: true,
      totalIntentsGenerated: 0,
      successRate: 95
    },
    {
      id: 'EmailMarketingAgent',
      displayName: 'Email Marketing Agent',
      description: 'Generates email campaigns, abandoned cart sequences, and re-engagement strategies',
      responsibilities: ['Campaign creation','Abandoned cart recovery','Customer re-engagement','Segmentation'],
      intentTypes: ['email_campaign','email_abandoned_cart','email_reengagement','customer_segment'],
      icon: 'fa-envelope',
      color: 'pink',
      isActive: true,
      totalIntentsGenerated: 0,
      successRate: 84
    },
    {
      id: 'ProductCreationAgent',
      displayName: 'Product Creation Agent',
      description: 'Identifies new product opportunities, bundles, and variations based on market data',
      responsibilities: ['New product ideas','Bundle strategy','Product descriptions','Variation analysis'],
      intentTypes: ['product_create','product_bundle','product_variation'],
      icon: 'fa-lightbulb',
      color: 'yellow',
      isActive: true,
      totalIntentsGenerated: 0,
      successRate: 79
    },
    {
      id: 'BusinessHealthAgent',
      displayName: 'Business Health Agent',
      description: 'Monitors overall business performance, KPIs, and generates health score analysis',
      responsibilities: ['Health scoring','KPI tracking','Performance alerts','Trend analysis'],
      intentTypes: ['business_health','performance_alert','financial_insight'],
      icon: 'fa-heartbeat',
      color: 'red',
      isActive: true,
      totalIntentsGenerated: 0,
      successRate: 91
    },
    {
      id: 'StrategyAgent',
      displayName: 'Strategy Agent',
      description: 'High-level strategic recommendations, quarterly reviews, and long-term planning',
      responsibilities: ['Strategic planning','Quarterly reviews','Market positioning','Growth roadmaps'],
      intentTypes: ['strategy_review','workflow_suggestion','market_opportunity'],
      icon: 'fa-chess',
      color: 'indigo',
      isActive: true,
      totalIntentsGenerated: 0,
      successRate: 86
    }
  ]

  agents.forEach(a => AgentStore.save(a))
}

function seedSchedules(): void {
  if (ScheduleStore.all().length > 0) return

  const defaults: Schedule[] = [
    {
      id: 'sched-daily-sales',
      name: 'Daily Sales Analysis',
      description: 'Analyze sales performance and velocity every morning',
      intentType: 'performance_alert',
      agentName: 'BusinessHealthAgent',
      frequency: 'daily',
      hour: 7,
      isActive: true,
      nextRun: computeNextRun('daily', undefined, 7),
      createdAt: new Date().toISOString(),
      contextParams: {},
      totalRuns: 0,
      intentsGenerated: 0
    },
    {
      id: 'sched-daily-inventory',
      name: 'Daily Inventory Check',
      description: 'Check stock levels and flag restock needs daily',
      intentType: 'inventory_restock',
      agentName: 'InventoryAgent',
      frequency: 'daily',
      hour: 8,
      isActive: true,
      nextRun: computeNextRun('daily', undefined, 8),
      createdAt: new Date().toISOString(),
      contextParams: {},
      totalRuns: 0,
      intentsGenerated: 0
    },
    {
      id: 'sched-weekly-pricing',
      name: 'Weekly Pricing Review',
      description: 'Full pricing analysis and competitive positioning every Wednesday',
      intentType: 'pricing_adjust',
      agentName: 'PricingAgent',
      frequency: 'weekly',
      dayOfWeek: 'wednesday',
      hour: 9,
      isActive: true,
      nextRun: computeNextRun('weekly', 'wednesday', 9),
      createdAt: new Date().toISOString(),
      contextParams: {},
      totalRuns: 0,
      intentsGenerated: 0
    },
    {
      id: 'sched-weekly-market',
      name: 'Weekly Market Research',
      description: 'Market trends, competitor moves, new opportunities every Monday',
      intentType: 'market_trend',
      agentName: 'MarketResearchAgent',
      frequency: 'weekly',
      dayOfWeek: 'monday',
      hour: 8,
      isActive: true,
      nextRun: computeNextRun('weekly', 'monday', 8),
      createdAt: new Date().toISOString(),
      contextParams: {},
      totalRuns: 0,
      intentsGenerated: 0
    },
    {
      id: 'sched-weekly-marketing',
      name: 'Weekly Marketing Review',
      description: 'Email performance and campaign opportunities every Saturday',
      intentType: 'email_campaign',
      agentName: 'EmailMarketingAgent',
      frequency: 'weekly',
      dayOfWeek: 'saturday',
      hour: 10,
      isActive: true,
      nextRun: computeNextRun('weekly', 'saturday', 10),
      createdAt: new Date().toISOString(),
      contextParams: {},
      totalRuns: 0,
      intentsGenerated: 0
    },
    {
      id: 'sched-monthly-trends',
      name: 'Monthly Market Trends',
      description: 'Deep monthly market analysis and trend forecast',
      intentType: 'market_opportunity',
      agentName: 'MarketResearchAgent',
      frequency: 'monthly',
      hour: 9,
      isActive: true,
      nextRun: computeNextRun('monthly'),
      createdAt: new Date().toISOString(),
      contextParams: {},
      totalRuns: 0,
      intentsGenerated: 0
    },
    {
      id: 'sched-monthly-segments',
      name: 'Monthly Customer Segmentation',
      description: 'Analyze customer behavior and segments for targeted campaigns',
      intentType: 'customer_segment',
      agentName: 'EmailMarketingAgent',
      frequency: 'monthly',
      hour: 10,
      isActive: true,
      nextRun: computeNextRun('monthly'),
      createdAt: new Date().toISOString(),
      contextParams: {},
      totalRuns: 0,
      intentsGenerated: 0
    },
    {
      id: 'sched-quarterly-strategy',
      name: 'Quarterly Strategy Review',
      description: 'Full business strategy review and roadmap planning',
      intentType: 'strategy_review',
      agentName: 'StrategyAgent',
      frequency: 'quarterly',
      hour: 9,
      isActive: true,
      nextRun: computeNextRun('quarterly'),
      createdAt: new Date().toISOString(),
      contextParams: {},
      totalRuns: 0,
      intentsGenerated: 0
    }
  ]

  defaults.forEach(s => ScheduleStore.save(s))
}

function seedWorkflows(): void {
  if (WorkflowStore.all().length > 0) return

  const workflows: Workflow[] = [
    {
      id: 'wf-launch',
      name: 'New Product Launch',
      description: 'Step-by-step workflow to research, price, and launch a new product',
      triggerType: 'manual',
      status: 'draft',
      steps: [
        { id: 'wf-launch-1', label: 'Market Research', description: 'Research demand and competition for the new product', status: 'pending', agentName: 'MarketResearchAgent', order: 1 },
        { id: 'wf-launch-2', label: 'Pricing Strategy', description: 'Set optimal entry price based on market data', status: 'pending', agentName: 'PricingAgent', order: 2 },
        { id: 'wf-launch-3', label: 'Product Description', description: 'Generate compelling product description and keywords', status: 'pending', agentName: 'ProductCreationAgent', order: 3 },
        { id: 'wf-launch-4', label: 'Launch Email Campaign', description: 'Create announcement email for existing customers', status: 'pending', agentName: 'EmailMarketingAgent', order: 4 }
      ],
      currentStepIndex: 0,
      progress: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      agentsInvolved: ['MarketResearchAgent','PricingAgent','ProductCreationAgent','EmailMarketingAgent'],
      totalIntents: 4,
      approvedIntents: 0,
      tags: ['launch','product']
    },
    {
      id: 'wf-restock',
      name: 'Inventory Restock Workflow',
      description: 'Identify, plan, and order restock for low-inventory products',
      triggerType: 'scheduled',
      status: 'active',
      steps: [
        { id: 'wf-restock-1', label: 'Stock Level Analysis', description: 'Identify which products need restock urgently', status: 'pending', agentName: 'InventoryAgent', order: 1 },
        { id: 'wf-restock-2', label: 'Financial Impact Check', description: 'Assess the cash flow impact of restocking', status: 'pending', agentName: 'BusinessHealthAgent', order: 2 },
        { id: 'wf-restock-3', label: 'Price Adjustment', description: 'Adjust prices on slow movers to free up cash for restock', status: 'pending', agentName: 'PricingAgent', order: 3 }
      ],
      currentStepIndex: 0,
      progress: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      agentsInvolved: ['InventoryAgent','BusinessHealthAgent','PricingAgent'],
      totalIntents: 3,
      approvedIntents: 0,
      tags: ['inventory','operations']
    },
    {
      id: 'wf-marketing',
      name: 'Monthly Marketing Sprint',
      description: 'Plan and execute monthly marketing activities',
      triggerType: 'scheduled',
      status: 'draft',
      steps: [
        { id: 'wf-mkt-1', label: 'Customer Segmentation', description: 'Identify target customer segments for this month', status: 'pending', agentName: 'EmailMarketingAgent', order: 1 },
        { id: 'wf-mkt-2', label: 'Campaign Creation', description: 'Generate email campaign for top segment', status: 'pending', agentName: 'EmailMarketingAgent', order: 2 },
        { id: 'wf-mkt-3', label: 'Bundle Promotion', description: 'Create product bundle to feature in campaign', status: 'pending', agentName: 'ProductCreationAgent', order: 3 },
        { id: 'wf-mkt-4', label: 'Abandoned Cart Recovery', description: 'Set up abandoned cart email sequence', status: 'pending', agentName: 'EmailMarketingAgent', order: 4 }
      ],
      currentStepIndex: 0,
      progress: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      agentsInvolved: ['EmailMarketingAgent','ProductCreationAgent'],
      totalIntents: 4,
      approvedIntents: 0,
      tags: ['marketing','email']
    }
  ]

  workflows.forEach(w => WorkflowStore.save(w))
}
