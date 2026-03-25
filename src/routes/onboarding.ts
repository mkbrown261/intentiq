// ================================================================
// ONBOARDING ROUTE — /api/onboarding
// ================================================================
// Collects: business type, store info, goals
// Then auto-generates first AI intent to wow the user.
// ================================================================

import { Hono } from 'hono'
import type { Env } from '../lib/platform'
import { requireAuth } from '../lib/auth'
import { runAgent } from '../lib/agents'
import { ProfileStore, IntentStore, AgentStore, AgentLogStore, genId } from '../lib/store'
import type { BusinessProfile } from '../types/core'

const router = new Hono<{ Bindings: Env }>()

// GET /api/onboarding/status
router.get('/status', requireAuth, async (c) => {
  const userId = c.get('userId') as string
  const db = c.env?.DB

  if (!db) {
    const profile = ProfileStore.get()
    return c.json({
      success: true,
      data: {
        step: profile.niche !== 'e-commerce' ? 5 : 0,
        isComplete: profile.niche !== 'e-commerce',
        profile
      },
      timestamp: new Date().toISOString()
    })
  }

  const bp = await db.prepare('SELECT * FROM business_profiles WHERE user_id = ?').bind(userId).first<{
    onboarding_step: number; business_name: string; niche: string
  }>()

  return c.json({
    success: true,
    data: {
      step: bp?.onboarding_step ?? 0,
      isComplete: (bp?.onboarding_step ?? 0) >= 5,
      businessName: bp?.business_name,
      niche: bp?.niche
    },
    timestamp: new Date().toISOString()
  })
})

// POST /api/onboarding/complete
// Body: { businessName, niche, platform, goals, monthlyRevenue, teamSize, focusCategories, topProducts }
router.post('/complete', requireAuth, async (c) => {
  const userId = c.get('userId') as string
  const db = c.env?.DB

  let body: Record<string, unknown>
  try { body = await c.req.json() } catch { return c.json({ success: false, error: 'Invalid JSON' }, 400) }

  const {
    businessName, niche, platform, goals,
    monthlyRevenue, teamSize, focusCategories, topProducts,
    pricingStyle, riskTolerance, subNiche
  } = body as {
    businessName: string; niche: string; platform: string; goals: string[];
    monthlyRevenue: number; teamSize: string; focusCategories: string[];
    topProducts: string[]; pricingStyle: string; riskTolerance: string; subNiche: string
  }

  if (!businessName || !niche) {
    return c.json({ success: false, error: 'businessName and niche are required' }, 400)
  }

  // Update profile
  if (db) {
    await db.prepare(`
      UPDATE business_profiles SET
        business_name = ?, niche = ?, sub_niche = ?, platform = ?,
        pricing_style = ?, risk_tolerance = ?, monthly_revenue = ?,
        team_size = ?, focus_categories = ?, top_products = ?,
        goals = ?, onboarding_step = 5, updated_at = datetime('now')
      WHERE user_id = ?
    `).bind(
      businessName, niche, subNiche ?? '', platform ?? 'shopify',
      pricingStyle ?? 'moderate', riskTolerance ?? 'balanced',
      monthlyRevenue ?? 0, teamSize ?? 'solo',
      JSON.stringify(focusCategories ?? []),
      JSON.stringify(topProducts ?? []),
      JSON.stringify(goals ?? []),
      userId
    ).run()

    await db.prepare("UPDATE users SET onboarding_complete = 1, updated_at = datetime('now') WHERE id = ?")
      .bind(userId).run()
  } else {
    // In-memory store
    ProfileStore.update({
      businessName: businessName as string,
      niche: niche as string,
      subNiche: subNiche as string,
      platform: (platform as BusinessProfile['platform']) ?? 'shopify',
      pricingStyle: (pricingStyle as BusinessProfile['pricingStyle']) ?? 'moderate',
      riskTolerance: (riskTolerance as BusinessProfile['riskTolerance']) ?? 'balanced',
      monthlyRevenue: Number(monthlyRevenue) || 0,
      teamSize: (teamSize as BusinessProfile['teamSize']) ?? 'solo',
      focusCategories: (focusCategories as string[]) ?? [],
      topProducts: (topProducts as string[]) ?? []
    })
  }

  // Auto-generate first intent to wow the user
  let firstIntent = null
  try {
    const profile = db
      ? {
          id: userId, businessName: businessName as string,
          niche: niche as string, subNiche: subNiche as string,
          platform: (platform as BusinessProfile['platform']) ?? 'shopify',
          pricingStyle: (pricingStyle as BusinessProfile['pricingStyle']) ?? 'moderate',
          riskTolerance: (riskTolerance as BusinessProfile['riskTolerance']) ?? 'balanced',
          monthlyRevenue: Number(monthlyRevenue) || 0,
          monthlyBudget: 5000,
          teamSize: (teamSize as BusinessProfile['teamSize']) ?? 'solo',
          focusCategories: (focusCategories as string[]) ?? [],
          topProducts: (topProducts as string[]) ?? [],
          preferredAI: 'hybrid' as const,
          autoRejectHighRisk: false, notifyUrgent: true,
          approvalPatterns: [], ownerName: '',
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
        }
      : ProfileStore.get()

    // Run the business health agent for first intent
    firstIntent = await runAgent('BusinessHealthAgent', 'business_health', {
      isOnboarding: true,
      businessName: profile.businessName,
      niche: profile.niche,
      goals: goals ?? []
    }, c.env as Env)

    if (firstIntent) {
      IntentStore.save(firstIntent)
      AgentStore.incrementIntents('BusinessHealthAgent')
      AgentLogStore.push({
        id: genId('log'),
        agentName: 'BusinessHealthAgent',
        action: 'onboarding_first_intent',
        intentId: firstIntent.id,
        status: 'success',
        message: `Generated first intent for new user: ${businessName}`,
        timestamp: new Date().toISOString()
      })
    }
  } catch (err) {
    console.error('[Onboarding] First intent generation error:', err)
  }

  return c.json({
    success: true,
    data: {
      message: `Welcome to IntentIQ, ${businessName}! Your AI team is ready.`,
      onboardingComplete: true,
      firstIntent
    },
    timestamp: new Date().toISOString()
  })
})

export default router
