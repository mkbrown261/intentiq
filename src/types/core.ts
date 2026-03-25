// ================================================================
// CORE TYPE SYSTEM — AI Business Operating System
// ================================================================
// Architecture Rule:
//   Agents → Intent Layer → Human Approval → Action Layer
//   NO agent or module executes actions directly.
//   ALL outputs are INTENTS. ALL actions require human approval.
// ================================================================

// ── Intent Types ────────────────────────────────────────────────
export type IntentType =
  | 'inventory_restock'
  | 'inventory_liquidate'
  | 'pricing_adjust'
  | 'pricing_bundle'
  | 'pricing_discount'
  | 'market_trend'
  | 'market_opportunity'
  | 'competitor_alert'
  | 'email_campaign'
  | 'email_abandoned_cart'
  | 'email_reengagement'
  | 'product_create'
  | 'product_bundle'
  | 'product_variation'
  | 'workflow_suggestion'
  | 'business_health'
  | 'performance_alert'
  | 'seasonality_alert'
  | 'customer_segment'
  | 'ad_optimization'
  | 'financial_insight'
  | 'strategy_review'

export type RiskLevel     = 'low' | 'medium' | 'high'
export type Priority      = 'low' | 'medium' | 'high' | 'urgent'
export type IntentStatus  = 'pending' | 'approved' | 'rejected' | 'modified' | 'executing' | 'done'
export type AgentName     =
  | 'MarketResearchAgent'
  | 'PricingAgent'
  | 'InventoryAgent'
  | 'EmailMarketingAgent'
  | 'ProductCreationAgent'
  | 'BusinessHealthAgent'
  | 'StrategyAgent'

// ── Core Intent Object ───────────────────────────────────────────
export interface Intent {
  id: string
  type: IntentType
  summary: string
  detailedReasoning: string
  whyThisMatters: string
  suggestedNextSteps: string[]
  expectedResult: string
  alternativeOptions?: string[]
  riskLevel: RiskLevel
  confidenceLevel: number        // 0–100
  requiresApproval: true         // ALWAYS TRUE — immutable
  priority: Priority
  status: IntentStatus
  generatedBy: AgentName
  workflowId?: string
  approvalId?: string
  createdAt: string
  reviewedAt?: string
  modificationNote?: string
  tags: string[]
  metadata: IntentMetadata
}

export interface IntentMetadata {
  category: string
  estimatedValue?: string
  estimatedTimeToAct?: string    // e.g. "within 48 hours"
  affectedProducts?: string[]
  dataPoints?: Record<string, string | number>
  scheduleId?: string
  runCount?: number
}

// ── Agent Definition ─────────────────────────────────────────────
export interface Agent {
  id: AgentName
  displayName: string
  description: string
  responsibilities: string[]
  intentTypes: IntentType[]
  icon: string
  color: string
  isActive: boolean
  lastRun?: string
  totalIntentsGenerated: number
  successRate: number            // 0–100
}

// ── Workflow ─────────────────────────────────────────────────────
export type WorkflowStatus = 'active' | 'paused' | 'completed' | 'draft'

export interface WorkflowStep {
  id: string
  intentId?: string
  label: string
  description: string
  status: 'pending' | 'in_progress' | 'done' | 'skipped'
  agentName: AgentName
  order: number
}

export interface Workflow {
  id: string
  name: string
  description: string
  triggerType: 'manual' | 'scheduled' | 'event'
  status: WorkflowStatus
  steps: WorkflowStep[]
  currentStepIndex: number
  progress: number               // 0–100
  createdAt: string
  updatedAt: string
  completedAt?: string
  agentsInvolved: AgentName[]
  totalIntents: number
  approvedIntents: number
  tags: string[]
}

// ── Approval Record ──────────────────────────────────────────────
export interface Approval {
  id: string
  intentId: string
  decision: 'approved' | 'rejected' | 'modified'
  note?: string
  decidedAt: string
  executionStatus?: 'pending' | 'executed' | 'failed'
}

// ── Schedule ─────────────────────────────────────────────────────
export type ScheduleFrequency = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly'
export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'

export interface Schedule {
  id: string
  name: string
  description: string
  intentType: IntentType
  agentName: AgentName
  frequency: ScheduleFrequency
  dayOfWeek?: DayOfWeek
  hour: number
  isActive: boolean
  lastRun?: string
  nextRun: string
  createdAt: string
  contextParams: Record<string, string>
  totalRuns: number
  intentsGenerated: number
}

// ── Business Profile (Personalization) ──────────────────────────
export interface BusinessProfile {
  id: string
  businessName: string
  ownerName: string
  niche: string
  subNiche?: string
  platform: 'shopify' | 'amazon' | 'etsy' | 'woocommerce' | 'multi' | 'other'
  pricingStyle: 'aggressive' | 'moderate' | 'premium'
  riskTolerance: 'conservative' | 'balanced' | 'aggressive'
  monthlyRevenue?: number
  monthlyBudget?: number
  teamSize: 'solo' | 'small' | 'medium' | 'large'
  focusCategories: string[]
  topProducts: string[]
  preferredAI: 'claude' | 'openai' | 'hybrid'
  autoRejectHighRisk: boolean
  notifyUrgent: boolean
  approvalPatterns: ApprovalPattern[]
  createdAt: string
  updatedAt: string
}

export interface ApprovalPattern {
  intentType: IntentType
  approvalRate: number           // 0–100
  avgModificationRate: number    // 0–100
  lastDecision: IntentStatus
}

// ── Business Health ──────────────────────────────────────────────
export interface HealthScore {
  overall: number                // 0–100
  inventory: number
  pricing: number
  marketing: number
  products: number
  operations: number
  trend: 'up' | 'down' | 'stable'
  lastUpdated: string
  alerts: HealthAlert[]
}

export interface HealthAlert {
  id: string
  severity: 'info' | 'warning' | 'critical'
  message: string
  area: string
  createdAt: string
}

// ── Analytics / Insight ──────────────────────────────────────────
export interface BusinessInsight {
  id: string
  title: string
  summary: string
  value: string
  trend: 'up' | 'down' | 'stable'
  trendPercent?: number
  area: string
  icon: string
  color: string
  createdAt: string
}

// ── Dashboard Stats ──────────────────────────────────────────────
export interface DashboardStats {
  totalIntents: number
  pendingIntents: number
  approvedToday: number
  rejectedToday: number
  urgentIntents: number
  highRiskPending: number
  activeWorkflows: number
  activeSchedules: number
  healthScore: number
  intentsThisWeek: number
  lastActivityAt?: string
}

// ── Agent Log ────────────────────────────────────────────────────
export interface AgentLog {
  id: string
  agentName: AgentName
  action: string
  intentId?: string
  status: 'success' | 'error' | 'skipped'
  message: string
  timestamp: string
}

// ── API Types ────────────────────────────────────────────────────
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  timestamp: string
}

export interface GenerateIntentRequest {
  agentName?: AgentName
  intentType: IntentType
  context?: Record<string, unknown>
  scheduleId?: string
  workflowId?: string
}

export interface ApproveIntentRequest {
  decision: 'approved' | 'rejected' | 'modified'
  note?: string
}
