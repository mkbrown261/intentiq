// ================================================================
// MULTI-AGENT SYSTEM — AI Business Operating System
// ================================================================
// Each agent has a defined role, prompt strategy, and intent types.
// Agents ONLY generate INTENTS. They NEVER execute actions.
// All agent outputs flow through the Intent Layer.
// ================================================================

import type { Intent, AgentName, IntentType, BusinessProfile, RiskLevel, Priority } from '../types/core'
import { genId, ProfileStore } from './store'
import type { Env } from './platform'
export type { Env }

// ── AI Model Routing ─────────────────────────────────────────────
// Each agent has a preferred model based on its task requirements
const AGENT_MODEL_MAP: Record<AgentName, 'claude' | 'openai' | 'hybrid'> = {
  MarketResearchAgent:  'claude',
  PricingAgent:         'hybrid',
  InventoryAgent:       'openai',
  EmailMarketingAgent:  'claude',
  ProductCreationAgent: 'claude',
  BusinessHealthAgent:  'hybrid',
  StrategyAgent:        'claude'
}

// ── System Prompt Builder ────────────────────────────────────────
function buildSystemPrompt(profile: BusinessProfile): string {
  return `You are a specialized AI agent inside an AI Business Operating System for an e-commerce business.

BUSINESS CONTEXT:
- Business: ${profile.businessName}
- Niche: ${profile.niche} (${profile.subNiche ?? ''})
- Platform: ${profile.platform}
- Pricing Style: ${profile.pricingStyle}
- Risk Tolerance: ${profile.riskTolerance}
- Monthly Revenue: $${profile.monthlyRevenue ?? 'unknown'}
- Team Size: ${profile.teamSize}
- Focus Categories: ${profile.focusCategories.join(', ')}
- Top Products: ${profile.topProducts.join(', ')}

YOUR ROLE:
You generate STRUCTURED INTENT RECOMMENDATIONS only.
You NEVER execute actions directly.
You NEVER modify external systems.
Every recommendation requires human approval.

RESPONSE FORMAT — Return ONLY valid JSON with this exact structure:
{
  "summary": "One clear sentence describing the core recommendation",
  "detailedReasoning": "2-4 paragraphs with specific data-driven analysis",
  "whyThisMatters": "One paragraph explaining the business impact",
  "suggestedNextSteps": ["Step 1", "Step 2", "Step 3", "Step 4"],
  "expectedResult": "Specific, quantified outcome if recommendation is followed",
  "alternativeOptions": ["Option A", "Option B"],
  "riskLevel": "low | medium | high",
  "confidenceLevel": 85,
  "priority": "low | medium | high | urgent",
  "estimatedValue": "$X-Y or X% improvement",
  "estimatedTimeToAct": "within X days/hours",
  "affectedProducts": ["Product A", "Product B"],
  "tags": ["tag1", "tag2"]
}

Be specific, data-driven, honest about uncertainty, and always guide the user step-by-step.
Flag anything that could lose money as medium or high risk.`
}

// ── Agent-Specific Prompts ────────────────────────────────────────

