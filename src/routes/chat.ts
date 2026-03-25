// ================================================================
// CHAT ROUTE — /api/chat
// ================================================================
// Platform-owned AI chat. Tokens are deducted per message.
// Users never see or provide API keys.
// Upgrade suggestions are natural, not spam — max once per session.
// ================================================================

import { Hono } from 'hono'
import type { Env } from '../lib/platform'
import { requireAuth } from '../lib/auth'
import { callPlatformAI, getTokenStatus } from '../lib/platform'
import { ProfileStore, genId } from '../lib/store'
import { logBehavior } from '../lib/conversion'

const router = new Hono<{ Bindings: Env }>()

// ── System prompt with upgrade awareness (never pushy) ────────────
const CHAT_SYSTEM_PROMPT = `You are IntentIQ Assistant — an expert e-commerce business advisor integrated into the IntentIQ OS platform.

YOUR ROLE:
- Help users understand their business data and AI-generated intents
- Answer questions about their e-commerce strategy
- Explain what actions they should take based on the platform's recommendations
- Provide concise, actionable business advice
- When users are growing or succeeding, naturally suggest how higher-tier features could amplify that success

UPGRADE GUIDANCE (follow these rules carefully):
- On free plan + token usage >70%: naturally mention they are approaching their limit ONCE per conversation
- On free plan + asking about scheduling/automation: "That's available on Starter ($10/mo) — it runs agents on autopilot so you don't have to trigger them manually"
- On free plan + asking about market research: "Market Research Agent is a Starter feature — it spots competitor pricing shifts and trends automatically"
- On starter plan + asking about advanced strategy: "The Strategy Agent (Pro, $30/mo) gives you full business intelligence — worth it if you're scaling"
- After user approves multiple intents: "You're acting on recommendations quickly — scheduling would automate this so you wake up to fresh insights daily"
- NEVER mention upgrades more than once per conversation
- NEVER make upgrade the focus — weave it in naturally when it solves their actual problem
- Use conversational language: "btw, that's a Starter feature" NOT "Please upgrade immediately"
- If user just mentioned a problem, solve it first — then optionally mention if a higher plan would help more

PERSONALIZATION:
- Always use the user's niche when giving advice (hair products, clothing, electronics, etc.)
- Reference their specific business context from the profile
- If they run a high-volume business, mention Scale tier benefits if relevant

RULES:
- Keep responses short and action-focused (2-4 sentences usually)
- Never promise specific revenue outcomes — say "could" or "may"
- Remind users that all major actions go through the Intent Layer with human approval
- If asked about API keys or AI models: "IntentIQ handles all AI infrastructure — you never need to worry about that"

TONE: Like a smart friend who knows e-commerce deeply. Direct, warm, practical.`

