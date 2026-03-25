# IntentIQ — AI-Powered E-Commerce Automation System

## Project Overview
- **Name**: IntentIQ
- **Goal**: Help e-commerce and reselling businesses automate analysis, research, and optimization using AI — while maintaining **100% human control**
- **Core Rule**: This system THINKS and SUGGESTS. It NEVER acts automatically.
- **Architecture**: Intent-Driven, Non-Destructive System

---

## 🔐 Safety Architecture

```
User Request → AI Router → Claude/OpenAI → Intent Generator → Intent Store → USER REVIEW
                                                                              ↓
                                                              [Approve] [Modify] [Reject]
                                                                              ↓
                                                              Manual execution (your choice)
```

**ACTION LAYER: ████ NEVER TOUCHED ████**
- No automatic pricing changes
- No automatic email sending
- No automatic purchases
- No external execution without approval

---

## ✅ Completed Features

### Part 1: AI Integration Layer
- **Claude (Anthropic)**: Deep reasoning, market analysis, email drafts, opportunity identification
- **OpenAI GPT-4o**: Structured outputs, competitor scans, inventory analysis
- **Hybrid mode**: Both models consulted; Claude synthesizes final intent
- **Auto-fallback**: If primary model fails, automatically switches to secondary

### Part 2: Intent Layer (Core System)
Every AI output is a structured INTENT with:
- `type`: 12 intent types supported
- `summary`: Human-readable one-liner
- `detailedBreakdown`: Full analysis
- `suggestedActions`: 3-5 specific, prioritized actions
- `riskLevel`: low / medium / high
- `requiresApproval: true` — immutable, always true
- `guidance`: Why this matters + What to do next + Expected outcome

### Part 3: Scheduling System
- Daily, Weekly, Bi-weekly, Monthly frequencies
- Pre-seeded defaults: Daily competitor scan, Wednesday market analysis, Saturday product review
- Manual "Run Now" button on each schedule
- Auto-polling every 5 minutes to check for due tasks

### Part 4: Market Research Engine
- Market analysis with trend detection
- Competitor scanning with gap analysis
- Trend reports with rising/declining signals
- Opportunity alerts with estimated value

### Part 5: Product Analysis & Pricing
- Pricing review with competitor comparison
- Risk-aware price adjustment recommendations
- Bundle strategy suggestions
- Product creation ideas with descriptions

### Part 6: Email Automation (Safe Mode)
- Email draft generation (subject lines, body, CTA)
- Campaign suggestions with timing recommendations
- All drafts require explicit approval before sending

### Part 7: Buy/Sell Organization
- Inventory action analysis with restock urgency
- Slow-mover identification
- Restock alerts with cash flow impact

### Part 8: Product Creation
- New product idea generation
- Digital product suggestions
- Bundle opportunity identification
- Product descriptions

### Part 9: User Guidance System
Every intent includes step-by-step guidance:
1. **Why This Matters** — business impact explanation
2. **What To Do Next** — specific next action
3. **Expected Outcome** — quantified result

### Part 10: Human Verification Layer
- [Approve] — marks intent as approved, user executes manually
- [Modify] — add a modification note before approving
- [Reject] — archives the intent
- High-risk intents trigger a confirmation dialog
- "Approve All Low Risk" batch action available

### Part 11: UI/UX
- Sidebar navigation with live pending count badge
- Intent cards with risk color coding (red/amber/green)
- Priority indicators (1-5 dots)
- Detailed intent modal with full guidance
- Dashboard with stats, quick generate, recent intents
- Schedule manager with calendar UI
- AI Routing visualization table
- Business profile personalization
- Toast notifications
- Shimmer loading states

### Part 12: Safety Rules
- `requiresApproval: true` is hardcoded and immutable
- No API calls executed without user trigger
- No financial operations in code
- Demo mode works without any API keys

### Part 13: Personalization
- Business profile: niche, pricing style, focus categories
- AI uses profile context in every prompt
- More specific profile = more relevant intents

### Part 14: Performance
- Non-blocking UI with async operations
- Background polling every 5 minutes
- In-memory store (upgradeable to Cloudflare D1)
- PM2 process management

---

## 🌐 URLs

- **Production (Cloudflare Pages)**: https://intentiq-6mp.pages.dev
- **GitHub Repo**: https://github.com/mkbrown261/intentiq
- **Health Check**: https://intentiq-6mp.pages.dev/api/health

---

## 📡 API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | System health check |
| GET | `/api/intents` | All intents (filterable by status, type) |
| GET | `/api/intents/stats` | Dashboard statistics |
| GET | `/api/intents/pending` | Pending intents only |
| GET | `/api/intents/:id` | Single intent detail |
| POST | `/api/intents/generate` | Generate new AI intent |
| PATCH | `/api/intents/:id` | Approve/Reject/Modify intent |
| DELETE | `/api/intents/:id` | Delete intent |
| GET | `/api/schedules` | All schedules |
| POST | `/api/schedules` | Create new schedule |
| PATCH | `/api/schedules/:id` | Update schedule |
| POST | `/api/schedules/:id/run` | Manually run schedule now |
| POST | `/api/schedules/run-due` | Process all due tasks |
| DELETE | `/api/schedules/:id` | Delete schedule |
| GET | `/api/profile` | Get business profile |
| PATCH | `/api/profile` | Update business profile |

### Intent Types
`market_analysis` · `pricing_update` · `product_creation` · `email_draft` · `inventory_action` · `competitor_scan` · `trend_report` · `bundle_suggestion` · `restock_alert` · `campaign_suggestion` · `performance_review` · `opportunity_alert`

---

## 🤖 AI Configuration

Add API keys to production via Cloudflare secrets:
```bash
npx wrangler pages secret put ANTHROPIC_API_KEY --project-name webapp
npx wrangler pages secret put OPENAI_API_KEY --project-name webapp
```

For local dev, create `.dev.vars`:
```
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
```

**Without API keys**: System runs in Demo Mode with rich pre-built intent examples.

---

## 🛠️ Tech Stack

- **Backend**: Hono v4 + TypeScript
- **Runtime**: Cloudflare Pages/Workers
- **Frontend**: Vanilla JS + Tailwind CSS (CDN)
- **AI**: Anthropic Claude 3.5 Haiku + OpenAI GPT-4o Mini
- **Build**: Vite + @hono/vite-build
- **Process**: PM2
- **Storage**: In-memory (upgradeable to Cloudflare D1)

---

## 🚀 Deployment

```bash
# Local dev
npm run build && pm2 start ecosystem.config.cjs

# Deploy to Cloudflare Pages
npm run deploy
```

---

## 📋 Recommended Next Steps

1. **Add API keys** — Connect real Anthropic/OpenAI for live AI analysis
2. **Cloudflare D1** — Replace in-memory store with persistent SQLite database
3. **Real market data** — Connect to product search APIs for real competitor data
4. **Email integration** — Connect to SendGrid/Mailgun to execute approved email drafts
5. **Webhook support** — Trigger intents from external events (Shopify, WooCommerce)
6. **Export to CSV** — Allow exporting approved intents as action checklists

---

## 📊 Data Architecture

- **Intent Model**: Full structured type with guidance, risk, actions, metadata
- **Schedule Model**: Frequency + day + hour + AI model routing
- **User Profile**: Niche, pricing style, categories, budget, AI preference
- **Storage**: In-memory Map (server restart resets — upgrade to D1 for persistence)

---

**Deployment Status**: ✅ Active  
**Last Updated**: 2026-03-25  
**Version**: 1.0.0