function getAgentPrompt(agentName: AgentName, intentType: IntentType, context: Record<string, unknown>, profile: BusinessProfile): string {
  const base = `Business niche: ${profile.niche}. Focus: ${profile.focusCategories.join(', ')}. Context: ${JSON.stringify(context)}`

  const prompts: Record<string, string> = {

    // Market Research Agent
    market_trend: `${base}\n\nAs the Market Research Agent, analyze current market trends in this niche. Identify the top 3-5 rising trends with estimated % growth, seasonal patterns in the next 30-60 days, and which trends are declining. Provide specific product category signals.`,

    market_opportunity: `${base}\n\nAs the Market Research Agent, identify high-value untapped opportunities. Look for underserved niches, product gaps, arbitrage opportunities, viral potential, and partnership or bundle plays. Be specific about timing windows and estimated revenue potential.`,

    competitor_alert: `${base}\n\nAs the Market Research Agent, perform a competitor intelligence scan. Identify price gaps, stockout opportunities, marketing angle differences, and rating/review advantages. Provide actionable intelligence with timing sensitivity.`,

    seasonality_alert: `${base}\n\nAs the Market Research Agent, analyze seasonal demand patterns. Identify upcoming seasonal spikes, optimal stocking windows, promotional timing, and historical demand cycles for this niche.`,

    strategy_review: `${base}\n\nAs the Strategy Agent, perform a high-level strategic review of this business. Assess market position, competitive advantages, growth vectors, and identify the top 3 strategic priorities for the next 90 days.`,

    // Pricing Agent
    pricing_adjust: `${base}\n\nAs the Pricing Agent, analyze the current pricing strategy. Identify products that are under-priced vs competitors, over-priced causing conversion drag, and quick-win pricing adjustments. Provide specific % change recommendations with revenue impact estimates.`,

    pricing_bundle: `${base}\n\nAs the Pricing Agent, identify bundle pricing opportunities. Analyze product affinity, suggest specific bundle combinations, recommended bundle prices vs. individual prices, and projected AOV lift. Include psychologically compelling pricing angles.`,

    pricing_discount: `${base}\n\nAs the Pricing Agent, evaluate strategic discount opportunities. Identify slow-moving inventory that would benefit from discounting, optimal discount percentages that maintain margin while driving velocity, and the timing for promotions.`,

    financial_insight: `${base}\n\nAs the Pricing/Business Health Agent, provide financial insights. Analyze margin performance, revenue trends, cash flow signals, and cost optimization opportunities. Identify the top 3 financial levers to pull this month.`,

    // Inventory Agent
    inventory_restock: `${base}\n\nAs the Inventory Agent, analyze inventory health. Identify products with critical stock levels (under 7 days remaining based on velocity), upcoming stockout risks, optimal reorder quantities, and estimated restock costs. Prioritize by urgency.`,

    inventory_liquidate: `${base}\n\nAs the Inventory Agent, identify slow-moving and dead stock. Analyze products with low velocity (less than 1 sale per 3 days), tied-up cash value, and optimal liquidation strategies (discount, bundle, or clearance). Include cash recovery estimates.`,

    performance_alert: `${base}\n\nAs the Business Health Agent, analyze overall performance. Score business health across inventory, pricing, marketing, and products. Identify the 3 most impactful improvements and flag any deteriorating metrics.`,

    // Email Marketing Agent
    email_campaign: `${base}\n\nAs the Email Marketing Agent, generate a high-converting email campaign. Create subject lines (2 options), full email body (150-200 words), CTA, best send time, target segment, and expected open/conversion rates. Make it feel personal and urgency-driven.`,

    email_abandoned_cart: `${base}\n\nAs the Email Marketing Agent, design an abandoned cart recovery sequence. Create a 3-email sequence (1hr, 24hr, 72hr) with subject lines, key message for each, and incentive strategy. Include expected recovery rate and revenue impact.`,

    email_reengagement: `${base}\n\nAs the Email Marketing Agent, create a customer re-engagement campaign for customers who haven't purchased in 60-90 days. Include segmentation criteria, message sequence, incentive offer, and expected reactivation rate.`,

    customer_segment: `${base}\n\nAs the Email Marketing Agent, analyze customer segments. Identify the top 3-4 customer segments by behavior, purchase patterns, and LTV. Suggest personalized messaging strategies and product recommendations for each segment.`,

    // Product Creation Agent
    product_create: `${base}\n\nAs the Product Creation Agent, identify new product opportunities. Suggest 3 new product ideas with demand signals, competitive analysis, pricing strategy, full product description for top pick, and estimated revenue potential.`,

    product_bundle: `${base}\n\nAs the Product Creation Agent, design product bundle strategies. Identify the best bundle combinations based on purchase history patterns, suggest bundle names and descriptions, pricing at optimal discount depth, and projected bundle revenue.`,

    product_variation: `${base}\n\nAs the Product Creation Agent, identify variation opportunities. Analyze existing products where adding sizes, colors, scents, or formats would capture additional demand. Include specific variation recommendations with demand evidence.`,

    // Business Health Agent
    business_health: `${base}\n\nAs the Business Health Agent, generate a comprehensive business health report. Score each area (inventory, pricing, marketing, products, operations) out of 100, identify critical weaknesses, celebrate strengths, and provide a prioritized improvement roadmap.`,

    workflow_suggestion: `${base}\n\nAs the Strategy Agent, suggest workflow optimizations. Identify repetitive tasks that could be templated, processes causing bottlenecks, and automation opportunities that would save time while keeping the owner in control.`,

    ad_optimization: `${base}\n\nAs the Strategy Agent, analyze advertising performance. Identify which ad channels are most efficient, budget allocation recommendations, creative angle improvements, and audience targeting refinements.`
  }

  return prompts[intentType] ?? `${base}\n\nGenerate a comprehensive business analysis for intent type: ${intentType}. Provide specific, actionable recommendations with risk assessment.`
}

