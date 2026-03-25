// ================================================================
// PLATFORM AI SERVICE — Centralized AI Routing
// ================================================================
// Architecture Rule:
//   ALL AI calls go through this service ONLY.
//   Platform owns both API keys — users NEVER supply their own.
//   Every request tracks token usage and respects plan limits.
//   Returns INTENT JSON only. Never executes actions.
// ================================================================

import type { Intent, AgentName, IntentType, BusinessProfile, RiskLevel, Priority } from '../types/core'
import { genId } from './store'

// ── Env bindings (platform-owned keys) ───────────────────────────
export interface Env {
  DB?: D1Database
  ANTHROPIC_API_KEY?: string    // Platform-owned, never exposed to users
  OPENAI_API_KEY?: string       // Platform-owned, never exposed to users
  JWT_SECRET?: string
}

// ── Model Config ─────────────────────────────────────────────────
// Cost per 1K tokens in USD (used for profit tracking)
const MODEL_COSTS: Record<string, { input: number; output: number }> = {
  'claude-3-5-haiku-20241022': { input: 0.00025, output: 0.00125 },  // Cheapest Claude
  'gpt-4o-mini':               { input: 0.00015, output: 0.0006  },  // Cheapest GPT-4
  'demo':                      { input: 0,       output: 0       }   // No cost for demo
}

// ── Token costs per request type ─────────────────────────────────
// Tokens deducted from user allowance (not same as actual API tokens)
const PLATFORM_TOKEN_COSTS: Record<string, number> = {
  intent_generate: 500,   // Each intent generation costs 500 platform tokens
  chat_message:    100,   // Each chat message costs 100 platform tokens
  analysis:        300,   // Analysis runs cost 300 platform tokens
  schedule_run:    500    // Scheduled runs cost 500 platform tokens
}

// ── Profit margin safety (block if usage > this %) ───────────────
const PROFIT_SAFETY_BUFFER = 0.80  // Use at most 80% of plan token limit for AI calls

// ── Plan token limits ─────────────────────────────────────────────
export const PLAN_LIMITS: Record<string, { tokens: number; agents: number; chat: boolean; schedules: number; workflows: number }> = {
  free:       { tokens: 10000,   agents: 2,  chat: false, schedules: 2,   workflows: 1  },
  starter:    { tokens: 50000,   agents: 5,  chat: true,  schedules: 5,   workflows: 3  },
  pro:        { tokens: 200000,  agents: 7,  chat: true,  schedules: 20,  workflows: 10 },
  enterprise: { tokens: 1000000, agents: 7,  chat: true,  schedules: 100, workflows: 100 }
}

// ── Token usage result ────────────────────────────────────────────
export interface TokenUsageResult {
  allowed: boolean
  reason?: string
  tokensUsed: number
  tokensRemaining: number
  costUsd: number
  modelUsed: string
  planName: string
}

// ── AI Request ────────────────────────────────────────────────────
export interface AIRequest {
  userId: string
  requestType: 'intent_generate' | 'chat_message' | 'analysis' | 'schedule_run'
  agentName?: AgentName
  intentType?: IntentType
  systemPrompt: string
  userPrompt: string
  preferredModel?: 'claude' | 'openai' | 'demo'
  context?: Record<string, unknown>
}

// ── AI Response ───────────────────────────────────────────────────
export interface AIResponse {
  content: string
  modelUsed: string
  promptTokens: number
  completionTokens: number
  totalTokens: number
  costUsd: number
  isDemo: boolean
  tokenUsageResult: TokenUsageResult
}

// ================================================================
// CORE AI ROUTER
// ================================================================

export async function callPlatformAI(req: AIRequest, env: Env): Promise<AIResponse> {
  // 1. Check token budget
  const usageCheck = await checkAndDeductTokens(req.userId, req.requestType, env)
  if (!usageCheck.allowed) {
    return buildBlockedResponse(usageCheck)
  }

  // 2. Select model (platform decides, never user)
  const model = selectModel(req.preferredModel, env)

  // 3. Call AI
  let rawContent = ''
  let promptTokens = 0
  let completionTokens = 0
  let isDemo = false

  try {
    if (model === 'claude' && env.ANTHROPIC_API_KEY) {
      const result = await callClaude(req.systemPrompt, req.userPrompt, env.ANTHROPIC_API_KEY)
      rawContent = result.content
      promptTokens = result.promptTokens
      completionTokens = result.completionTokens
    } else if (model === 'openai' && env.OPENAI_API_KEY) {
      const result = await callOpenAI(req.systemPrompt, req.userPrompt, env.OPENAI_API_KEY)
      rawContent = result.content
      promptTokens = result.promptTokens
      completionTokens = result.completionTokens
    } else {
      // Demo mode — no real API keys configured
      rawContent = ''
      isDemo = true
    }
  } catch (err) {
    console.error('[PlatformAI] Error calling AI:', err)
    isDemo = true
  }

  const totalTokens = promptTokens + completionTokens
  const modelKey = isDemo ? 'demo' : (model === 'claude' ? 'claude-3-5-haiku-20241022' : 'gpt-4o-mini')
  const cost = isDemo ? 0 : computeCost(modelKey, promptTokens, completionTokens)

  // 4. Log usage to D1 if available
  if (env.DB && !isDemo) {
    await logTokenUsage(env.DB, req, modelKey, promptTokens, completionTokens, cost)
  }

  return {
    content: rawContent,
    modelUsed: modelKey,
    promptTokens,
    completionTokens,
    totalTokens,
    costUsd: cost,
    isDemo,
    tokenUsageResult: usageCheck
  }
}