// POST /api/chat/message
router.post('/message', requireAuth, async (c) => {
  const userId = c.get('userId') as string

  let body: {
    message?: string
    history?: Array<{ role: string; content: string }>
    sessionUpgradeMentioned?: boolean   // frontend tracks if upgrade was mentioned this session
  }
  try { body = await c.req.json() } catch { return c.json({ success: false, error: 'Invalid JSON' }, 400) }

  const { message, history = [], sessionUpgradeMentioned = false } = body
  if (!message?.trim()) return c.json({ success: false, error: 'message is required' }, 400)
  if (message.length > 1000) return c.json({ success: false, error: 'Message too long (max 1000 chars)' }, 400)

  // Build context from profile
  const profile = ProfileStore.get()
  const contextNote = `User's business: ${profile.businessName} (${profile.niche}), platform: ${profile.platform}, team: ${profile.teamSize}`

  // Get token status for upgrade awareness
  let tokenPct = 0, planName = 'starter', tokensRemaining = 50000
  if (c.env?.DB) {
    const ts = await getTokenStatus(userId, c.env.DB)
    tokenPct = ts.percentage ?? 0
    planName = ts.planName ?? 'starter'
    tokensRemaining = ts.tokensRemaining ?? 50000
  }

  // Add token/plan context to prompt (only if relevant)
  const upgradeContext = buildUpgradeContext(planName, tokenPct, sessionUpgradeMentioned, profile.niche)

  // Build conversation prompt
  const conversationLines = history.slice(-6).map((m: { role: string; content: string }) =>
    `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`
  ).join('\n')

  const userPrompt = [
    contextNote,
    upgradeContext ? `\nContext: ${upgradeContext}` : '',
    conversationLines ? `\nConversation so far:\n${conversationLines}` : '',
    `\nUser: ${message}`
  ].filter(Boolean).join('')

  // Call platform AI (handles token tracking)
  const aiResp = await callPlatformAI({
    userId,
    requestType: 'chat_message',
    systemPrompt: CHAT_SYSTEM_PROMPT,
    userPrompt,
    preferredModel: 'claude'
  }, c.env as Env)

  // If blocked by token limit
  if (!aiResp.tokenUsageResult.allowed) {
    return c.json({
      success: false,
      error: aiResp.tokenUsageResult.reason,
      upgradeRequired: true,
      upgradePrompt: buildUpgradePrompt(planName, 'token_100'),
      timestamp: new Date().toISOString()
    }, 429)
  }

  // Generate response
  let reply = aiResp.content
  if (!reply || aiResp.isDemo) {
    reply = getDemoReply(message, profile, planName, tokenPct, sessionUpgradeMentioned)
  }

  // Detect if this reply contains an upgrade mention
  const replyMentionsUpgrade = /upgrade|starter|pro|plan|token/i.test(reply)

  // Log behavior
  if (c.env?.DB) {
    const db = c.env.DB
    await Promise.all([
      db.prepare(`INSERT INTO chat_messages (id, user_id, role, content, tokens_used, model_used) VALUES (?, ?, 'user', ?, 0, ?)`)
        .bind(genId('chat'), userId, message, aiResp.modelUsed).run(),
      db.prepare(`INSERT INTO chat_messages (id, user_id, role, content, tokens_used, model_used) VALUES (?, ?, 'assistant', ?, ?, ?)`)
        .bind(genId('chat'), userId, reply, aiResp.totalTokens, aiResp.modelUsed).run(),
      logBehavior(db, userId, 'chat_used', { messageLength: message.length, planName, tokenPct })
    ])
  }

  return c.json({
    success: true,
    data: {
      reply,
      tokensUsed: aiResp.tokenUsageResult.tokensUsed,
      tokensRemaining: aiResp.tokenUsageResult.tokensRemaining,
      modelUsed: aiResp.modelUsed,
      isDemo: aiResp.isDemo,
      sessionUpgradeMentioned: sessionUpgradeMentioned || replyMentionsUpgrade
    },
    timestamp: new Date().toISOString()
  })
})

// GET /api/chat/history
router.get('/history', requireAuth, async (c) => {
  const userId = c.get('userId') as string
  const db = c.env?.DB

  if (!db) {
    return c.json({ success: true, data: [], timestamp: new Date().toISOString() })
  }

  const messages = await db.prepare(`
    SELECT id, role, content, tokens_used, model_used, created_at
    FROM chat_messages WHERE user_id = ? ORDER BY created_at DESC LIMIT 50
  `).bind(userId).all()

  return c.json({ success: true, data: messages.results.reverse(), timestamp: new Date().toISOString() })
})

// GET /api/chat/tokens — check token status
router.get('/tokens', requireAuth, async (c) => {
  const userId = c.get('userId') as string

  if (!c.env?.DB) {
    return c.json({
      success: true,
      data: { tokensGranted: 50000, tokensUsed: 0, tokensRemaining: 50000, planName: 'starter', percentage: 0, hasChat: true },
      timestamp: new Date().toISOString()
    })
  }

  const status = await getTokenStatus(userId, c.env.DB)
  return c.json({ success: true, data: status, timestamp: new Date().toISOString() })
})

// ── Build upgrade context string (added to prompt when relevant) ──
function buildUpgradeContext(planName: string, tokenPct: number, alreadyMentioned: boolean, niche?: string): string {
  if (alreadyMentioned) return ''  // Never mention twice in one session
  if (planName === 'scale') return ''  // Never nudge top-tier users

  const nicheHint = niche ? ` For a ${niche} business, ` : ' '

  if (tokenPct >= 95 && planName !== 'scale') {
    return `IMPORTANT: User has used ${tokenPct}% of their ${planName} plan tokens — they will hit the limit very soon. Naturally mention this once and suggest upgrading.`
  }
  if (tokenPct >= 80) {
    return `User is on ${planName} plan with ${tokenPct}% tokens used.${nicheHint}If it fits naturally in your response, briefly mention they're close to their limit.`
  }
  if (tokenPct >= 50 && planName === 'free') {
    return `User is on free plan with ${tokenPct}% tokens used. They're growing — if scheduling or market research comes up, it's okay to mention Starter naturally.`
  }
  return ''
}

// ── Build structured upgrade prompt for hard blocks ───────────────
function buildUpgradePrompt(planName: string, reason: string): {
  headline: string; body: string; cta: string
} {
  const nextPlan = planName === 'free' ? 'Starter' : planName === 'starter' ? 'Pro' : 'Scale'
  const price = planName === 'free' ? '$10' : planName === 'starter' ? '$30' : '$100'
  return {
    headline: `Monthly AI limit reached`,
    body: `Your ${planName} plan tokens are used up for this month. Upgrade to ${nextPlan} (${price}/mo) to keep chatting and generating insights.`,
    cta: `Upgrade to ${nextPlan}`
  }
}

