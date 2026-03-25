// ============================================================
// AI ROUTING ENGINE
// ============================================================
// Routes each intent type to the appropriate AI model.
//
// ROUTING PHILOSOPHY:
//   Claude  → Deep reasoning, analysis, long-form planning,
//              nuanced recommendations
//   OpenAI  → Structured JSON outputs, fast scanning,
//              pattern matching, automation assistance
//   Hybrid  → Both models consulted; Claude synthesizes final intent
//
// This module ONLY generates INTENTS.
// It never executes actions in the Action Layer.
// ============================================================

import type { IntentType, AIModel, AIRoutingRule } from '../types/intent'

// ============================================================
// ROUTING TABLE
// ============================================================

export const ROUTING_TABLE: AIRoutingRule[] = [
  {
    intentType: 'market_analysis',
    preferredModel: 'claude',
    fallback: 'openai',
    reason: 'Claude excels at contextual trend reasoning and narrative analysis'
  },
  {
    intentType: 'pricing_update',
    preferredModel: 'hybrid',
    fallback: 'claude',
    reason: 'OpenAI structures competitive data; Claude reasons about risk and context'
  },
  {
    intentType: 'product_creation',
    preferredModel: 'claude',
    fallback: 'openai',
    reason: 'Claude generates creative product descriptions and bundle strategies'
  },
  {
    intentType: 'email_draft',
    preferredModel: 'claude',
    fallback: 'openai',
    reason: 'Claude produces natural, persuasive email copy with brand voice'
  },
  {
    intentType: 'inventory_action',
    preferredModel: 'openai',
    fallback: 'claude',
    reason: 'OpenAI handles structured inventory pattern analysis efficiently'
  },
  {
    intentType: 'competitor_scan',
    preferredModel: 'openai',
    fallback: 'claude',
    reason: 'OpenAI parses structured competitor data and price comparisons quickly'
  },
  {
    intentType: 'trend_report',
    preferredModel: 'claude',
    fallback: 'openai',
    reason: 'Claude reasons about macro and micro market trends contextually'
  },
  {
    intentType: 'bundle_suggestion',
    preferredModel: 'hybrid',
    fallback: 'claude',
    reason: 'Hybrid approach: OpenAI scans product affinities, Claude creates strategy'
  },
  {
    intentType: 'restock_alert',
    preferredModel: 'openai',
    fallback: 'claude',
    reason: 'OpenAI handles numeric threshold analysis and structured output'
  },
  {
    intentType: 'campaign_suggestion',
    preferredModel: 'hybrid',
    fallback: 'claude',
    reason: 'OpenAI segments audience data; Claude crafts campaign narratives'
  },
  {
    intentType: 'performance_review',
    preferredModel: 'claude',
    fallback: 'openai',
    reason: 'Claude synthesizes multi-dimensional performance data into actionable insights'
  },
  {
    intentType: 'opportunity_alert',
    preferredModel: 'claude',
    fallback: 'openai',
    reason: 'Claude identifies non-obvious opportunities from market signals'
  }
]

export function getRoutingRule(intentType: IntentType): AIRoutingRule {
  return (
    ROUTING_TABLE.find(r => r.intentType === intentType) ?? {
      intentType,
      preferredModel: 'claude',
      fallback: 'openai',
      reason: 'Default to Claude for unknown intent types'
    }
  )
}

export function resolveModel(intentType: IntentType): AIModel {
  return getRoutingRule(intentType).preferredModel
}

// ============================================================
// PROMPT BUILDERS
// ============================================================
// Each function returns a structured prompt for the given intent.
// The prompt is fed to the appropriate AI model via the API.
// ============================================================

export function buildSystemPrompt(niche: string, pricingStyle: string): string {
  return `You are an expert AI assistant for an e-commerce and reselling business specializing in ${niche}.
The business uses a ${pricingStyle} pricing strategy.

YOUR ROLE:
- Analyze business data and market conditions
- Generate structured INTENT recommendations
- NEVER suggest direct actions without user approval
- Always include risk assessment
- Always include actionable guidance

OUTPUT FORMAT:
Always respond in valid JSON matching the Intent structure.
Be specific, data-driven, and honest about uncertainty.
Flag high-risk suggestions clearly.
Guide the user step by step — never overwhelm them.`
}

export function buildMarketAnalysisPrompt(context: Record<string, unknown>): string {
  return `Perform a comprehensive market analysis for this e-commerce business.

Business Context:
${JSON.stringify(context, null, 2)}

Analyze:
1. Current market trends relevant to the niche
2. Demand patterns and seasonal shifts
3. Emerging product opportunities
4. Price sensitivity in the market
5. Customer behavior signals

Generate a market_analysis intent with:
- Summary: One clear sentence describing the most important finding
- Detailed breakdown: Structured analysis with specific insights
- Suggested actions: 3-5 specific, prioritized actions
- Risk level: Assess overall risk of current market position
- Guidance: Why this matters, what to do next, expected outcome

Respond ONLY with valid JSON.`
}

