// ============================================================
// AI SERVICE — Intent Generation Engine
// ============================================================
// This module calls Anthropic (Claude) and OpenAI APIs to
// generate INTENTS only. It NEVER executes any action.
//
// ALL outputs flow through the Intent Layer.
// The Action Layer is NEVER touched here.
// ============================================================

import type {
  Intent,
  IntentType,
  RiskLevel,
  SuggestedAction,
  GuidanceBlock,
  UserProfile
} from '../types/intent'
import {
  buildSystemPrompt,
  getPromptForIntent,
  resolveModel
} from './aiRouter'

// ============================================================
// TYPE BINDINGS (Cloudflare Workers env)
// ============================================================

export interface Env {
  ANTHROPIC_API_KEY?: string
  OPENAI_API_KEY?: string
}

// ============================================================
// INTENT BUILDER HELPERS
// ============================================================

function generateId(): string {
  return `intent-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

function normalizePriority(riskLevel: RiskLevel, intentType: IntentType): number {
  const riskMap: Record<RiskLevel, number> = { high: 1, medium: 2, low: 3 }
  const urgentTypes: IntentType[] = ['restock_alert', 'opportunity_alert', 'competitor_scan']
  const base = riskMap[riskLevel] ?? 3
  return urgentTypes.includes(intentType) ? Math.max(1, base - 1) : base
}

// ============================================================
// RESPONSE PARSER
// ============================================================
// Parses the raw AI JSON response into a structured Intent.
// Falls back gracefully if the model returns malformed JSON.
// ============================================================

function parseAIResponse(
  raw: string,
  intentType: IntentType,
  model: 'claude' | 'openai'
): Omit<Intent, 'id' | 'metadata'> {
  let parsed: Record<string, unknown>

  try {
    // Extract JSON block if wrapped in markdown
    const jsonMatch = raw.match(/```json\n?([\s\S]*?)\n?```/) ?? raw.match(/(\{[\s\S]*\})/)
    const jsonStr = jsonMatch ? jsonMatch[1] ?? jsonMatch[0] : raw
    parsed = JSON.parse(jsonStr)
  } catch {
    // Fallback intent if JSON parsing fails
    return {
      type: intentType,
      summary: 'AI analysis completed — review details below',
      detailedBreakdown: raw.substring(0, 1000),
      suggestedActions: [
        {
          label: 'Review Analysis',
          description: 'Read the AI output and determine next steps manually',
          estimatedImpact: 'Varies',
          reversible: true
        }
      ],
      riskLevel: 'medium',
      requiresApproval: true,
      status: 'pending',
      guidance: {
        whyThisMatters: 'AI generated an analysis that requires your review',
        whatToDoNext: 'Read through the breakdown and approve, reject, or modify',
        expectedOutcome: 'Clearer understanding of your business position'
      }
    }
  }

  const suggestedActions: SuggestedAction[] = ((parsed.suggestedActions ?? parsed.suggested_actions ?? []) as Record<string, unknown>[])
    .slice(0, 5)
    .map((a) => ({
      label: String(a.label ?? a.action ?? 'Action'),
      description: String(a.description ?? a.detail ?? ''),
      estimatedImpact: String(a.estimatedImpact ?? a.impact ?? 'Unknown'),
      reversible: Boolean(a.reversible ?? true)
    }))

  const rawGuidance = (parsed.guidance ?? {}) as Record<string, unknown>
  const guidance: GuidanceBlock = {
    whyThisMatters: String(
      rawGuidance.whyThisMatters ??
      rawGuidance.why_this_matters ??
      parsed.why ??
      'This insight affects your business performance'
    ),
    whatToDoNext: String(
      rawGuidance.whatToDoNext ??
      rawGuidance.what_to_do_next ??
      parsed.next_steps ??
      'Review and approve or reject this intent'
    ),
    expectedOutcome: String(
      rawGuidance.expectedOutcome ??
      rawGuidance.expected_outcome ??
      parsed.outcome ??
      'Improved business performance if action is taken'
    )
  }

  const risk = String(parsed.riskLevel ?? parsed.risk_level ?? parsed.risk ?? 'medium').toLowerCase()
  const riskLevel: RiskLevel =
    risk === 'high' ? 'high' : risk === 'low' ? 'low' : 'medium'

  return {
    type: intentType,
    summary: String(parsed.summary ?? parsed.title ?? 'AI Analysis Complete'),
    detailedBreakdown: String(parsed.detailedBreakdown ?? parsed.detailed_breakdown ?? parsed.breakdown ?? parsed.analysis ?? ''),
    suggestedActions: suggestedActions.length > 0 ? suggestedActions : [
      {
        label: 'Review and decide',
        description: 'Evaluate this intent and take manual action if appropriate',
        estimatedImpact: 'Varies based on your decision',
        reversible: true
      }
    ],
    riskLevel,
    requiresApproval: true,
    status: 'pending',
    guidance,
    modificationNote: undefined
  }
}

// ============================================================
// CLAUDE (ANTHROPIC) CALL
// ============================================================

async function callClaude(
  systemPrompt: string,
  userPrompt: string,
  apiKey: string
): Promise<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 2000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }]
    })
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Anthropic API error ${response.status}: ${err}`)
  }

  const data = (await response.json()) as {
    content: Array<{ type: string; text: string }>
  }
  return data.content?.[0]?.text ?? ''
}