// ── Demo replies (when no API key) ────────────────────────────────
function getDemoReply(
  message: string,
  profile: { niche: string; businessName: string },
  planName: string,
  tokenPct: number,
  sessionUpgradeMentioned: boolean
): string {
  const m = message.toLowerCase()
  const niche = profile.niche
  const bizName = profile.businessName || 'your business'

  // Natural upgrade nudge — only when relevant and not already mentioned
  const canNudge = !sessionUpgradeMentioned && planName !== 'scale'
  const tokenNudge = canNudge && planName === 'free' && tokenPct >= 70
    ? ` Btw, you're at ${tokenPct}% of your free tokens — Starter ($10/mo) gives 120× more plus automated scheduling.`
    : ''

  if (m.includes('revenue') || m.includes('sales')) {
    return `For ${niche} businesses like ${bizName}, focusing on top-performing SKUs and running a re-engagement email sequence could lift revenue 10-20% this month. Your Pricing Agent's intents have specific margin recommendations ready for your review.${tokenNudge}`
  }
  if (m.includes('inventory') || m.includes('stock') || m.includes('restock')) {
    return `Your Inventory Agent tracks stock velocity and flags restock needs before you run low. Check your pending inventory intents — they include specific reorder quantities and timing optimized for your ${niche} sales patterns.`
  }
  if (m.includes('email') || m.includes('marketing') || m.includes('campaign')) {
    return `For ${niche}, abandoned cart sequences and re-engagement flows typically convert at 8-15%. Your Email Marketing Agent can draft complete campaign strategies — all need your approval before anything goes out.${tokenNudge}`
  }
  if (m.includes('price') || m.includes('pricing') || m.includes('margin')) {
    return `Pricing is the fastest lever for margin improvement. Your Pricing Agent analyzes competitor positioning weekly — the latest intent has specific price point recommendations with projected revenue impact. Review it when you're ready.`
  }
  if (m.includes('schedule') || m.includes('automat') || m.includes('recurring')) {
    if (['free'].includes(planName) && canNudge) {
      return `Automated scheduling is a game-changer for ${niche} businesses — your agents run analysis daily and surface insights without you having to trigger anything manually. That's a Starter feature ($10/mo). It's probably the highest-ROI upgrade you can make.`
    }
    return `Your Schedule Manager runs agents on autopilot. Set up recurring tasks (daily market checks, weekly health reviews) and you'll wake up to fresh intents ready for your approval — no manual triggers needed.`
  }
  if (m.includes('market') || m.includes('competitor') || m.includes('trend')) {
    if (planName === 'free' && canNudge) {
      return `Market Research Agent spots competitor pricing shifts, trending products, and demand signals in your ${niche}. It's a Starter feature ($10/mo) — worth it if you want to stay ahead of what's moving in your category.`
    }
    return `Your Market Research Agent tracks ${niche} trends and competitive positioning. Check the latest market trend intents — they'll tell you what's gaining momentum and where the pricing opportunities are.`
  }
  if (m.includes('strategy') || m.includes('growth') || m.includes('scale')) {
    if (['free', 'starter'].includes(planName) && canNudge) {
      return `For scaling ${niche} businesses, the Strategy Agent on Pro ($30/mo) builds full growth plans — revenue expansion, marketing calendar, product roadmap. It pairs with all your other agents for complete business intelligence.`
    }
    return `Your Strategy Agent is your growth planner — it synthesizes signals across all agents to build prioritized growth recommendations. Generate a strategic_plan intent to get a full 30/60/90-day roadmap ready for your review.`
  }
  if (m.includes('hello') || m.includes('hi ') || m.includes('help') || m === 'hi') {
    return `Hey! I'm your IntentIQ Assistant — here to help you get the most from your AI agents and business data. What's on your mind today for ${bizName}?`
  }
  if (m.includes('token') || m.includes('limit') || m.includes('quota')) {
    const nextPlan = planName === 'free' ? 'Starter ($10/mo, 1.2M tokens)' : planName === 'starter' ? 'Pro ($30/mo, 3.6M tokens)' : 'Scale ($100/mo, 12M tokens)'
    return `You're at ${tokenPct}% of your ${planName} plan tokens for this month. Each intent generation uses ~2,000 tokens, chat messages ~500. If you're hitting limits, ${nextPlan} is the next tier — check the Usage page for details.`
  }
  return `Good question for ${bizName}! Your AI agents have specific insights on that — generate a relevant intent and they'll give you a detailed analysis with suggested steps. Everything needs your approval before anything changes.`
}

export default router