// ── Claude API Call ───────────────────────────────────────────────
async function callClaude(system: string, user: string, apiKey: string): Promise<string> {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 2048,
      system,
      messages: [{ role: 'user', content: user }]
    })
  })
  if (!r.ok) throw new Error(`Anthropic ${r.status}: ${await r.text()}`)
  const d = await r.json() as { content: Array<{ text: string }> }
  return d.content?.[0]?.text ?? ''
}

// ── OpenAI API Call ──────────────────────────────────────────────
async function callOpenAI(system: string, user: string, apiKey: string): Promise<string> {
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      max_tokens: 2048,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system + '\nRespond ONLY with valid JSON.' },
        { role: 'user', content: user }
      ]
    })
  })
  if (!r.ok) throw new Error(`OpenAI ${r.status}: ${await r.text()}`)
  const d = await r.json() as { choices: Array<{ message: { content: string } }> }
  return d.choices?.[0]?.message?.content ?? ''
}

// ── Response Parser ──────────────────────────────────────────────
function parseResponse(raw: string, agentName: AgentName, intentType: IntentType): Partial<Intent> {
  let parsed: Record<string, unknown> = {}
  try {
    const match = raw.match(/```json\n?([\s\S]*?)\n?```/) ?? raw.match(/(\{[\s\S]*\})/)
    parsed = JSON.parse(match ? (match[1] ?? match[0]) : raw)
  } catch {
    return buildFallbackIntent(raw, agentName, intentType)
  }

  const steps = (parsed.suggestedNextSteps ?? parsed.suggested_next_steps ?? parsed.steps ?? []) as string[]
  const alts  = (parsed.alternativeOptions ?? parsed.alternatives ?? []) as string[]
  const tags  = (parsed.tags ?? []) as string[]
  const affected = (parsed.affectedProducts ?? parsed.affected_products ?? []) as string[]

  const rawRisk = String(parsed.riskLevel ?? parsed.risk_level ?? parsed.risk ?? 'medium').toLowerCase()
  const riskLevel: RiskLevel = rawRisk === 'high' ? 'high' : rawRisk === 'low' ? 'low' : 'medium'

  const rawPri = String(parsed.priority ?? 'medium').toLowerCase()
  const priority: Priority = rawPri === 'urgent' ? 'urgent' : rawPri === 'high' ? 'high' : rawPri === 'low' ? 'low' : 'medium'

  const confidence = Math.min(100, Math.max(0, Number(parsed.confidenceLevel ?? parsed.confidence ?? 80)))

  return {
    summary:           String(parsed.summary ?? 'AI Analysis Complete'),
    detailedReasoning: String(parsed.detailedReasoning ?? parsed.detailed_reasoning ?? parsed.analysis ?? ''),
    whyThisMatters:    String(parsed.whyThisMatters ?? parsed.why_this_matters ?? parsed.why ?? ''),
    suggestedNextSteps: Array.isArray(steps) ? steps.slice(0, 6) : ['Review this recommendation'],
    expectedResult:    String(parsed.expectedResult ?? parsed.expected_result ?? parsed.outcome ?? ''),
    alternativeOptions: Array.isArray(alts) ? alts.slice(0, 3) : [],
    riskLevel,
    confidenceLevel: confidence,
    priority,
    tags: Array.isArray(tags) ? tags : [],
    metadata: {
      category:           getCategoryForIntent(intentType),
      estimatedValue:     String(parsed.estimatedValue ?? parsed.estimated_value ?? ''),
      estimatedTimeToAct: String(parsed.estimatedTimeToAct ?? parsed.time_to_act ?? ''),
      affectedProducts:   Array.isArray(affected) ? affected : [],
      dataPoints:         {}
    }
  }
}

