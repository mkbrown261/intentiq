// ================================================================
// PLATFORM AI SERVICE v2 — Token Economy + Anti-Abuse + Profit
// ================================================================
// Architecture Rules:
//   ALL AI calls go through this service ONLY.
//   Platform owns API keys — users NEVER supply their own.
//   Every request: check budget → check abuse → call AI → log profit.
//   Returns INTENT JSON only. Never executes actions.
// ================================================================

import { genId } from './store'

// ── Env bindings ─────────────────────────────────────────────────
export interface Env {
  DB?: D1Database
  ANTHROPIC_API_KEY?: string
  OPENAI_API_KEY?: string
  JWT_SECRET?: string
}

// ── Pricing: cost per 1K tokens ($0.0025 baseline) ───────────────
const MODEL_COSTS: Record<string, { input: number; output: number }> = {
  'claude-3-5-haiku-20241022': { input: 0.00025, output: 0.00125 },
  'gpt-4o-mini':               { input: 0.00015, output: 0.00060 },
  'demo':                      { input: 0,       output: 0 }
}

// ── Platform token costs (deducted from user monthly allowance) ───
export const PLATFORM_TOKEN_COSTS: Record<string, number> = {
  intent_generate: 2000,   // ~2K tokens per intent (800 prompt + 1200 completion)
  chat_message:    500,    // ~500 tokens per chat message
  analysis:        1500,   // ~1500 tokens per analysis
  schedule_run:    2000    // same as intent_generate
}

// ── Cooldown periods (seconds between requests) ───────────────────
const COOLDOWN_SECONDS: Record<string, Record<string, number>> = {
  free:    { intent_generate: 30, chat_message: 10, schedule_run: 60 },
  starter: { intent_generate: 5,  chat_message: 2,  schedule_run: 10 },
  pro:     { intent_generate: 2,  chat_message: 1,  schedule_run: 5  },
  scale:   { intent_generate: 0,  chat_message: 0,  schedule_run: 0  }
}