export function buildPricingPrompt(context: Record<string, unknown>): string {
  return `Analyze pricing strategy and competitive positioning for this e-commerce business.

Business Context:
${JSON.stringify(context, null, 2)}

Analyze:
1. Current prices vs estimated competitor prices
2. Price elasticity signals
3. Margin optimization opportunities
4. Products that are over/under-priced
5. Quick wins for revenue improvement

Generate a pricing_update intent with specific, quantified recommendations.
Include percentage changes and expected revenue impact.
Mark any pricing change above 15% as HIGH RISK.

Respond ONLY with valid JSON.`
}

export function buildEmailPrompt(context: Record<string, unknown>): string {
  return `Generate an email campaign draft for this e-commerce business.

Business Context:
${JSON.stringify(context, null, 2)}

Create:
1. Subject line (2 options)
2. Email body (concise, 150-200 words)
3. Call-to-action
4. Best send time recommendation
5. Target segment

Generate an email_draft intent.
The email must NOT be sent automatically — it requires explicit user approval.

Respond ONLY with valid JSON.`
}

export function buildInventoryPrompt(context: Record<string, unknown>): string {
  return `Analyze inventory patterns and generate restock/optimization recommendations.

Business Context:
${JSON.stringify(context, null, 2)}

Analyze:
1. Stock velocity (fast vs slow movers)
2. Restock urgency by product
3. Dead stock identification
4. Optimal order quantities
5. Cash flow impact of inventory decisions

Generate an inventory_action intent.
Flag any recommendation involving spending over $500 as MEDIUM risk.
Flag any over $2000 as HIGH risk.

Respond ONLY with valid JSON.`
}

export function buildProductCreationPrompt(context: Record<string, unknown>): string {
  return `Generate product creation and expansion recommendations.

Business Context:
${JSON.stringify(context, null, 2)}

Suggest:
1. New product ideas aligned with current niche
2. Product description for top suggestion
3. Bundle opportunities with existing inventory
4. Digital product opportunities
5. Pricing strategy for new products

Generate a product_creation intent.

Respond ONLY with valid JSON.`
}

export function buildCompetitorScanPrompt(context: Record<string, unknown>): string {
  return `Perform a structured competitor analysis for this e-commerce business.

Business Context:
${JSON.stringify(context, null, 2)}

Analyze:
1. Price positioning vs competitors
2. Product gaps competitors are exploiting
3. Marketing angles competitors are using
4. Review sentiment differences
5. Speed/shipping advantages or disadvantages

Generate a competitor_scan intent with specific, actionable insights.

Respond ONLY with valid JSON.`
}

export function buildTrendReportPrompt(context: Record<string, unknown>): string {
  return `Generate a trend analysis report for this e-commerce niche.

Business Context:
${JSON.stringify(context, null, 2)}

Identify:
1. Top 3 rising trends in the niche (with estimated % growth)
2. Declining trends to exit
3. Seasonal opportunities in the next 30-60 days
4. Social media / platform trends affecting demand
5. Supply chain signals

Generate a trend_report intent.

Respond ONLY with valid JSON.`
}

export function buildPerformanceReviewPrompt(context: Record<string, unknown>): string {
  return `Perform a comprehensive business performance review.

Business Context:
${JSON.stringify(context, null, 2)}

Review:
1. Overall business health score (1-10)
2. Revenue trend analysis
3. Best performing products
4. Worst performing products
5. Key actions to improve performance

Generate a performance_review intent with specific, honest assessment.

Respond ONLY with valid JSON.`
}

export function buildOpportunityAlertPrompt(context: Record<string, unknown>): string {
  return `Identify high-value business opportunities for this e-commerce business.

Business Context:
${JSON.stringify(context, null, 2)}

Look for:
1. Underserved market gaps
2. Arbitrage opportunities
3. Seasonal demand spikes
4. Viral product potential
5. Partnership or bundling opportunities

Generate an opportunity_alert intent. Be specific about timing and estimated value.

Respond ONLY with valid JSON.`
}

// ============================================================
// PROMPT ROUTER
// ============================================================

export function getPromptForIntent(
  intentType: IntentType,
  context: Record<string, unknown>
): string {
  const map: Record<string, (ctx: Record<string, unknown>) => string> = {
    market_analysis: buildMarketAnalysisPrompt,
    pricing_update: buildPricingPrompt,
    email_draft: buildEmailPrompt,
    inventory_action: buildInventoryPrompt,
    product_creation: buildProductCreationPrompt,
    competitor_scan: buildCompetitorScanPrompt,
    trend_report: buildTrendReportPrompt,
    performance_review: buildPerformanceReviewPrompt,
    opportunity_alert: buildOpportunityAlertPrompt,
    bundle_suggestion: buildProductCreationPrompt,
    restock_alert: buildInventoryPrompt,
    campaign_suggestion: buildEmailPrompt
  }

  const builder = map[intentType] ?? buildMarketAnalysisPrompt
  return builder(context)
}