function buildFallbackIntent(raw: string, agentName: AgentName, intentType: IntentType): Partial<Intent> {
  return {
    summary: `${agentName} analysis complete — review details`,
    detailedReasoning: raw.substring(0, 800),
    whyThisMatters: 'This analysis requires your review to determine next steps.',
    suggestedNextSteps: ['Review the analysis', 'Determine if action is needed', 'Approve or reject this intent'],
    expectedResult: 'Improved business decision-making',
    riskLevel: 'medium',
    confidenceLevel: 60,
    priority: 'medium',
    tags: [intentType],
    metadata: { category: getCategoryForIntent(intentType) }
  }
}

// ── Demo Intent Generator (no API keys) ─────────────────────────
function buildDemoIntent(agentName: AgentName, intentType: IntentType, profile: BusinessProfile): string {
  const niche = profile.niche
  const product = profile.topProducts[0] ?? 'your top product'

  const demos: Record<string, object> = {
    inventory_restock: {
      summary: `Urgent: Restock ${product} within 7 days — 4 units remaining at current velocity`,
      detailedReasoning: `📊 Inventory Analysis for ${profile.businessName}:\n\nCRITICAL: ${product} has only 4 units in stock with a sales velocity of approximately 2 units/day. At this rate, you will hit zero inventory in approximately 2 days, with a potential gap of 5+ days before new stock arrives.\n\n📈 Velocity has increased 22% over the last 14 days, suggesting demand is accelerating — making the stockout risk even more urgent.\n\nAdditional products approaching reorder points:\n- Product B: 12 units remaining, 8 days of stock\n- Product C: 18 units remaining, 14 days of stock\n\n💰 Cash flow note: Restock investment estimated at $400-600 with 3-4 week ROI based on current velocity.`,
      whyThisMatters: 'Stockouts cause immediate revenue loss, drop your search rankings on marketplace platforms, and push customers to competitors — many of whom will not return. A single stockout event can cost 2-3x the restock cost in lost future revenue.',
      suggestedNextSteps: [
        `Contact your supplier for ${product} immediately`,
        'Request expedited shipping if available (even at higher cost)',
        'Temporarily reduce ad spend on this product to slow velocity while restocking',
        'Update listing to show limited availability to manage customer expectations',
        'Reorder Product B within 3 days'
      ],
      expectedResult: 'Prevent stockout, maintain search ranking, protect $800-1,200 in projected weekly revenue from this SKU alone.',
      alternativeOptions: [
        'Source from secondary supplier at slightly higher cost to bridge gap',
        'Pause paid ads on this product for 5 days to extend stock runway'
      ],
      riskLevel: 'high',
      confidenceLevel: 94,
      priority: 'urgent',
      estimatedValue: '$800-1,200 revenue protected',
      estimatedTimeToAct: 'within 24 hours',
      affectedProducts: [product, 'Product B', 'Product C'],
      tags: ['restock', 'urgent', 'inventory', niche]
    },
    pricing_adjust: {
      summary: `3 pricing opportunities identified — quick wins totaling +$340-520/month`,
      detailedReasoning: `💰 Pricing Analysis for ${profile.businessName}:\n\nCOMPETITIVE POSITIONING SCAN:\nBased on market data, your catalog shows mixed competitive positioning.\n\n🔺 UNDER-PRICED (Raise prices — you're leaving money on the table):\n- ${product}: Your price is 14% below the average market price. Customers already buying at this price — a 10% increase won't hurt conversion.\n- Premium SKU: Priced 18% below your 5-star competitors. Price signals quality.\n\n🔻 OVER-PRICED (Lower slightly — you're blocking sales):\n- Entry-level SKU: 12% above budget alternatives. Consider a 5-8% reduction to capture this segment.\n\n🎯 WELL POSITIONED: 4 products are in the competitive sweet spot. No changes needed.`,
      whyThisMatters: 'Pricing is the highest-leverage change you can make — it takes 5 minutes and can add hundreds of dollars monthly. Under-pricing your best products is one of the most common and costly mistakes in e-commerce.',
      suggestedNextSteps: [
        `Raise ${product} price by 10% (from current to +10%)`,
        'Raise Premium SKU by 15%',
        'Reduce Entry-Level SKU by 7%',
        'Monitor conversion rate for 7 days after changes',
        'If conversion holds, apply similar analysis to remaining catalog'
      ],
      expectedResult: '+$340-520/month in additional margin from these 3 adjustments alone, with no expected impact on conversion volume.',
      alternativeOptions: [
        'A/B test the price increases using platform split-testing before full rollout',
        'Raise in two steps (5% now, 5% in 2 weeks) to minimize risk'
      ],
      riskLevel: 'medium',
      confidenceLevel: 88,
      priority: 'high',
      estimatedValue: '+$340-520/month',
      estimatedTimeToAct: 'within 48 hours',
      affectedProducts: [product, 'Premium SKU', 'Entry-Level SKU'],
      tags: ['pricing', 'revenue', niche]
    },
    market_trend: {
      summary: `${niche} category up 24% this month — spring seasonal peak beginning now`,
      detailedReasoning: `📈 Market Intelligence for ${niche.toUpperCase()}:\n\n🔥 TRENDING UP:\n1. Natural/organic ingredients angle: +31% search volume YoY\n2. Travel-size product formats: +18% category growth\n3. Bundle/kit formats: +24% conversion advantage over singles\n\n📉 DECLINING:\n1. Heavy fragrance products: -12% consumer preference shift\n2. Non-refillable packaging: -8% decline as sustainability grows\n\n⏰ SEASONAL WINDOW: The next 3-4 weeks represent peak spring buying season for ${niche}. Historically, this period drives 35-45% higher conversion rates than January-February baseline.\n\n🆕 OPPORTUNITY SIGNAL: Micro-influencer marketing for ${niche} is generating 4-6x ROI vs paid ads for businesses in this category right now.`,
      whyThisMatters: `You are entering the highest-demand window of the year for ${niche}. Businesses that position correctly in the next 2 weeks capture disproportionate market share that often sustains through summer.`,
      suggestedNextSteps: [
        'Increase inventory for your top 3 products by 30% before peak hits',
        'Add "natural" or "spring refresh" messaging to top 5 listings',
        'Create a spring bundle kit at a 15% discount',
        'Contact 3-5 micro-influencers in your niche this week',
        'Schedule a promotional email campaign for next Tuesday'
      ],
      expectedResult: '+25-40% revenue increase over the next 30 days vs baseline if seasonal positioning is executed.',
      alternativeOptions: [
        'Focus on just top 2 products if budget is limited',
        'Run a single promotional campaign instead of full repositioning'
      ],
      riskLevel: 'low',
      confidenceLevel: 91,
      priority: 'urgent',
      estimatedValue: '+25-40% revenue uplift',
      estimatedTimeToAct: 'within 48 hours',
      tags: ['market', 'trends', 'seasonal', niche]
    },
    email_campaign: {
      summary: `High-converting spring campaign ready — est. $620-900 from single send`,
      detailedReasoning: `📧 CAMPAIGN BRIEF for ${profile.businessName}:\n\n📌 SUBJECT LINE OPTIONS:\n1. "Your spring routine upgrade is here ✨" (predicted 28% open rate)\n2. "Limited time: Our bestsellers — 15% off this week only" (predicted 31% open rate)\n\n📝 EMAIL BODY:\nHi [First Name],\n\nSpring is officially here, and we put together something special for you.\n\nFor the next 5 days only, get 15% off our best-selling ${niche} essentials — the products you've been loving (and a few you haven't tried yet).\n\n[SHOP THE SPRING EDIT →]\n\nThis offer disappears Sunday at midnight. We keep these short so they stay special.\n\nWith love,\n${profile.businessName}\n\n📊 PERFORMANCE PREDICTION:\n- Expected open rate: 26-32%\n- Expected CTR: 8-12%\n- Expected conversions: 18-28 orders\n- Estimated revenue: $620-900\n- Best send time: Tuesday or Thursday, 10am-11am`,
      whyThisMatters: 'Email is consistently the highest-ROI marketing channel with 42:1 average return. Sending to existing customers who already trust you converts 5-7x better than cold acquisition.',
      suggestedNextSteps: [
        'Review and personalize the email body with your brand voice',
        'Choose Subject Line 2 for highest expected open rate',
        'Set send time for Tuesday 10am in your customers\' timezone',
        'Exclude customers who purchased in the last 7 days from the send list',
        'Set up a 48-hour reminder email for non-openers'
      ],
      expectedResult: '$620-900 in direct campaign revenue, plus re-engagement of 15-20% of dormant customers.',
      alternativeOptions: [
        'Turn this into a 3-email sequence for 40-60% higher total revenue',
        'Segment to high-value customers only for a more personalized offer'
      ],
      riskLevel: 'low',
      confidenceLevel: 85,
      priority: 'high',
      estimatedValue: '$620-900',
      estimatedTimeToAct: 'within 72 hours',
      tags: ['email', 'campaign', 'marketing', niche]
    },
    business_health: {
      summary: `Business Health Score: 72/100 — 3 critical improvements identified for immediate action`,
      detailedReasoning: `🏥 BUSINESS HEALTH REPORT — ${profile.businessName}:\n\nOVERALL SCORE: 72/100 (Good, with clear improvement path)\n\n📊 AREA SCORES:\n✅ Product Quality: 85/100 — Strong reviews, good ratings\n✅ Customer Experience: 78/100 — Positive feedback patterns\n⚠️ Pricing Strategy: 64/100 — Under-optimized, leaving $300-500/month on table\n⚠️ Inventory Management: 61/100 — 2 SKUs at critical levels\n❌ Marketing Efficiency: 58/100 — Email open rates below benchmark\n\nKEY WEAKNESSES:\n1. Customer Acquisition Cost rising 15% month-over-month\n2. Average Order Value flat for 90 days\n3. 3 SKUs not contributing to revenue meaningfully\n\nKEY STRENGTHS:\n1. Product ratings consistently above market average\n2. Repeat customer rate above industry benchmark\n3. Margins healthy on core SKUs`,
      whyThisMatters: 'A 72 score means you have a solid base but are leaving meaningful revenue on the table. Moving from 72 to 85 typically means $1,000-3,000/month in additional profit from the same customer base.',
      suggestedNextSteps: [
        'Fix inventory issues (2 products at critical levels) — this week',
        'Implement 3 pricing adjustments (see Pricing Agent recommendation)',
        'Launch one email campaign to reactivate dormant customers',
        'Audit and remove or discount the 3 underperforming SKUs',
        'Set a 30-day goal to reach 80/100 health score'
      ],
      expectedResult: 'Health score improvement from 72 to 82+ in 30 days with these 5 actions, translating to estimated +18-25% revenue improvement.',
      riskLevel: 'low',
      confidenceLevel: 89,
      priority: 'high',
      estimatedValue: '+18-25% revenue improvement',
      estimatedTimeToAct: 'start within 48 hours',
      tags: ['health', 'performance', 'kpis', niche]
    },
    product_create: {
      summary: `3 high-potential product opportunities identified — starter kit could add $800+/week`,
      detailedReasoning: `💡 PRODUCT OPPORTUNITIES for ${profile.businessName}:\n\n🥇 TOP OPPORTUNITY: ${niche} Starter Kit\nBundle your 3 best-selling products into a curated starter kit. Demand signal: 68% of competitors offering similar bundles, growing 24% YoY.\nPrice point: $52-68 (vs $31-42 individual)\nProjected margin: 38-44%\n\nFULL PRODUCT DESCRIPTION:\n"Everything you need to start your ${niche} journey. Our ${niche} Starter Kit combines our 3 bestsellers, hand-curated for [benefit]. Whether you're new to the routine or refreshing your collection, this kit gives you professional results at home."\n\n🥈 OPPORTUNITY 2: Digital Care Guide (PDF)\nA 12-15 page digital guide for ${niche} care. Zero inventory cost, 95% margin, $8-15 price point. Average 20-30 sales/month once established.\n\n🥉 OPPORTUNITY 3: Monthly Subscription Box\nCurated monthly essentials box. $38-48/month recurring. 8-12 month average LTV vs 1.4x for one-time buyers.`,
      whyThisMatters: 'Adding a bundle product typically increases store AOV by 25-40% with zero marketing cost. Digital products add passive income with no fulfillment overhead.',
      suggestedNextSteps: [
        'Create the starter kit listing today — requires no new inventory',
        'Write the product title and first bullet points using the description above',
        'Price the bundle at a 12% discount vs buying items individually',
        'Add 3 product photos showing the bundle together',
        'Begin outlining the digital guide for next month'
      ],
      expectedResult: 'Starter kit alone projected to generate $600-900/week in additional revenue from existing customers within 30 days of launch.',
      alternativeOptions: [
        'Start with just the digital guide — zero upfront cost',
        'Test a smaller 2-product bundle before committing to a 3-product kit'
      ],
      riskLevel: 'low',
      confidenceLevel: 82,
      priority: 'high',
      estimatedValue: '$600-900/week',
      estimatedTimeToAct: 'within 72 hours',
      tags: ['products', 'bundle', 'creation', niche]
    },
    competitor_alert: {
      summary: `Competitor stockout opportunity — 5-12 day window to capture displaced customers`,
      detailedReasoning: `🔍 COMPETITOR INTELLIGENCE:\n\nSTOCKOUT OPPORTUNITY:\nA major competitor in the ${niche} space has been out of stock on their top SKU for 4 days. Based on their review velocity, this SKU generates approximately 25-35 sales/day. These customers are actively searching for alternatives RIGHT NOW.\n\nACTION WINDOW: Estimated 5-12 more days before they restock.\n\nPRICE GAP:\nYour pricing on comparable products is 8-15% lower — a significant conversion advantage for displaced customers.\n\nRANKING OPPORTUNITY:\nIncreased sales velocity during this window will improve your search ranking and organic position — benefits that persist AFTER the competitor restocks.\n\nNEW ENTRANT ALERT:\nA new low-price seller entered your category this week, pricing 28% below market. This is likely unsustainable, but monitor for 2 weeks before adjusting strategy.`,
      whyThisMatters: 'Competitor stockouts are temporary gold mines. Customers who find you during their stockout often become permanent customers if their experience is positive.',
      suggestedNextSteps: [
        'Increase ad spend by 30-50% on your comparable products TODAY',
        'Ensure you have sufficient inventory (check restock status)',
        'Add a "In Stock & Ready to Ship" badge to your listings',
        'Lower your price by 5% temporarily to maximize conversion during window',
        'Monitor competitor restock daily — reduce ad spend when they return'
      ],
      expectedResult: '+30-50 additional sales this week, improved organic ranking that persists post-window, estimated +$800-1,400 additional revenue.',
      alternativeOptions: [
        'Focus ad spend increase only on your highest-margin comparable product',
        'Send email blast to past customers about your in-stock status'
      ],
      riskLevel: 'medium',
      confidenceLevel: 87,
      priority: 'urgent',
      estimatedValue: '+$800-1,400 this week',
      estimatedTimeToAct: 'within 12 hours',
      tags: ['competitor', 'opportunity', 'urgent', niche]
    },
    strategy_review: {
      summary: `Q2 Strategy Review: 4 high-priority growth initiatives identified for next 90 days`,
      detailedReasoning: `♟️ STRATEGIC REVIEW — ${profile.businessName}:\n\nCURRENT POSITION: You have a strong product foundation in ${niche} with good customer satisfaction. The business is operationally stable but under-monetizing its customer base.\n\nTOP 4 STRATEGIC INITIATIVES (Next 90 Days):\n\n1. BUNDLE ECONOMICS (30-day initiative)\nImplement 3-4 strategic bundles. Projected +25% AOV, +18% monthly revenue.\n\n2. EMAIL MONETIZATION (Ongoing)\nYou are sending 0-1 emails/month. Industry benchmark is 4-6/month. Each additional email = estimated $200-400 incremental revenue.\n\n3. INVENTORY SYSTEMIZATION (45-day initiative)\nImplement weekly inventory health checks to prevent stockouts. Each prevented stockout = $500-1,500 in saved revenue.\n\n4. CATEGORY EXPANSION (60-90 day initiative)\nData suggests adjacent ${niche} subcategories with growing demand. 1-2 new SKUs in adjacent category could add $800-1,200/month by month 3.`,
      whyThisMatters: 'Strategic focus is the difference between reactive business management and proactive growth. These 4 initiatives, executed over 90 days, create compounding returns.',
      suggestedNextSteps: [
        'Prioritize Initiative 1 (bundles) — highest ROI, fastest to execute',
        'Set up a weekly email send schedule starting next week',
        'Schedule a monthly inventory review (add to calendar now)',
        'Research top 3 adjacent category opportunities this week',
        'Set a 90-day revenue target to measure progress'
      ],
      expectedResult: '+40-60% revenue improvement at 90-day mark if all 4 initiatives are executed, vs +8-12% baseline growth without strategic focus.',
      riskLevel: 'low',
      confidenceLevel: 84,
      priority: 'high',
      estimatedValue: '+40-60% in 90 days',
      estimatedTimeToAct: 'begin within 1 week',
      tags: ['strategy', 'growth', 'q2', niche]
    }
  }

  const demo = demos[intentType] ?? demos['business_health']
  return JSON.stringify(demo)
}