// ── Token budget check & deduction ───────────────────────────────
async function checkAndDeductTokens(
  userId: string,
  requestType: string,
  env: Env
): Promise<TokenUsageResult> {
  const cost = PLATFORM_TOKEN_COSTS[requestType] ?? 500

  // No DB = demo mode, always allow
  if (!env.DB) {
    return { allowed: true, tokensUsed: cost, tokensRemaining: 99999, costUsd: 0, modelUsed: 'demo', planName: 'demo' }
  }

  try {
    const period = getPeriodStart()

    // Get current ledger
    const ledger = await env.DB.prepare(`
      SELECT tl.*, p.name as plan_name, p.monthly_tokens
      FROM token_ledger tl
      JOIN subscriptions s ON s.user_id = tl.user_id
      JOIN plans p ON p.id = s.plan_id
      WHERE tl.user_id = ? AND tl.period_start = ? AND s.status = 'active'
    `).bind(userId, period).first<{
      tokens_granted: number; tokens_used: number; tokens_remaining: number;
      plan_name: string; monthly_tokens: number
    }>()

    if (!ledger) {
      // Create ledger entry for this period
      await ensureTokenLedger(userId, env.DB)
      return { allowed: true, tokensUsed: cost, tokensRemaining: 9500, costUsd: 0, modelUsed: 'demo', planName: 'free' }
    }

    const remaining = ledger.tokens_remaining ?? (ledger.tokens_granted - ledger.tokens_used)
    const planName = ledger.plan_name ?? 'free'

    // Safety: enforce profit buffer
    const effectiveLimit = Math.floor(ledger.tokens_granted * PROFIT_SAFETY_BUFFER)

    if (ledger.tokens_used + cost > effectiveLimit) {
      return {
        allowed: false,
        reason: `Monthly token limit reached for ${planName} plan. Used: ${ledger.tokens_used.toLocaleString()}/${ledger.tokens_granted.toLocaleString()}`,
        tokensUsed: 0,
        tokensRemaining: Math.max(0, remaining),
        costUsd: 0,
        modelUsed: 'blocked',
        planName
      }
    }

    // Deduct tokens
    await env.DB.prepare(`
      UPDATE token_ledger SET tokens_used = tokens_used + ?, updated_at = datetime('now')
      WHERE user_id = ? AND period_start = ?
    `).bind(cost, userId, period).run()

    return {
      allowed: true,
      tokensUsed: cost,
      tokensRemaining: Math.max(0, remaining - cost),
      costUsd: 0,
      modelUsed: 'pending',
      planName
    }
  } catch (err) {
    console.error('[PlatformAI] Token check error:', err)
    // On DB error, allow but log
    return { allowed: true, tokensUsed: cost, tokensRemaining: -1, costUsd: 0, modelUsed: 'unknown', planName: 'unknown' }
  }
}

async function ensureTokenLedger(userId: string, db: D1Database): Promise<void> {
  const period = getPeriodStart()
  const periodEnd = getPeriodEnd()

  // Get user's plan
  const sub = await db.prepare(`
    SELECT p.monthly_tokens, p.name FROM subscriptions s
    JOIN plans p ON p.id = s.plan_id
    WHERE s.user_id = ? AND s.status = 'active'
    LIMIT 1
  `).bind(userId).first<{ monthly_tokens: number; name: string }>()

  const tokens = sub?.monthly_tokens ?? 10000

  await db.prepare(`
    INSERT OR IGNORE INTO token_ledger (id, user_id, period_start, period_end, tokens_granted, tokens_used, cost_usd)
    VALUES (?, ?, ?, ?, ?, 0, 0)
  `).bind(`ledger-${userId}-${period}`, userId, period, periodEnd, tokens).run()
}

// ── Model selector ────────────────────────────────────────────────
function selectModel(preferred?: string, env?: Env): 'claude' | 'openai' | 'demo' {
  if (!env?.ANTHROPIC_API_KEY && !env?.OPENAI_API_KEY) return 'demo'
  if (preferred === 'claude' && env?.ANTHROPIC_API_KEY) return 'claude'
  if (preferred === 'openai' && env?.OPENAI_API_KEY) return 'openai'
  if (env?.ANTHROPIC_API_KEY) return 'claude'
  if (env?.OPENAI_API_KEY) return 'openai'
  return 'demo'
}

