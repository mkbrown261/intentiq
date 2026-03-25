# IntentIQ OS — AI Business Operating System v3.0

## What It Is
A **guided, human-in-the-loop AI operating system** for e-commerce and reselling. It is NOT a dashboard that auto-executes — it is a **COO that thinks, suggests, and waits for your approval** before anything happens.

**Core rule: Agents → Intent Layer → Human Approval → Action Layer.**  
Nothing ever executes automatically. Every recommendation is an **INTENT** that you must Approve, Modify, or Reject.

---

## Live URLs
- **Production (Cloudflare Pages):** https://intentiq-6mp.pages.dev
- **GitHub Repository:** https://github.com/mkbrown261/intentiq
- **Sandbox Preview:** https://3000-iv45i4viageqmat5i8o31-8f57ffe2.sandbox.novita.ai

---

## Features Completed

### Phase 1 (MVP) ✅
- [x] Intent Layer with full Intent object (type, summary, reasoning, steps, risk, confidence, requiresApproval=TRUE)
- [x] 21 intent types across 5 core categories
- [x] Intent Queue with Approve / Modify / Reject buttons
- [x] In-memory Intent DB with filtering and search
- [x] Today's Priorities page — guided daily action plan
- [x] Inventory Agent + Pricing Agent
- [x] Manual human approval workflow

### Phase 2 ✅
- [x] 7 Specialized AI Agents (Market Research, Pricing, Inventory, Email Marketing, Product Creation, Business Health, Strategy)
- [x] Workflow Engine — multi-step guided business processes (New Product Launch, Inventory Restock, Monthly Marketing Sprint)
- [x] Scheduling Engine — 8 pre-configured recurring tasks (daily, weekly, monthly, quarterly)
- [x] Email Marketing Agent + Market Research Agent
- [x] Business Health Score with area scoring (Inventory, Pricing, Marketing, Products, Operations)
- [x] Agent Control Center — enable/disable agents, view stats
- [x] AI routing: Claude for long-form reasoning, OpenAI for structured output
- [x] Demo Mode — full functionality without API keys

### Phase 2.5 ✅ (This Release)
- [x] Full Guided UI — intent cards with "Why This Matters" blocks, step previews, confidence bars
- [x] Dashboard with business insights, health ring, quick-generate grid
- [x] Intent Queue with filtering (all/pending/approved/rejected/modified) and search
- [x] Workflow Engine UI — progress bars, step-by-step execution, run/delete
- [x] Schedule Manager UI — run now, pause/enable, create/delete schedules
- [x] Business Health full report — score ring, area scores, health alerts
- [x] Business Profile form — personalize niche, pricing style, risk tolerance, top products
- [x] Personalization engine — tracks approval patterns per intent type
- [x] Agent Logs page — real-time activity feed
- [x] Batch approve all low-risk intents
- [x] Auto-seed 3 initial intents on first load

---

## Architecture

```
Agents (7) → Intent Layer → Human Approval Gate → Action Layer (untouched)
```

**Safe Mode:** `requiresApproval: true` is hardcoded on every Intent object — it cannot be set to false.

---

## 7 AI Agents

| Agent | Routing | Intent Types |
|-------|---------|-------------|
| Market Research | Claude (reasoning) | market_trend, market_opportunity, competitor_alert, seasonality_alert |
| Pricing | Hybrid | pricing_adjust, pricing_bundle, pricing_discount, financial_insight |
| Inventory | OpenAI (structured) | inventory_restock, inventory_liquidate, performance_alert |
| Email Marketing | Claude | email_campaign, email_abandoned_cart, email_reengagement, customer_segment |
| Product Creation | Claude | product_create, product_bundle, product_variation |
| Business Health | Hybrid | business_health, performance_alert, financial_insight |
| Strategy | Claude | strategy_review, workflow_suggestion, ad_optimization |

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/health | System health check |
| GET | /api/intents | List all intents (filterable) |
| GET | /api/intents/stats | Dashboard statistics |
| POST | /api/intents/generate | Generate new intent from agent |
| PATCH | /api/intents/:id | Approve / Reject / Modify intent |
| GET | /api/agents | List all agents |
| PATCH | /api/agents/:id | Toggle agent active/inactive |
| GET | /api/workflows | List workflows |
| POST | /api/workflows/:id/run-step | Run next workflow step |
| GET | /api/schedules | List schedules |
| POST | /api/schedules/:id/run | Manually trigger a schedule |
| POST | /api/schedules/run-due | Process all due schedules |
| GET | /api/business/profile | Get business profile |
| PATCH | /api/business/profile | Update profile |
| GET | /api/business/health-score | Get health score |
| GET | /api/business/insights | Get business insights |
| GET | /api/business/logs | Get agent activity logs |

---

## UI Navigation

- **Today's Priorities** — Guided daily action plan (urgent → high → other)
- **Dashboard** — Stats, insights, health ring, quick-generate buttons
- **Intent Queue** — All intents with filter/search, batch approval
- **Agent Control** — Enable/disable agents, generate from any agent
- **Generate Intent** — Pick agent + type + context, get instant analysis
- **Workflows** — Multi-step guided processes with step execution
- **Schedules** — Recurring AI tasks with run/pause/create
- **Health Score** — Business health ring, area scores, alerts
- **Business Profile** — Personalization settings for AI agents
- **Agent Logs** — Real-time activity feed

---

## Using Real AI (Optional)

In demo mode, rich sample intents are generated automatically. To enable real Claude/OpenAI:

```bash
# For Cloudflare Pages (production)
npx wrangler pages secret put ANTHROPIC_API_KEY --project-name intentiq
npx wrangler pages secret put OPENAI_API_KEY --project-name intentiq
npm run build && npx wrangler pages deploy dist --project-name intentiq

# For local development
echo "ANTHROPIC_API_KEY=your-key" >> .dev.vars
echo "OPENAI_API_KEY=your-key" >> .dev.vars
pm2 restart intentiq
```

---

## Phase 3 Roadmap (Not Yet Built)
- [ ] Shopify integration (real product/order data)
- [ ] Forecasting engine (ML-based demand prediction)
- [ ] Ads optimization agent (Google/Meta)
- [ ] Financial insights agent (P&L, margins)
- [ ] Multi-store support
- [ ] Mobile app (React Native)
- [ ] Customer segmentation deep analysis
- [ ] Cloudflare D1 persistence (currently in-memory)

---

## Tech Stack
- **Backend:** Hono v4 + TypeScript on Cloudflare Workers
- **Frontend:** Vanilla JS + Tailwind CSS (CDN) + Font Awesome
- **Build:** Vite + @hono/vite-cloudflare-pages
- **Storage:** In-memory Maps (upgrade to Cloudflare D1 for persistence)
- **AI:** Anthropic Claude 3.5 Haiku + OpenAI GPT-4o Mini (with demo fallback)
- **Deployment:** Cloudflare Pages

---

*Last updated: 2026-03-25 · IntentIQ OS v3.0*