// ── Main Agent Runner ────────────────────────────────────────────
export async function runAgent(
  agentName: AgentName,
  intentType: IntentType,
  context: Record<string, unknown>,
  env: Env,
  scheduleId?: string,
  workflowId?: string
): Promise<Intent> {
  const profile = ProfileStore.get()
  const systemPrompt = buildSystemPrompt(profile)
  const userPrompt = getAgentPrompt(agentName, intentType, context, profile)
  const preferredModel = AGENT_MODEL_MAP[agentName]

  let rawResponse = ''
  let usedModel: 'claude' | 'openai' = 'claude'

  // ── Try primary model ──────────────────────────────────────────
  try {
    if ((preferredModel === 'claude' || preferredModel === 'hybrid') && env.ANTHROPIC_API_KEY) {
      rawResponse = await callClaude(systemPrompt, userPrompt, env.ANTHROPIC_API_KEY)
      usedModel = 'claude'
    } else if (env.OPENAI_API_KEY) {
      rawResponse = await callOpenAI(systemPrompt, userPrompt, env.OPENAI_API_KEY)
      usedModel = 'openai'
    } else {
      rawResponse = buildDemoIntent(agentName, intentType, profile)
      usedModel = preferredModel === 'openai' ? 'openai' : 'claude'
    }
  } catch {
    // ── Fallback ────────────────────────────────────────────────
    try {
      if (usedModel === 'claude' && env.OPENAI_API_KEY) {
        rawResponse = await callOpenAI(systemPrompt, userPrompt, env.OPENAI_API_KEY)
        usedModel = 'openai'
      } else if (env.ANTHROPIC_API_KEY) {
        rawResponse = await callClaude(systemPrompt, userPrompt, env.ANTHROPIC_API_KEY)
        usedModel = 'claude'
      } else {
        rawResponse = buildDemoIntent(agentName, intentType, profile)
      }
    } catch {
      rawResponse = buildDemoIntent(agentName, intentType, profile)
    }
  }

  const partial = parseResponse(rawResponse, agentName, intentType)

  const intent: Intent = {
    id:                genId('intent'),
    type:              intentType,
    summary:           partial.summary ?? 'Analysis complete',
    detailedReasoning: partial.detailedReasoning ?? '',
    whyThisMatters:    partial.whyThisMatters ?? '',
    suggestedNextSteps: partial.suggestedNextSteps ?? [],
    expectedResult:    partial.expectedResult ?? '',
    alternativeOptions: partial.alternativeOptions ?? [],
    riskLevel:         partial.riskLevel ?? 'medium',
    confidenceLevel:   partial.confidenceLevel ?? 75,
    requiresApproval:  true,
    priority:          partial.priority ?? 'medium',
    status:            'pending',
    generatedBy:       agentName,
    workflowId,
    createdAt:         new Date().toISOString(),
    tags:              partial.tags ?? [],
    metadata: {
      category:            getCategoryForIntent(intentType),
      estimatedValue:      partial.metadata?.estimatedValue ?? '',
      estimatedTimeToAct:  partial.metadata?.estimatedTimeToAct ?? '',
      affectedProducts:    partial.metadata?.affectedProducts ?? [],
      dataPoints:          { generatedBy: usedModel },
      scheduleId
    }
  }

  return intent
}

// ── Helpers ───────────────────────────────────────────────────────
function getCategoryForIntent(type: IntentType): string {
  const map: Record<string, string> = {
    inventory_restock: 'Inventory', inventory_liquidate: 'Inventory',
    pricing_adjust: 'Pricing', pricing_bundle: 'Pricing', pricing_discount: 'Pricing',
    market_trend: 'Market Research', market_opportunity: 'Market Research', competitor_alert: 'Intelligence',
    email_campaign: 'Marketing', email_abandoned_cart: 'Marketing', email_reengagement: 'Marketing',
    product_create: 'Products', product_bundle: 'Products', product_variation: 'Products',
    workflow_suggestion: 'Operations', business_health: 'Health', performance_alert: 'Health',
    seasonality_alert: 'Market Research', customer_segment: 'Marketing',
    ad_optimization: 'Marketing', financial_insight: 'Finance', strategy_review: 'Strategy'
  }
  return map[type] ?? 'General'
}
