// ============================================================
// INTENT LAYER - Core Type Definitions
// ============================================================
// This is the ONLY communication interface for the system.
// NO action is ever taken automatically. All outputs are INTENTS.
// ============================================================

export type IntentType =
  | 'market_analysis'
  | 'pricing_update'
  | 'product_creation'
  | 'email_draft'
  | 'inventory_action'
  | 'competitor_scan'
  | 'trend_report'
  | 'bundle_suggestion'
  | 'restock_alert'
  | 'campaign_suggestion'
  | 'performance_review'
  | 'opportunity_alert'

export type RiskLevel = 'low' | 'medium' | 'high'

export type IntentStatus = 'pending' | 'approved' | 'rejected' | 'modified'

export type AIModel = 'claude' | 'openai' | 'hybrid'

export interface SuggestedAction {
  label: string
  description: string
  estimatedImpact: string
  reversible: boolean
}

export interface GuidanceBlock {
  whyThisMatters: string
  whatToDoNext: string
  expectedOutcome: string
}

export interface Intent {
  id: string
  type: IntentType
  summary: string
  detailedBreakdown: string
  suggestedActions: SuggestedAction[]
  riskLevel: RiskLevel
  requiresApproval: true   // ALWAYS TRUE — immutable by design
  status: IntentStatus
  guidance: GuidanceBlock
  metadata: {
    generatedBy: AIModel
    generatedAt: string
    scheduledTaskId?: string
    priority: number         // 1 (highest) → 5 (lowest)
    category: string
    tags: string[]
    estimatedValue?: string
  }
  modificationNote?: string
  reviewedAt?: string
}

// ============================================================
// SCHEDULE TYPES
// ============================================================

export type ScheduleFrequency = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'custom'

export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'

export interface ScheduledTask {
  id: string
  name: string
  intentType: IntentType
  frequency: ScheduleFrequency
  dayOfWeek?: DayOfWeek
  hour?: number             // 0-23
  isActive: boolean
  lastRun?: string
  nextRun: string
  createdAt: string
  description: string
  aiModel: AIModel
  contextParams?: Record<string, string>
}

// ============================================================
// USER PROFILE — For Personalization
// ============================================================

export interface UserProfile {
  id: string
  businessName: string
  niche: string             // e.g. "hair products", "electronics"
  pricingStyle: 'aggressive' | 'moderate' | 'premium'
  preferredAI: AIModel
  notifyOnHighRisk: boolean
  autoRejectHighRisk: boolean
  focusCategories: string[]
  monthlyBudget?: number
  competitorUrls?: string[]
  createdAt: string
  updatedAt: string
}

// ============================================================
// AI ROUTER CONFIG
// ============================================================

export interface AIRoutingRule {
  intentType: IntentType
  preferredModel: AIModel
  fallback: AIModel
  reason: string
}

// ============================================================
// API Response Types
// ============================================================

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  timestamp: string
}

export interface IntentGenerationRequest {
  intentType: IntentType
  context: Record<string, unknown>
  userProfile?: Partial<UserProfile>
  scheduledTaskId?: string
}

export interface IntentUpdateRequest {
  status: IntentStatus
  modificationNote?: string
}

export interface DashboardStats {
  totalIntents: number
  pendingIntents: number
  approvedToday: number
  rejectedToday: number
  highRiskPending: number
  scheduledTasks: number
  lastAnalysisAt?: string
}