// ── Abuse thresholds ──────────────────────────────────────────────
const ABUSE_THRESHOLDS = {
  rapidRequestsPerMinute: 20,      // Flag if > 20 requests/min
  rapidTokensPerMinute: 50000,     // Flag if > 50K tokens/min
  repeatedIdenticalHashes: 5,      // Flag if same request hash > 5 times/hour
  botUserAgentPatterns: [/curl\//i, /python-requests/i, /wget\//i, /scrapy/i, /httpx/i]
}

// ── Plan limits (cached in memory for speed) ──────────────────────
export const PLAN_LIMITS: Record<string, {
  tokens: number; dailyTokens: number; agents: number; chat: boolean;
  scheduling: boolean; advancedAgents: boolean; schedules: number; workflows: number
}> = {
  free:    { tokens: 10000,    dailyTokens: 2000,   agents: 2, chat: true,  scheduling: false, advancedAgents: false, schedules: 0,   workflows: 1   },
  starter: { tokens: 1200000,  dailyTokens: 40000,  agents: 5, chat: true,  scheduling: true,  advancedAgents: false, schedules: 5,   workflows: 3   },
  pro:     { tokens: 3600000,  dailyTokens: 120000, agents: 7, chat: true,  scheduling: true,  advancedAgents: true,  schedules: 20,  workflows: 10  },
  scale:   { tokens: 12000000, dailyTokens: 400000, agents: 7, chat: true,  scheduling: true,  advancedAgents: true,  schedules: 100, workflows: 100 }
}

// ── Types ─────────────────────────────────────────────────────────
export interface TokenUsageResult {
  allowed: boolean
  reason?: string
  tokensUsed: number
  tokensRemaining: number
  dailyRemaining?: number
  costUsd: number
  modelUsed: string
  planName: string
  cooldownSeconds?: number
}

export interface AIRequest {
  userId: string
  requestType: 'intent_generate' | 'chat_message' | 'analysis' | 'schedule_run'
  agentName?: string
  intentType?: string
  systemPrompt: string
  userPrompt: string
  preferredModel?: 'claude' | 'openai' | 'demo'
  context?: Record<string, unknown>
  cacheKey?: string       // For response caching
  ipAddress?: string
  userAgent?: string
}

export interface AIResponse {
  content: string
  modelUsed: string
  promptTokens: number
  completionTokens: number
  totalTokens: number
  costUsd: number
  isDemo: boolean
  fromCache: boolean
  tokenUsageResult: TokenUsageResult
}

// ================================================================
// CORE AI ROUTER
// ================================================================

export async function callPlatformAI(req: AIRequest, env: Env): Promise<AIResponse> {
  const db = env.DB

  // 1. Anti-abuse pre-flight (bot detection, rate limiting)
  if (db) {
    const abuseCheck = await checkAbuse(req, db)
    if (!abuseCheck.allowed) {
      return buildBlockedResponse({ ...buildDeniedResult(req, abuseCheck.reason), planName: 'unknown' })
    }
  }

  // 2. Check token budget (monthly + daily)
  const usageCheck = await checkAndDeductTokens(req.userId, req.requestType, env)
  if (!usageCheck.allowed) {
    if (db) await logRequest(db, req, 0, 'blocked')
    return buildBlockedResponse(usageCheck)
  }

  // 3. Check cache (skip for user-specific or sensitive requests)
  const cacheKey = req.cacheKey
  if (db && cacheKey) {
    const cached = await checkCache(db, cacheKey)
    if (cached) {
      await logRequest(db, req, 0, 'cache_hit')
      return {
        content: cached,
        modelUsed: 'cache',
        promptTokens: 0, completionTokens: 0, totalTokens: 0,
        costUsd: 0, isDemo: false, fromCache: true,
        tokenUsageResult: usageCheck
      }
    }
  }

  // 4. Select model (cheapest viable model per task)
  const model = selectOptimalModel(req.preferredModel, req.requestType, env)

  // 5. Call AI
  let rawContent = ''
  let promptTokens = 0
  let completionTokens = 0
  let isDemo = false

  try {
    if (model === 'claude' && env.ANTHROPIC_API_KEY) {
      // Compress prompt to reduce tokens
      const compressed = compressPrompt(req.systemPrompt, req.userPrompt)
      const result = await callClaude(compressed.system, compressed.user, env.ANTHROPIC_API_KEY)
      rawContent = result.content
      promptTokens = result.promptTokens
      completionTokens = result.completionTokens
    } else if (model === 'openai' && env.OPENAI_API_KEY) {
      const compressed = compressPrompt(req.systemPrompt, req.userPrompt)
      const result = await callOpenAI(compressed.system, compressed.user, env.OPENAI_API_KEY)
      rawContent = result.content
      promptTokens = result.promptTokens
      completionTokens = result.completionTokens
    } else {
      isDemo = true
    }
  } catch (err) {
    console.error('[PlatformAI] AI call error:', err)
    // Try fallback model
    try {
      if (model === 'claude' && env.OPENAI_API_KEY) {
        const r = await callOpenAI(req.systemPrompt, req.userPrompt, env.OPENAI_API_KEY)
        rawContent = r.content; promptTokens = r.promptTokens; completionTokens = r.completionTokens
      } else if (model === 'openai' && env.ANTHROPIC_API_KEY) {
        const r = await callClaude(req.systemPrompt, req.userPrompt, env.ANTHROPIC_API_KEY)
        rawContent = r.content; promptTokens = r.promptTokens; completionTokens = r.completionTokens
      } else { isDemo = true }
    } catch { isDemo = true }
  }

  const totalTokens = promptTokens + completionTokens
  const modelKey = isDemo ? 'demo' : (model === 'claude' ? 'claude-3-5-haiku-20241022' : 'gpt-4o-mini')
  const actualCostUsd = isDemo ? 0 : computeCost(modelKey, promptTokens, completionTokens)

  // 6. Log usage + update profit tracking
  if (db) {
    await Promise.all([
      logTokenUsage(db, req, modelKey, promptTokens, completionTokens, actualCostUsd),
      updateProfitTracking(db, req.userId, actualCostUsd),
      logRequest(db, req, usageCheck.tokensUsed, 'ok')
    ])

    // Cache response if key provided and not demo
    if (cacheKey && !isDemo && rawContent) {
      await cacheResponse(db, cacheKey, rawContent, req.intentType)
    }
  }

  return {
    content: rawContent,
    modelUsed: modelKey,
    promptTokens, completionTokens, totalTokens,
    costUsd: actualCostUsd,
    isDemo, fromCache: false,
    tokenUsageResult: { ...usageCheck, costUsd: actualCostUsd }
  }
}

// ================================================================
// ANTI-ABUSE SYSTEM
// ================================================================

async function checkAbuse(req: AIRequest, db: D1Database): Promise<{ allowed: boolean; reason?: string }> {
  const now = new Date()
  const oneMinuteAgo = new Date(now.getTime() - 60000).toISOString()
  const userId = req.userId

  // 1. Check if user is banned
  const banned = await db.prepare(`
    SELECT severity FROM abuse_flags
    WHERE user_id = ? AND severity = 'banned' AND auto_resolved = 0
    LIMIT 1
  `).bind(userId).first()
  if (banned) return { allowed: false, reason: 'Account suspended due to abuse. Contact support.' }

  // 2. Check if user is throttled
  const throttled = await db.prepare(`
    SELECT severity, details FROM abuse_flags
    WHERE user_id = ? AND severity = 'throttled' AND auto_resolved = 0
    AND created_at > datetime('now', '-1 hour')
    LIMIT 1
  `).bind(userId).first<{ severity: string; details: string }>()
  if (throttled) return { allowed: false, reason: `Request throttled: ${throttled.details}. Try again in 1 hour.` }

  // 3. Check bot-like User-Agent
  if (req.userAgent) {
    const isBot = ABUSE_THRESHOLDS.botUserAgentPatterns.some(p => p.test(req.userAgent!))
    if (isBot && userId !== 'user-demo') {
      await flagUser(db, userId, 'bot_behavior', 'warning', `Bot-like user agent: ${req.userAgent.substring(0, 100)}`)
      return { allowed: false, reason: 'Automated access detected. Use the web interface.' }
    }
  }

  // 4. Check rapid request rate (> 20 requests/minute)
  const recentRequests = await db.prepare(`
    SELECT COUNT(*) as cnt FROM request_log
    WHERE user_id = ? AND created_at > ? AND status != 'blocked'
  `).bind(userId, oneMinuteAgo).first<{ cnt: number }>()

  if ((recentRequests?.cnt ?? 0) > ABUSE_THRESHOLDS.rapidRequestsPerMinute) {
    await flagUser(db, userId, 'rapid_requests', 'throttled', `${recentRequests?.cnt} requests in 1 minute`)
    return { allowed: false, reason: 'Too many requests. Please slow down.' }
  }

  // 5. Check repeated identical requests (hash-based)
  if (req.cacheKey) {
    const oneHourAgo = new Date(now.getTime() - 3600000).toISOString()
    const identicalReqs = await db.prepare(`
      SELECT COUNT(*) as cnt FROM request_log
      WHERE user_id = ? AND fingerprint = ? AND created_at > ?
    `).bind(userId, req.cacheKey, oneHourAgo).first<{ cnt: number }>()

    if ((identicalReqs?.cnt ?? 0) >= ABUSE_THRESHOLDS.repeatedIdenticalHashes) {
      return { allowed: false, reason: 'Duplicate request detected. This result is already in your Intent Queue.' }
    }
  }

  return { allowed: true }
}

async function checkCooldown(
  userId: string,
  actionType: string,
  planName: string,
  db: D1Database
): Promise<{ allowed: boolean; secondsLeft?: number }> {
  const cd = await db.prepare(`
    SELECT cooldown_until FROM cooldowns
    WHERE user_id = ? AND action_type = ? AND cooldown_until > datetime('now')
  `).bind(userId, actionType).first<{ cooldown_until: string }>()

  if (cd) {
    const msLeft = new Date(cd.cooldown_until).getTime() - Date.now()
    return { allowed: false, secondsLeft: Math.ceil(msLeft / 1000) }
  }
  return { allowed: true }
}

async function setCooldown(userId: string, actionType: string, planName: string, db: D1Database): Promise<void> {
  const secs = COOLDOWN_SECONDS[planName]?.[actionType] ?? COOLDOWN_SECONDS.free[actionType] ?? 30
  if (secs === 0) return

  const until = new Date(Date.now() + secs * 1000).toISOString()
  await db.prepare(`
    INSERT OR REPLACE INTO cooldowns (id, user_id, action_type, cooldown_until, reason)
    VALUES (?, ?, ?, ?, ?)
  `).bind(genId('cd'), userId, actionType, until, `Plan: ${planName}`).run()
}

async function flagUser(
  db: D1Database,
  userId: string,
  flagType: string,
  severity: string,
  details: string
): Promise<void> {
  const id = genId('flag')
  await db.prepare(`
    INSERT INTO abuse_flags (id, user_id, flag_type, severity, details)
    VALUES (?, ?, ?, ?, ?)
  `).bind(id, userId, flagType, severity, details).run()
}

// ================================================================
// TOKEN BUDGET CHECK + DAILY CAP
// ================================================================

async function checkAndDeductTokens(
  userId: string,
  requestType: string,
  env: Env
): Promise<TokenUsageResult> {
  const platformTokenCost = PLATFORM_TOKEN_COSTS[requestType] ?? 2000
  const db = env.DB

  // No DB = demo mode, always allow
  if (!db) {
    return { allowed: true, tokensUsed: platformTokenCost, tokensRemaining: 999999, costUsd: 0, modelUsed: 'demo', planName: 'demo' }
  }

  try {
    const period = getPeriodStart()
    const today = getToday()

    // Get user's plan and ledger in one query
    const ledger = await db.prepare(`
      SELECT tl.tokens_granted, tl.tokens_used, p.name as plan_name, p.daily_tokens,
             p.monthly_tokens
      FROM token_ledger tl
      JOIN subscriptions s ON s.user_id = tl.user_id
      JOIN plans p ON p.id = s.plan_id
      WHERE tl.user_id = ? AND tl.period_start = ? AND s.status = 'active'
    `).bind(userId, period).first<{
      tokens_granted: number; tokens_used: number;
      plan_name: string; daily_tokens: number; monthly_tokens: number
    }>()

    if (!ledger) {
      await ensureTokenLedger(userId, db)
      return { allowed: true, tokensUsed: platformTokenCost, tokensRemaining: 8000, costUsd: 0, modelUsed: 'demo', planName: 'free' }
    }

    const planName = ledger.plan_name ?? 'free'
    const monthlyRemaining = ledger.tokens_granted - ledger.tokens_used
    const dailyLimit = ledger.daily_tokens ?? PLAN_LIMITS[planName]?.dailyTokens ?? 2000

    // Check monthly limit (with 80% profit buffer)
    const effectiveMonthlyLimit = Math.floor(ledger.tokens_granted * 0.80)
    if (ledger.tokens_used + platformTokenCost > effectiveMonthlyLimit) {
      return {
        allowed: false,
        reason: `Monthly AI token limit reached for ${planName} plan (${ledger.tokens_used.toLocaleString()}/${ledger.tokens_granted.toLocaleString()}). Upgrade for more capacity.`,
        tokensUsed: 0, tokensRemaining: Math.max(0, monthlyRemaining),
        costUsd: 0, modelUsed: 'blocked', planName
      }
    }

    // Check daily limit
    const dailyUsage = await db.prepare(`
      SELECT tokens_used FROM daily_token_usage WHERE user_id = ? AND date = ?
    `).bind(userId, today).first<{ tokens_used: number }>()

    const dailyUsed = dailyUsage?.tokens_used ?? 0
    const dailyRemaining = Math.max(0, dailyLimit - dailyUsed)

    if (dailyUsed + platformTokenCost > dailyLimit) {
      await flagUser(db, userId, 'daily_cap_exceeded', 'warning', `Daily limit ${dailyLimit} hit`)
      return {
        allowed: false,
        reason: `Daily token limit reached (${dailyUsed.toLocaleString()}/${dailyLimit.toLocaleString()}). Resets midnight UTC. Upgrade for higher daily limits.`,
        tokensUsed: 0, tokensRemaining: monthlyRemaining, dailyRemaining: 0,
        costUsd: 0, modelUsed: 'blocked', planName
      }
    }

    // Check cooldown
    const cdCheck = await checkCooldown(userId, requestType, planName, db)
    if (!cdCheck.allowed) {
      return {
        allowed: false,
        reason: `Please wait ${cdCheck.secondsLeft} seconds before your next request.`,
        tokensUsed: 0, tokensRemaining: monthlyRemaining, dailyRemaining,
        costUsd: 0, modelUsed: 'cooldown', planName,
        cooldownSeconds: cdCheck.secondsLeft
      }
    }

    // Deduct monthly tokens
    await db.prepare(`
      UPDATE token_ledger SET tokens_used = tokens_used + ?, updated_at = datetime('now')
      WHERE user_id = ? AND period_start = ?
    `).bind(platformTokenCost, userId, period).run()

    // Deduct/create daily tokens
    await db.prepare(`
      INSERT INTO daily_token_usage (id, user_id, date, tokens_used, request_count)
      VALUES (?, ?, ?, ?, 1)
      ON CONFLICT(user_id, date) DO UPDATE SET
        tokens_used = tokens_used + ?,
        request_count = request_count + 1,
        updated_at = datetime('now')
    `).bind(genId('dtu'), userId, today, platformTokenCost, platformTokenCost).run()

    // Set cooldown for next request
    await setCooldown(userId, requestType, planName, db)

    // ── Token milestone detection (async, non-blocking) ───────────
    // Compute pct AFTER deduction to trigger at the crossing point
    const newUsed = ledger.tokens_used + platformTokenCost
    const newPct = Math.round((newUsed / ledger.tokens_granted) * 100)
    const prevPct = Math.round((ledger.tokens_used / ledger.tokens_granted) * 100)
    const crossed50 = prevPct < 50 && newPct >= 50
    const crossed80 = prevPct < 80 && newPct >= 80

    // Fire milestones for free (50%/80%) and starter/pro (80%) users
    const shouldFireMilestone = (crossed50 && planName === 'free') ||
      (crossed80 && ['free', 'starter', 'pro'].includes(planName))
    if (shouldFireMilestone) {
      const milestoneType = crossed80 ? 'token_80' : 'token_50'
      const suggestedPlan = planName === 'free' ? 'starter' : planName === 'starter' ? 'pro' : 'scale'
      const urgency = crossed80 ? 'high' : 'low'
      // Fire-and-forget: log milestone event for frontend to pick up
      db.prepare(`
        INSERT OR IGNORE INTO upgrade_trigger_events
          (id, user_id, trigger_type, trigger_data, plan_name, suggested_plan, urgency, ab_variant)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        genId('tm'), userId, milestoneType,
        JSON.stringify({ pct: newPct, tokens_used: newUsed }),
        planName, suggestedPlan, urgency,
        userId.charCodeAt(0) % 2 === 0 ? 'A' : 'B'
      ).run().catch(() => {/* silent */})
    }

    return {
      allowed: true,
      tokensUsed: platformTokenCost,
      tokensRemaining: Math.max(0, monthlyRemaining - platformTokenCost),
      dailyRemaining: Math.max(0, dailyRemaining - platformTokenCost),
      costUsd: 0, modelUsed: 'pending', planName,
      tokenPct: newPct   // Return current pct for frontend milestone display
    } as TokenUsageResult & { tokenPct?: number }
  } catch (err) {
    console.error('[PlatformAI] Token check error:', err)
    return { allowed: true, tokensUsed: platformTokenCost, tokensRemaining: -1, costUsd: 0, modelUsed: 'unknown', planName: 'unknown' }
  }
}

// ================================================================
// COST OPTIMIZATION
// ================================================================

// Model routing: use cheapest model that can do the job
function selectOptimalModel(preferred?: string, requestType?: string, env?: Env): 'claude' | 'openai' | 'demo' {
  if (!env?.ANTHROPIC_API_KEY && !env?.OPENAI_API_KEY) return 'demo'

  // For chat: prefer OpenAI (cheaper for conversational)
  if (requestType === 'chat_message' && env?.OPENAI_API_KEY) return 'openai'

  // For analysis/strategy: prefer Claude (better reasoning)
  if ((requestType === 'analysis' || requestType === 'intent_generate') && env?.ANTHROPIC_API_KEY) return 'claude'

  // Explicit preference
  if (preferred === 'claude' && env?.ANTHROPIC_API_KEY) return 'claude'
  if (preferred === 'openai' && env?.OPENAI_API_KEY) return 'openai'

  // Default: cheapest available
  if (env?.OPENAI_API_KEY) return 'openai'   // GPT-4o-mini cheaper input cost
  if (env?.ANTHROPIC_API_KEY) return 'claude'
  return 'demo'
}

// Token compression: trim whitespace, remove redundant instructions
function compressPrompt(system: string, user: string): { system: string; user: string } {
  // Remove excessive whitespace
  const compressText = (s: string) => s
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()

  // Truncate if too long (keep under 3000 chars per prompt)
  const maxLen = 3000
  return {
    system: compressText(system).substring(0, maxLen),
    user: compressText(user).substring(0, maxLen)
  }
}

// Cache check
async function checkCache(db: D1Database, cacheKey: string): Promise<string | null> {
  const row = await db.prepare(`
    SELECT response FROM response_cache
    WHERE cache_key = ? AND expires_at > datetime('now')
    LIMIT 1
  `).bind(cacheKey).first<{ response: string }>()

  if (row) {
    // Increment hits
    await db.prepare('UPDATE response_cache SET hits = hits + 1 WHERE cache_key = ?').bind(cacheKey).run()
    return row.response
  }
  return null
}

// Cache response (6 hour TTL for market/trend data, 1 hour for others)
async function cacheResponse(db: D1Database, cacheKey: string, response: string, intentType?: string): Promise<void> {
  const ttlHours = intentType?.includes('market') || intentType?.includes('trend') ? 6 : 1
  const expiresAt = new Date(Date.now() + ttlHours * 3600000).toISOString()
  await db.prepare(`
    INSERT OR REPLACE INTO response_cache (cache_key, response, intent_type, hits, expires_at)
    VALUES (?, ?, ?, 0, ?)
  `).bind(cacheKey, response, intentType ?? null, expiresAt).run()
}

// ================================================================
// AI CALLS
// ================================================================

async function callClaude(
  systemPrompt: string, userPrompt: string, apiKey: string
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
      max_tokens: 1200,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }]
    })
  })
  if (!resp.ok) throw new Error(`Claude ${resp.status}: ${await resp.text()}`)
  const d = await resp.json() as {
    content: Array<{ text: string }>;
    usage: { input_tokens: number; output_tokens: number }
  }
  return {
    content: d.content[0]?.text ?? '',
    promptTokens: d.usage?.input_tokens ?? 0,
    completionTokens: d.usage?.output_tokens ?? 0
  }
}

async function callOpenAI(
  systemPrompt: string, userPrompt: string, apiKey: string
): Promise<{ content: string; promptTokens: number; completionTokens: number }> {
  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      max_tokens: 1200,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt + '\nRespond ONLY with valid JSON.' },
        { role: 'user', content: userPrompt }
      ]
    })
  })
  if (!resp.ok) throw new Error(`OpenAI ${resp.status}: ${await resp.text()}`)
  const d = await resp.json() as {
    choices: Array<{ message: { content: string } }>;
    usage: { prompt_tokens: number; completion_tokens: number }
  }
  return {
    content: d.choices[0]?.message?.content ?? '',
    promptTokens: d.usage?.prompt_tokens ?? 0,
    completionTokens: d.usage?.completion_tokens ?? 0
  }
}

// ================================================================
// LOGGING
// ================================================================

async function logTokenUsage(
  db: D1Database, req: AIRequest,
  model: string, promptTokens: number, completionTokens: number, costUsd: number
): Promise<void> {
  const period = getPeriodStart()
  await db.prepare(`
    INSERT INTO token_usage (id, user_id, request_type, model_used, prompt_tokens, completion_tokens, total_tokens, cost_usd, period_start, agent_name, intent_type)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    genId('tu'), req.userId, req.requestType, model,
    promptTokens, completionTokens, promptTokens + completionTokens,
    costUsd, period, req.agentName ?? null, req.intentType ?? null
  ).run().catch(e => console.error('[TokenLog]', e))

  // Update cost in ledger
  await db.prepare(`
    UPDATE token_ledger SET cost_usd = cost_usd + ?, updated_at = datetime('now')
    WHERE user_id = ? AND period_start = ?
  `).bind(costUsd, req.userId, period).run().catch(e => console.error('[LedgerUpdate]', e))
}

async function logRequest(db: D1Database, req: AIRequest, tokensUsed: number, status: string): Promise<void> {
  await db.prepare(`
    INSERT INTO request_log (id, user_id, request_type, endpoint, ip_address, user_agent, tokens_used, status, fingerprint)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    genId('rl'), req.userId, req.requestType,
    req.intentType ?? req.requestType,
    req.ipAddress ?? null, req.userAgent ?? null,
    tokensUsed, status,
    req.cacheKey ?? null
  ).run().catch(e => console.error('[ReqLog]', e))
}

// ================================================================
// PROFIT TRACKING
// ================================================================

async function updateProfitTracking(db: D1Database, userId: string, costUsd: number): Promise<void> {
  if (costUsd === 0) return

  const period = getPeriodStart()

  // Get revenue for this period
  const sub = await db.prepare(`
    SELECT p.price_monthly, p.name FROM subscriptions s
    JOIN plans p ON p.id = s.plan_id
    WHERE s.user_id = ? AND s.status = 'active'
  `).bind(userId).first<{ price_monthly: number; name: string }>()

  const monthlyRevenue = sub?.price_monthly ?? 0
  const planName = sub?.name ?? 'free'

  await db.prepare(`
    INSERT INTO profit_tracking (id, user_id, period_start, plan_name, revenue_usd, cost_usd, tokens_used, request_count)
    VALUES (?, ?, ?, ?, ?, ?, 0, 1)
    ON CONFLICT(user_id, period_start) DO UPDATE SET
      cost_usd = cost_usd + ?,
      request_count = request_count + 1,
      updated_at = datetime('now')
  `).bind(
    genId('pt'), userId, period, planName, monthlyRevenue, costUsd, costUsd
  ).run().catch(e => console.error('[ProfitTrack]', e))
}

// ================================================================
// TOKEN STATUS + HELPERS
// ================================================================

export async function ensureTokenLedger(userId: string, db: D1Database): Promise<void> {
  const period = getPeriodStart()
  const periodEnd = getPeriodEnd()

  const sub = await db.prepare(`
    SELECT p.monthly_tokens, p.name FROM subscriptions s
    JOIN plans p ON p.id = s.plan_id
    WHERE s.user_id = ? AND s.status = 'active' LIMIT 1
  `).bind(userId).first<{ monthly_tokens: number; name: string }>()

  const tokens = sub?.monthly_tokens ?? 10000

  await db.prepare(`
    INSERT OR IGNORE INTO token_ledger (id, user_id, period_start, period_end, tokens_granted, tokens_used, cost_usd)
    VALUES (?, ?, ?, ?, ?, 0, 0)
  `).bind(`ledger-${userId}-${period}`, userId, period, periodEnd, tokens).run()
}

export async function getTokenStatus(userId: string, db: D1Database) {
  const period = getPeriodStart()
  const today = getToday()
  await ensureTokenLedger(userId, db)

  const [ledger, daily] = await Promise.all([
    db.prepare(`
      SELECT tl.tokens_granted, tl.tokens_used, tl.cost_usd,
             p.name as plan_name, p.display_name, p.monthly_tokens,
             p.daily_tokens, p.has_chat, p.has_analytics, p.has_scheduling,
             p.has_advanced_agents, p.price_monthly
      FROM token_ledger tl
      JOIN subscriptions s ON s.user_id = tl.user_id
      JOIN plans p ON p.id = s.plan_id
      WHERE tl.user_id = ? AND tl.period_start = ? AND s.status = 'active'
    `).bind(userId, period).first(),
    db.prepare(`SELECT tokens_used, request_count FROM daily_token_usage WHERE user_id = ? AND date = ?`)
      .bind(userId, today).first<{ tokens_used: number; request_count: number }>()
  ])

  if (!ledger) {
    return {
      tokensGranted: 10000, tokensUsed: 0, tokensRemaining: 10000,
      planName: 'free', displayName: 'Free', percentage: 0,
      hasChat: true, hasAnalytics: false, hasScheduling: false,
      dailyUsed: 0, dailyLimit: 2000, dailyRemaining: 2000,
      costUsd: 0, priceMonthly: 0, periodStart: period
    }
  }

  const l = ledger as Record<string, unknown>
  const granted = (l.tokens_granted as number) ?? 10000
  const used = (l.tokens_used as number) ?? 0
  const dailyLimit = (l.daily_tokens as number) ?? 2000
  const dailyUsed = daily?.tokens_used ?? 0

  return {
    tokensGranted: granted,
    tokensUsed: used,
    tokensRemaining: Math.max(0, granted - used),
    costUsd: (l.cost_usd as number) ?? 0,
    planName: l.plan_name as string ?? 'free',
    displayName: l.display_name as string ?? 'Free',
    priceMonthly: (l.price_monthly as number) ?? 0,
    percentage: Math.min(100, Math.round((used / granted) * 100)),
    hasChat: Boolean(l.has_chat),
    hasAnalytics: Boolean(l.has_analytics),
    hasScheduling: Boolean(l.has_scheduling),
    hasAdvancedAgents: Boolean(l.has_advanced_agents),
    dailyUsed, dailyLimit,
    dailyRemaining: Math.max(0, dailyLimit - dailyUsed),
    dailyPercentage: Math.min(100, Math.round((dailyUsed / dailyLimit) * 100)),
    periodStart: period,
    requestsToday: daily?.request_count ?? 0
  }
}

// ================================================================
// ADMIN: PROFIT DASHBOARD DATA
// ================================================================

export async function getAdminProfitData(db: D1Database) {
  const period = getPeriodStart()

  const [summary, perUser, featureBreakdown, highCostUsers] = await Promise.all([
    // Platform-wide summary
    db.prepare(`
      SELECT
        SUM(tl.cost_usd) as total_cost,
        COUNT(DISTINCT tl.user_id) as total_users,
        SUM(tl.tokens_used) as total_tokens,
        SUM(CASE WHEN p.price_monthly > 0 THEN p.price_monthly ELSE 0 END) as total_revenue
      FROM token_ledger tl
      JOIN subscriptions s ON s.user_id = tl.user_id
      JOIN plans p ON p.id = s.plan_id
      WHERE tl.period_start = ? AND s.status = 'active'
    `).bind(period).first(),

    // Per-user profitability (top 20)
    db.prepare(`
      SELECT u.email, u.name, p.name as plan_name, p.price_monthly,
             tl.tokens_used, tl.cost_usd,
             (p.price_monthly - tl.cost_usd) as profit,
             CASE WHEN p.price_monthly > tl.cost_usd THEN 1 ELSE 0 END as is_profitable
      FROM token_ledger tl
      JOIN users u ON u.id = tl.user_id
      JOIN subscriptions s ON s.user_id = tl.user_id
      JOIN plans p ON p.id = s.plan_id
      WHERE tl.period_start = ? AND s.status = 'active'
      ORDER BY tl.cost_usd DESC
      LIMIT 20
    `).bind(period).all(),

    // Feature cost breakdown
    db.prepare(`
      SELECT request_type, model_used,
             COUNT(*) as requests,
             SUM(total_tokens) as tokens,
             SUM(cost_usd) as cost
      FROM token_usage
      WHERE period_start = ?
      GROUP BY request_type, model_used
      ORDER BY cost DESC
    `).bind(period).all(),

    // High-cost users (unprofitable)
    db.prepare(`
      SELECT u.email, p.name as plan_name, p.price_monthly,
             tl.tokens_used, tl.cost_usd,
             (tl.cost_usd - p.price_monthly) as loss
      FROM token_ledger tl
      JOIN users u ON u.id = tl.user_id
      JOIN subscriptions s ON s.user_id = tl.user_id
      JOIN plans p ON p.id = s.plan_id
      WHERE tl.period_start = ? AND tl.cost_usd > p.price_monthly
      ORDER BY loss DESC
      LIMIT 10
    `).bind(period).all()
  ])

  const s = summary as Record<string, number>
  const totalRevenue = s?.total_revenue ?? 0
  const totalCost = s?.total_cost ?? 0
  const totalProfit = totalRevenue - totalCost
  const margin = totalRevenue > 0 ? Math.round((totalProfit / totalRevenue) * 100) : 0

  return {
    period,
    summary: {
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalCost: Math.round(totalCost * 10000) / 10000,
      totalProfit: Math.round(totalProfit * 100) / 100,
      profitMargin: margin,
      totalUsers: (s?.total_users as number) ?? 0,
      totalTokens: (s?.total_tokens as number) ?? 0
    },
    perUser: perUser.results,
    featureBreakdown: featureBreakdown.results,
    highCostAlerts: highCostUsers.results
  }
}

// ================================================================
// ABUSE MONITORING: get flagged users
// ================================================================

export async function getAbuseFlags(db: D1Database) {
  const flags = await db.prepare(`
    SELECT af.*, u.email, u.name
    FROM abuse_flags af
    JOIN users u ON u.id = af.user_id
    WHERE af.auto_resolved = 0
    ORDER BY af.created_at DESC
    LIMIT 50
  `).all()

  return flags.results
}

// ================================================================
// UTILITIES
// ================================================================

function getPeriodStart(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

function getPeriodEnd(): string {
  const d = new Date()
  d.setMonth(d.getMonth() + 1, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

function getToday(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function computeCost(model: string, input: number, output: number): number {
  const costs = MODEL_COSTS[model]
  if (!costs) return 0
  return (input / 1000) * costs.input + (output / 1000) * costs.output
}

function buildBlockedResponse(usage: TokenUsageResult): AIResponse {
  return {
    content: JSON.stringify({ error: 'BLOCKED', message: usage.reason ?? 'Request blocked', suggestUpgrade: true }),
    modelUsed: 'blocked',
    promptTokens: 0, completionTokens: 0, totalTokens: 0,
    costUsd: 0, isDemo: false, fromCache: false,
    tokenUsageResult: usage
  }
}

function buildDeniedResult(req: AIRequest, reason?: string): TokenUsageResult {
  return {
    allowed: false, reason: reason ?? 'Request denied',
    tokensUsed: 0, tokensRemaining: 0, costUsd: 0,
    modelUsed: 'blocked', planName: 'unknown'
  }
}

// ================================================================
// TOKEN MILESTONE DETECTION
// Returns which milestone bracket the user just crossed (if any).
// Called after token deduction so the frontend can fire a trigger.
// ================================================================
export function detectTokenMilestone(
  usedBefore: number,
  usedAfter: number,
  granted: number
): 'token_50' | 'token_80' | 'token_100' | null {
  if (granted === 0) return null
  const pctBefore = (usedBefore / granted) * 100
  const pctAfter  = (usedAfter  / granted) * 100

  if (pctBefore < 100 && pctAfter >= 100) return 'token_100'
  if (pctBefore < 80  && pctAfter >= 80)  return 'token_80'
  if (pctBefore < 50  && pctAfter >= 50)  return 'token_50'
  return null
}