// ============================================================
// OPENAI CALL
// ============================================================

async function callOpenAI(
  systemPrompt: string,
  userPrompt: string,
  apiKey: string
): Promise<string> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      max_tokens: 2000,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt + '\nAlways respond in valid JSON.' },
        { role: 'user', content: userPrompt }
      ]
    })
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`OpenAI API error ${response.status}: ${err}`)
  }

  const data = (await response.json()) as {
    choices: Array<{ message: { content: string } }>
  }
  return data.choices?.[0]?.message?.content ?? ''
}

// ============================================================
// MAIN INTENT GENERATOR
// ============================================================

export async function generateIntent(
  intentType: IntentType,
  context: Record<string, unknown>,
  userProfile: UserProfile,
  env: Env,
  scheduledTaskId?: string
): Promise<Intent> {
  const routedModel = resolveModel(intentType)
  const systemPrompt = buildSystemPrompt(userProfile.niche, userProfile.pricingStyle)
  const userPrompt = getPromptForIntent(intentType, {
    ...context,
    niche: userProfile.niche,
    pricingStyle: userProfile.pricingStyle,
    focusCategories: userProfile.focusCategories,
    businessName: userProfile.businessName
  })

  let rawResponse = ''
  let usedModel: 'claude' | 'openai' = 'claude'

  // ── Try primary model ──────────────────────────────────────
  try {
    if ((routedModel === 'claude' || routedModel === 'hybrid') && env.ANTHROPIC_API_KEY) {
      rawResponse = await callClaude(systemPrompt, userPrompt, env.ANTHROPIC_API_KEY)
      usedModel = 'claude'
    } else if (env.OPENAI_API_KEY) {
      rawResponse = await callOpenAI(systemPrompt, userPrompt, env.OPENAI_API_KEY)
      usedModel = 'openai'
    } else {
      // No API keys — generate a demo intent
      rawResponse = generateDemoIntent(intentType, userProfile)
      usedModel = 'claude'
    }
  } catch (primaryError) {
    // ── Fallback to secondary model ──────────────────────────
    try {
      if (usedModel === 'claude' && env.OPENAI_API_KEY) {
        rawResponse = await callOpenAI(systemPrompt, userPrompt, env.OPENAI_API_KEY)
        usedModel = 'openai'
      } else if (env.ANTHROPIC_API_KEY) {
        rawResponse = await callClaude(systemPrompt, userPrompt, env.ANTHROPIC_API_KEY)
        usedModel = 'claude'
      } else {
        rawResponse = generateDemoIntent(intentType, userProfile)
      }
    } catch {
      rawResponse = generateDemoIntent(intentType, userProfile)
    }
  }

  const partial = parseAIResponse(rawResponse, intentType, usedModel)
  const priority = normalizePriority(partial.riskLevel, intentType)

  const intent: Intent = {
    ...partial,
    id: generateId(),
    metadata: {
      generatedBy: usedModel,
      generatedAt: new Date().toISOString(),
      scheduledTaskId,
      priority,
      category: getCategoryLabel(intentType),
      tags: getTagsForIntent(intentType, userProfile.niche),
      estimatedValue: extractEstimatedValue(partial.detailedBreakdown)
    }
  }

  return intent
}

