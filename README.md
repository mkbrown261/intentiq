# IntentIQ OS — AI Business Operating System v4.0

## Project Overview
**IntentIQ OS** is an AI-powered business operating system for e-commerce operators. It uses a multi-agent architecture where AI agents generate structured **INTENT recommendations** that require explicit human approval before any action is taken.

**Architecture Rule:** `Agents → Intent Layer → Human Approval → Action Layer`  
All AI outputs are INTENTS. Nothing executes without your click.

---

## Live URLs
| Environment | URL |
|-------------|-----|
| **Production (Cloudflare Pages)** | https://intentiq-6mp.pages.dev |
| **Sandbox Preview** | https://3000-iv45i4viageqmat5i8o31-8f57ffe2.sandbox.novita.ai |
| **GitHub Repository** | https://github.com/mkbrown261/intentiq |

---

## What's In v4.0

### New in This Version
- **Platform-Owned AI** — OpenAI & Anthropic keys owned by the platform; users never set up API keys
- **Token Economy** — Monthly token allowance per user; deducted per AI request; tracked in D1
- **Subscription Tiers** — Free (10K), Starter (50K), Pro (200K), Enterprise (1M) tokens/month
- **D1 Database** — Full Cloudflare D1 SQLite with 12 tables: users, sessions, plans, subscriptions, token_ledger, token_usage, intents, workflows, schedules, approvals, chat_messages, agent_logs
- **User Auth** — Register/Login/Session via D1 (extensible to bcrypt in production)
- **5-Step Onboarding** — Business setup flow → auto-generates first AI intent on completion
- **Chat Assistant** — Corner bubble chat UI; token-aware; demo replies without API keys
- **Token Gating** — Intent generation checks token budget before calling AI
- **Profit Protection** — 80% usage cap to protect platform margins

### Previously in v3.0
- 7 specialized AI agents (Market, Pricing, Inventory, Email, Product, Health, Strategy)
- 21 intent types with full structured fields
- Workflow Engine with multi-step agent chains
- Scheduling System with recurring tasks (daily/weekly/monthly/quarterly)
- Full Guided UI (Today's Priorities, Intent Queue, Agent Control, Health Dashboard)
- Human Verification Layer (Approve / Modify / Reject)

---

## Architecture

```
User → Onboarding → Business Profile
         ↓
    AI Agent (selects best model via Platform AI)
         ↓
    Intent Generated (structured JSON)
         ↓
    Token Deducted from User Ledger
         ↓
    Intent Queue (status: pending)
         ↓
    Human Reviews: Approve / Modify / Reject
         ↓
    [If Approved] → Human executes manually
                    NO automatic actions
```

---

## Technology Stack
- **Backend:** Hono on Cloudflare Workers
- **Database:** Cloudflare D1 (SQLite)
- **AI:** Platform-managed Claude + OpenAI (via centralized `src/lib/platform.ts`)
- **Frontend:** Vanilla JS + Tailwind CDN + Font Awesome
- **Auth:** Session tokens stored in D1
- **Deploy:** Cloudflare Pages
- **Dev:** wrangler pages dev + PM2

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | System health + version |
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login + get session token |
| GET | `/api/auth/me` | Current user + token status |
| GET | `/api/auth/plans` | All subscription plans |
| GET | `/api/onboarding/status` | Onboarding completion status |
| POST | `/api/onboarding/complete` | Complete onboarding + get first intent |
| POST | `/api/intents/generate` | Generate AI intent (token-gated) |
| GET | `/api/intents` | List intents (filters: status, type, agent) |
| PATCH | `/api/intents/:id` | Approve/Reject/Modify intent |
| GET | `/api/intents/stats` | Dashboard statistics |
| POST | `/api/chat/message` | Chat with AI assistant (token-deducted) |
| GET | `/api/chat/tokens` | Current token usage |
| GET | `/api/agents` | List all agents |
| GET | `/api/workflows` | List workflows |
| POST | `/api/workflows/:id/run-step` | Execute next workflow step |
| GET | `/api/schedules` | List schedules |
| POST | `/api/schedules/run-due` | Run all due scheduled tasks |
| GET | `/api/business/health-score` | Business health score |
| GET | `/api/business/insights` | Business insights |

---

## Subscription Plans

| Plan | Tokens/Month | Chat | Agents | Price |
|------|-------------|------|--------|-------|
| Free | 10,000 | ❌ | 2 | $0 |
| Starter | 50,000 | ✅ | 5 | $29/mo |
| Pro | 200,000 | ✅ | 7 | $79/mo |
| Enterprise | 1,000,000 | ✅ | 7 | $299/mo |

---

## Deployment

### Local Development
```bash
npm run build
pm2 start ecosystem.config.cjs
# Uses D1 local SQLite automatically
```

### Apply Migrations
```bash
# Local
npx wrangler d1 migrations apply intentiq-production --local
# Production
npx wrangler d1 migrations apply intentiq-production --remote
```

### Deploy to Production
```bash
npm run build
npx wrangler pages deploy dist --project-name intentiq
```

### Set AI API Keys (Required for Real AI)
```bash
npx wrangler pages secret put ANTHROPIC_API_KEY --project-name intentiq
npx wrangler pages secret put OPENAI_API_KEY --project-name intentiq
```

---

## Required User Actions Before Go-Live

1. **Anthropic API Key** — Create account at anthropic.com, get API key, set as Cloudflare secret
2. **OpenAI API Key** — Create account at openai.com, get API key, set as Cloudflare secret
3. **Stripe Setup** (for subscriptions) — Integrate Stripe webhook → update `subscriptions` table
4. **Custom Domain** — `npx wrangler pages domain add yourdomain.com --project-name intentiq`
5. **JWT Secret** — Set strong secret: `npx wrangler pages secret put JWT_SECRET --project-name intentiq`
6. **Password Hashing** — Replace demo hash in `src/lib/auth.ts` with bcrypt (install `bcryptjs`)

---

## Safety Enforcement
- `requiresApproval: true` is hardcoded on every intent object
- No financial transactions, pricing changes, email sends, or external API calls execute automatically
- All AI keys are platform-owned and never exposed to users
- Token budget enforced server-side with 80% profit buffer

---

**Last Updated:** 2026-03-25 | **Version:** 4.0.0 | **Status:** ✅ Live