// ── Claude API call ───────────────────────────────────────────────
async function callClaude(
  systemPrompt: string,
  userPrompt: string,
  apiKey: string
): Promise<{ content: string; promptTokens: number; completionTokens: number }> {
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 1500,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }]
    })
  })

  if (!resp.ok) {
    const err = await resp.text()
    throw new Error(`Claude API error ${resp.status}: ${err}`)
  }

  const data = await resp.json() as {
    content: Array<{ text: string }>;
    usage: { input_tokens: number; output_tokens: number }
  }

  return {
    content: data.content[0]?.text ?? '',
    promptTokens: data.usage?.input_tokens ?? 0,
    completionTokens: data.usage?.output_tokens ?? 0
  }
}

// ── OpenAI API call ───────────────────────────────────────────────
async function callOpenAI(
  systemPrompt: string,
  userPrompt: string,
  apiKey: string
): Promise<{ content: string; promptTokens: number; completionTokens: number }> {
  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      max_tokens: 1500,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]
    })
  })

  if (!resp.ok) {
    const err = await resp.text()
    throw new Error(`OpenAI API error ${resp.status}: ${err}`)
  }

  const data = await resp.json() as {
    choices: Array<{ message: { content: string } }>;
    usage: { prompt_tokens: number; completion_tokens: number }
  }

  return {
    content: data.choices[0]?.message?.content ?? '',
    promptTokens: data.usage?.prompt_tokens ?? 0,
    completionTokens: data.usage?.completion_tokens ?? 0
  }
}

// ── Log token usage to D1 ─────────────────────────────────────────
async function logTokenUsage(
  db: D1Database,
  req: AIRequest,
  model: string,
  promptTokens: number,
  completionTokens: number,
  costUsd: number
): Promise<void> {
  const period = getPeriodStart()
  await db.prepare(`
    INSERT INTO token_usage (id, user_id, request_type, model_used, prompt_tokens, completion_tokens, total_tokens, cost_usd, period_start, agent_name, intent_type)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    genId('tu'), req.userId, req.requestType, model,
    promptTokens, completionTokens, promptTokens + completionTokens,
    costUsd, period, req.agentName ?? null, req.intentType ?? null
  ).run()

  // Update cost in ledger
  await db.prepare(`
    UPDATE token_ledger SET cost_usd = cost_usd + ?, updated_at = datetime('now')
    WHERE user_id = ? AND period_start = ?
  `).bind(costUsd, req.userId, period).run()
}

// ── Helpers ───────────────────────────────────────────────────────
function getPeriodStart(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

function getPeriodEnd(): string {
  const d = new Date()
  d.setMonth(d.getMonth() + 1, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

function computeCost(model: string, input: number, output: number): number {
  const costs = MODEL_COSTS[model]
  if (!costs) return 0
  return (input / 1000) * costs.input + (output / 1000) * costs.output
}

function buildBlockedResponse(usage: TokenUsageResult): AIResponse {
  return {
    content: JSON.stringify({
      error: 'TOKEN_LIMIT_REACHED',
      message: usage.reason ?? 'Monthly token limit reached',
      suggestUpgrade: true
    }),
    modelUsed: 'blocked',
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    costUsd: 0,
    isDemo: false,
    tokenUsageResult: usage
  }
}

// ================================================================
// TOKEN STATUS — used by API routes
// ================================================================
export async function getTokenStatus(userId: string, db: D1Database) {
  const period = getPeriodStart()
  await ensureTokenLedger(userId, db)

  const ledger = await db.prepare(`
    SELECT tl.*, p.name as plan_name, p.display_name, p.monthly_tokens, p.has_chat, p.has_analytics
    FROM token_ledger tl
    JOIN subscriptions s ON s.user_id = tl.user_id
    JOIN plans p ON p.id = s.plan_id
    WHERE tl.user_id = ? AND tl.period_start = ? AND s.status = 'active'
  `).bind(userId, period).first()

  if (!ledger) {
    return { tokensGranted: 10000, tokensUsed: 0, tokensRemaining: 10000, planName: 'free', percentage: 0, hasChat: false }
  }

  const l = ledger as Record<string, unknown>
  const granted = (l.tokens_granted as number) ?? 10000
  const used = (l.tokens_used as number) ?? 0
  const remaining = granted - used

  return {
    tokensGranted: granted,
    tokensUsed: used,
    tokensRemaining: remaining,
    planName: l.plan_name as string ?? 'free',
    displayName: l.display_name as string ?? 'Free',
    percentage: Math.round((used / granted) * 100),
    hasChat: Boolean(l.has_chat),
    hasAnalytics: Boolean(l.has_analytics),
    periodStart: period
  }
}