// ============================================================
// DEMO INTENT GENERATOR (no API keys needed)
// ============================================================

function generateDemoIntent(intentType: IntentType, profile: UserProfile): string {
  const demos: Record<string, object> = {
    market_analysis: {
      summary: `${profile.niche} market showing strong growth — 18% category uptick detected this week`,
      detailedBreakdown: `Market analysis for ${profile.niche}:\n\n📈 Category Growth: The ${profile.niche} space has seen a significant 18% increase in search volume and social engagement this week.\n\n🔍 Key Drivers:\n- Seasonal demand increase (spring grooming season)\n- Viral social media content boosting awareness\n- Competitor stockouts creating buying windows\n\n💡 Opportunity Window: Next 2-3 weeks represent a high-conversion period for ${profile.focusCategories[0] ?? 'top products'}.\n\n⚠️ Risk Signal: Two major competitors have reduced inventory levels, suggesting potential supply chain stress.`,
      suggestedActions: [
        { label: 'Increase stock for top 3 SKUs', description: `Boost inventory on your best-selling ${profile.niche} products by 25-30%`, estimatedImpact: '+12-18% revenue this month', reversible: true },
        { label: 'Launch targeted promotion', description: 'Run a 7-day flash sale to capture peak demand window', estimatedImpact: '+$800-1,200 estimated revenue', reversible: true },
        { label: 'Update product listings', description: 'Refresh SEO keywords on top 5 listings to match current search trends', estimatedImpact: '+15% organic visibility', reversible: true }
      ],
      riskLevel: 'low',
      guidance: {
        whyThisMatters: 'You are entering a peak demand window for your niche. Missing this moment means leaving revenue on the table.',
        whatToDoNext: 'Start with the inventory review action — check your current stock levels against the 18% demand increase.',
        expectedOutcome: 'If you act within 48 hours, you could capture 30-40% more sales than your baseline this week.'
      }
    },
    pricing_update: {
      summary: 'Product pricing review identified 3 quick-win adjustments to improve margins',
      detailedBreakdown: `Pricing Analysis for ${profile.businessName}:\n\n📊 Current Position: Based on competitive analysis, your pricing strategy shows mixed performance across the catalog.\n\n🔴 Underpriced Products (leaving money on table):\n- Premium SKUs priced 12-15% below market average\n- Bundle offers not capturing full value\n\n🟢 Well-Positioned Products:\n- Core everyday items are competitively placed\n- Entry-level products driving good volume\n\n📉 Overpriced Products (blocking conversions):\n- 2-3 SKUs priced 8-20% above competitors without differentiation\n\nRecommended adjustment range: -8% to +15% depending on SKU.`,
      suggestedActions: [
        { label: 'Raise premium SKU prices by 10%', description: 'Increase prices on your 2 best-reviewed products to match market positioning', estimatedImpact: '+$300-500/month margin improvement', reversible: true },
        { label: 'Reduce slow-mover prices by 8%', description: 'Stimulate movement on products sitting 30+ days', estimatedImpact: '+25% velocity on affected items', reversible: true },
        { label: 'Bundle repackage at value price', description: 'Create a 3-item bundle at 15% discount to increase AOV', estimatedImpact: '+$180-240 weekly AOV lift', reversible: true }
      ],
      riskLevel: 'medium',
      guidance: {
        whyThisMatters: 'Pricing misalignment is the #1 silent revenue killer. Even a 5% adjustment on your top sellers can add hundreds per month.',
        whatToDoNext: 'Review the suggested price changes one by one. Start with the safe ones (low risk items) before touching high-volume SKUs.',
        expectedOutcome: 'Projected 8-15% margin improvement over 30 days with all changes applied.'
      }
    },
    email_draft: {
      summary: 'High-converting spring promotion email ready for your review',
      detailedBreakdown: `Email Campaign Draft:\n\n📧 SUBJECT LINE OPTIONS:\n1. "Your spring routine just got an upgrade ✨"\n2. "Limited time: Our top ${profile.niche} picks — 15% off"\n\n📄 EMAIL BODY:\nHi [First Name],\n\nSpring is here, and we've put together something special for you.\n\nThis week only — get 15% off our best-selling ${profile.niche} collection. Whether you're refreshing your routine or stocking up on favorites, now is the perfect time.\n\n[SHOP NOW — 15% OFF]\n\nThis offer expires Sunday at midnight. Don't miss it.\n\nWarm regards,\n${profile.businessName}\n\n📌 SEND DETAILS:\n- Best send time: Tuesday or Thursday, 10am-11am\n- Target segment: Customers who purchased in last 90 days\n- Estimated open rate: 22-28%`,
      suggestedActions: [
        { label: 'Approve and schedule email', description: 'Send this draft to your email platform for scheduling — requires manual send', estimatedImpact: 'Est. 200-400 opens, 15-25 conversions', reversible: false },
        { label: 'Modify subject line', description: 'Edit the subject line before approving', estimatedImpact: 'Potentially higher open rates', reversible: true },
        { label: 'Expand to full campaign', description: 'Turn this into a 3-email sequence (promo → reminder → last chance)', estimatedImpact: '+40% campaign revenue vs single email', reversible: true }
      ],
      riskLevel: 'low',
      guidance: {
        whyThisMatters: 'Email is your highest-ROI channel. A well-timed campaign to existing customers converts 3-5x better than new customer ads.',
        whatToDoNext: 'Read the email draft carefully, make any brand voice adjustments, then approve to schedule.',
        expectedOutcome: 'Estimated $400-800 revenue from this single campaign based on your customer base size.'
      }
    },
    inventory_action: {
      summary: 'Inventory review detected 2 urgent restock needs and 3 slow-moving SKUs',
      detailedBreakdown: `Inventory Analysis for ${profile.businessName}:\n\n🚨 URGENT RESTOCK (Action within 5-7 days):\n- SKU A: 4 units remaining, selling 2/day = 2 days left\n- SKU B: 7 units remaining, selling 1.5/day = 5 days left\n\n⚠️ MODERATE RESTOCK (Action within 2 weeks):\n- SKU C: 15 units remaining, selling 1/day = 15 days left\n\n🐌 SLOW MOVERS (Consider clearance):\n- SKU D: 28 units, last sale 18 days ago\n- SKU E: 41 units, last sale 22 days ago\n- SKU F: 16 units, 0.2 sales/day average\n\n💰 Cash Flow Impact:\n- Restock cost estimate: $400-600\n- Slow-mover clearance could recover: $280-350`,
      suggestedActions: [
        { label: 'Reorder SKU A immediately', description: 'Place emergency reorder for top-selling SKU before stockout', estimatedImpact: 'Prevent $200-300 in lost sales', reversible: false },
        { label: 'Reorder SKU B within 3 days', description: 'Schedule reorder to avoid gap in availability', estimatedImpact: 'Maintain sales continuity', reversible: false },
        { label: 'Run clearance on slow movers', description: 'Apply 20-25% discount to SKUs D, E, F to recover tied-up cash', estimatedImpact: 'Recover $280-350, free storage space', reversible: true }
      ],
      riskLevel: 'medium',
      guidance: {
        whyThisMatters: 'Stockouts are invisible revenue killers. When a customer sees "out of stock," 70% will buy from a competitor instead.',
        whatToDoNext: 'Address SKU A first — you have 2 days before stockout. Then work through the list in priority order.',
        expectedOutcome: 'Prevent $500-800 in lost sales this week, recover $280-350 in slow-mover cash.'
      }
    },
    product_creation: {
      summary: `3 high-potential new product ideas identified for your ${profile.niche} business`,
      detailedBreakdown: `Product Creation Analysis for ${profile.businessName}:\n\n🆕 TOP NEW PRODUCT OPPORTUNITIES:\n\n1. STAR PRODUCT: Premium ${profile.niche} Starter Kit\n   - Bundle your 3 best-sellers into a "beginner kit"\n   - Price point: $45-65 (vs. $28-38 individual)\n   - Demand signal: 40% of competitors selling similar bundles successfully\n\n2. DIGITAL PRODUCT: ${profile.niche} Care Guide (PDF)\n   - Create a 10-15 page care guide for your niche\n   - Price: $7-12 as upsell\n   - Margins: 95%+ with zero inventory cost\n\n3. SUBSCRIPTION BOX: Monthly ${profile.niche} Essentials\n   - Curated monthly box of 4-5 complementary items\n   - Price: $35-45/month\n   - Retention advantage: 8-12 month average subscriber lifetime\n\nProduct description for Item 1:\n"Discover everything you need to start your ${profile.niche} journey. Our carefully curated starter kit includes [X, Y, Z] — hand-picked by our experts for beginners and enthusiasts alike."`,
      suggestedActions: [
        { label: 'Create starter kit listing', description: 'Build the bundle product page for the Premium Starter Kit', estimatedImpact: '+$200-400/week from bundle sales', reversible: true },
        { label: 'Draft care guide outline', description: 'Plan the 10-page digital guide content', estimatedImpact: '95% margin digital product, $100-300/month passive', reversible: true },
        { label: 'Research subscription box suppliers', description: 'Investigate packaging and logistics for monthly box concept', estimatedImpact: 'Recurring revenue stream, high LTV', reversible: true }
      ],
      riskLevel: 'low',
      guidance: {
        whyThisMatters: 'New products diversify revenue and protect you from single-SKU dependency. Bundles also increase average order value by 25-40%.',
        whatToDoNext: 'Start with the bundle kit — it requires zero new inventory, just a new listing combining what you already have.',
        expectedOutcome: 'Bundle kit alone could add $200-400/week in revenue with minimal effort.'
      }
    },
    competitor_scan: {
      summary: 'Competitor scan complete — 2 pricing gaps and 1 stock opportunity detected',
      detailedBreakdown: `Competitor Intelligence Report:\n\n🔍 KEY FINDINGS:\n\n1. PRICE GAP OPPORTUNITY:\n   - Competitor A is pricing their equivalent to your SKU A at 22% higher\n   - You can raise your price 10-12% and still be the better value\n   - Estimated revenue gain: $180-250/month\n\n2. STOCK OPPORTUNITY:\n   - Competitor B has been out of stock on their top ${profile.niche} SKU for 6 days\n   - Window: Likely 5-14 more days before they restock\n   - Action: Boost your ad spend on that category NOW\n\n3. MARKETING ANGLES:\n   - Competitors leading with "natural ingredients" messaging\n   - You can differentiate with "fast results" or "professional grade" angle\n   - Review difference: Your average rating 4.7★ vs competitor avg 4.3★\n\n4. RISK SIGNAL:\n   - A new low-price competitor entered the space this week\n   - Currently pricing 30% below market (likely unsustainable)\n   - Monitor: If they sustain low prices 2+ weeks, reassess entry-level SKUs`,
      suggestedActions: [
        { label: 'Raise prices on SKU A by 10%', description: 'Capitalize on price gap vs Competitor A while remaining best value', estimatedImpact: '+$180-250/month margin', reversible: true },
        { label: 'Increase ad budget this week', description: 'Capture Competitor B\'s displaced customers during their stockout', estimatedImpact: '+30-50 extra sales this week', reversible: true },
        { label: 'Update listing copy to highlight ratings', description: 'Lean into your 4.7★ advantage vs 4.3★ competitor average', estimatedImpact: '+8-12% conversion rate lift', reversible: true }
      ],
      riskLevel: 'medium',
      guidance: {
        whyThisMatters: 'Competitor stockouts are rare gold. When they\'re out of stock, their customers are actively searching — and you can capture them right now.',
        whatToDoNext: 'Act on the ad spend increase TODAY while the window is open. Competitor B\'s stockout won\'t last forever.',
        expectedOutcome: 'Estimated +$400-700 in additional revenue this week from ad spend increase alone.'
      }
    },
    performance_review: {
      summary: 'Monthly performance review: Business health score 7.2/10 — 3 key improvements identified',
      detailedBreakdown: `Performance Review — ${profile.businessName}:\n\n📊 BUSINESS HEALTH SCORE: 7.2/10\n\nSTRENGTHS:\n✅ Product ratings consistently above market average\n✅ Repeat customer rate showing improvement\n✅ Core SKU margins healthy at 35-45%\n\nARE AS NEEDING WORK:\n⚠️ Customer acquisition cost trending upward (+12% vs last month)\n⚠️ Average order value flat for 3 months\n⚠️ 4 SKUs not contributing meaningfully to revenue\n\nTREND ANALYSIS:\n- Revenue: Stable (slight positive trend)\n- Margins: Holding steady\n- Velocity: Some SKUs slowing\n- Customer satisfaction: Strong\n\nSCORE BREAKDOWN:\n- Product Quality: 9/10\n- Pricing Strategy: 6/10\n- Marketing Efficiency: 6/10\n- Inventory Management: 7/10\n- Customer Experience: 8/10`,
      suggestedActions: [
        { label: 'Address AOV with bundle strategy', description: 'Implement 3 strategic bundles to break out of flat AOV', estimatedImpact: '+18-25% average order value', reversible: true },
        { label: 'Audit 4 underperforming SKUs', description: 'Decide: discount, bundle, or discontinue the bottom 4 products', estimatedImpact: 'Free up cash and storage', reversible: true },
        { label: 'Review ad targeting efficiency', description: 'Audit your advertising campaigns for wasted spend', estimatedImpact: '-10-15% CAC, same or better results', reversible: true }
      ],
      riskLevel: 'low',
      guidance: {
        whyThisMatters: 'A 7.2 is solid but leaves room for improvement. The gap between 7 and 9 is mostly about fixing 2-3 specific issues rather than overhauling everything.',
        whatToDoNext: 'Focus on the AOV improvement first — it\'s the highest ROI action with the lowest risk. Bundles can be built in an afternoon.',
        expectedOutcome: 'Moving from 7.2 → 8.5 health score over 60 days with these 3 actions completed.'
      }
    }
  }

  const demo = demos[intentType] ?? demos['market_analysis']
  return JSON.stringify(demo)
}

