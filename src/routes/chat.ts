// ================================================================
// CHAT ROUTE — /api/chat
// ================================================================
// Platform-owned AI chat. Tokens are deducted per message.
// Users never see or provide API keys.
// ================================================================

import { Hono } from 'hono'
import type { Env } from '../lib/platform'
import { requireAuth } from '../lib/auth'
import { callPlatformAI } from '../lib/platform'
import { ProfileStore, genId } from '../lib/store'

const router = new Hono<{ Bindings: Env }>()

const CHAT_SYSTEM_PROMPT = `You are IntentIQ Assistant — an expert e-commerce business advisor integrated into the IntentIQ OS platform.

YOUR ROLE:
- Help users understand their business data and AI-generated intents
- Answer questions about their e-commerce strategy
- Explain what actions they should take based on the platform's recommendations
- Provide concise, actionable business advice

RULES:
- Keep responses short and action-focused (2-4 sentences usually)
- Always relate advice to the user's specific niche and context
- Never promise specific revenue outcomes — say "could" or "may"
- Remind users that all major actions go through the Intent Layer with human approval
- If asked about API keys or AI models, say "IntentIQ handles all AI infrastructure for you"

TONE: Professional, friendly, direct. Think smart business advisor, not corporate consultant.`

// POST /api/chat/message
router.post('/message', requireAuth, async (c) => {
  const userId = c.get('userId') as string

  let body: { message?: string; history?: Array<{ role: string; content: string }> }
  try { body = await c.req.json() } catch { return c.json({ success: false, error: 'Invalid JSON' }, 400) }

  const { message, history = [] } = body
  if (!message?.trim()) return c.json({ success: false, error: 'message is required' }, 400)
  if (message.length > 1000) return c.json({ success: false, error: 'Message too long (max 1000 chars)' }, 400)

  // Build context from profile
  const profile = ProfileStore.get()
  const contextNote = `User's business: ${profile.businessName} (${profile.niche}), platform: ${profile.platform}, team: ${profile.teamSize}`

  // Build conversation prompt
  const conversationLines = history.slice(-6).map((m: { role: string; content: string }) =>
    `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`
  ).join('\n')

  const userPrompt = conversationLines
    ? `${contextNote}\n\nConversation so far:\n${conversationLines}\n\nUser: ${message}`
    : `${contextNote}\n\nUser: ${message}`

  // Call platform AI (handles token tracking)
  const aiResp = await callPlatformAI({
    userId,
    requestType: 'chat_message',
    systemPrompt: CHAT_SYSTEM_PROMPT,
    userPrompt,
    preferredModel: 'claude'
  }, c.env as Env)

  // If blocked
  if (!aiResp.tokenUsageResult.allowed) {
    return c.json({
      success: false,
      error: aiResp.tokenUsageResult.reason,
      upgradeRequired: true,
      timestamp: new Date().toISOString()
    }, 429)
  }

  // Generate response
  let reply = aiResp.content
  if (!reply || aiResp.isDemo) {
    reply = getDemoReply(message, profile)
  }

  // Save to DB if available
  if (c.env?.DB) {
    const db = c.env.DB
    await db.prepare(`INSERT INTO chat_messages (id, user_id, role, content, tokens_used, model_used) VALUES (?, ?, 'user', ?, 0, ?)`)
      .bind(genId('chat'), userId, message, aiResp.modelUsed).run()
    await db.prepare(`INSERT INTO chat_messages (id, user_id, role, content, tokens_used, model_used) VALUES (?, ?, 'assistant', ?, ?, ?)`)
      .bind(genId('chat'), userId, reply, aiResp.totalTokens, aiResp.modelUsed).run()
  }

  return c.json({
    success: true,
    data: {
      reply,
      tokensUsed: aiResp.tokenUsageResult.tokensUsed,
      tokensRemaining: aiResp.tokenUsageResult.tokensRemaining,
      modelUsed: aiResp.modelUsed,
      isDemo: aiResp.isDemo
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
  const { getTokenStatus } = await import('../lib/platform')

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

// ── Demo replies (when no API key) ────────────────────────────────
function getDemoReply(message: string, profile: { niche: string; businessName: string }): string {
  const m = message.toLowerCase()
  const niche = profile.niche

  if (m.includes('revenue') || m.includes('sales')) {
    return `Based on your ${niche} business trends, focusing on your top-performing products and running a targeted email campaign could lift revenue 10-15% this month. Check your Pricing Agent intents for specific recommendations — all require your approval before any changes.`
  }
  if (m.includes('inventory') || m.includes('stock')) {
    return `Your Inventory Agent monitors stock levels daily and flags restock needs before you run out. Review the pending inventory intents in your queue — they include specific reorder quantities and timing based on your sales velocity.`
  }
  if (m.includes('email') || m.includes('marketing') || m.includes('campaign')) {
    return `Your Email Marketing Agent can generate campaign drafts, abandoned cart sequences, and re-engagement flows. Generate an Email Campaign intent to get a full strategy — it'll be ready for your review before anything is sent.`
  }
  if (m.includes('price') || m.includes('pricing')) {
    return `Pricing optimization is one of the fastest ways to improve margins. Your Pricing Agent analyzes competitive positioning weekly — check the latest pricing intent for recommended adjustments with revenue impact estimates.`
  }
  if (m.includes('hello') || m.includes('hi') || m.includes('help')) {
    return `Hi! I'm your IntentIQ Assistant. I can help you understand your AI recommendations, explain your business data, or guide you on next steps. What would you like to work on for your ${niche} business today?`
  }
  return `Great question about your ${niche} business! For the most accurate insight, generate a relevant intent from your AI agents — they'll give you a detailed analysis with suggested steps. All recommendations require your approval. What specific area would you like to explore?`
}

export default router