// ============================================================
// HELPERS
// ============================================================

function getCategoryLabel(intentType: IntentType): string {
  const map: Record<string, string> = {
    market_analysis: 'Market Intelligence',
    pricing_update: 'Pricing Strategy',
    product_creation: 'Product Development',
    email_draft: 'Email Marketing',
    inventory_action: 'Inventory Management',
    competitor_scan: 'Competitive Intelligence',
    trend_report: 'Trend Analysis',
    bundle_suggestion: 'Product Strategy',
    restock_alert: 'Operations',
    campaign_suggestion: 'Marketing',
    performance_review: 'Business Health',
    opportunity_alert: 'Growth Opportunities'
  }
  return map[intentType] ?? 'General'
}

function getTagsForIntent(intentType: IntentType, niche: string): string[] {
  const baseTags: Record<string, string[]> = {
    market_analysis: ['market', 'trends', 'research'],
    pricing_update: ['pricing', 'revenue', 'margins'],
    product_creation: ['products', 'expansion', 'catalog'],
    email_draft: ['email', 'marketing', 'campaigns'],
    inventory_action: ['inventory', 'operations', 'stock'],
    competitor_scan: ['competitors', 'intelligence', 'market'],
    trend_report: ['trends', 'market', 'forecasting'],
    bundle_suggestion: ['bundles', 'products', 'aov'],
    restock_alert: ['restock', 'urgent', 'operations'],
    campaign_suggestion: ['campaigns', 'marketing', 'promotions'],
    performance_review: ['performance', 'kpis', 'health'],
    opportunity_alert: ['opportunity', 'growth', 'priority']
  }
  return [...(baseTags[intentType] ?? []), niche.toLowerCase().replace(/\s+/g, '-')]
}

function extractEstimatedValue(breakdown: string): string {
  const dollarMatch = breakdown.match(/\$[\d,]+-[\d,]+/)
  if (dollarMatch) return dollarMatch[0]
  const percentMatch = breakdown.match(/\+\d+%/)
  if (percentMatch) return percentMatch[0]
  return ''
}
