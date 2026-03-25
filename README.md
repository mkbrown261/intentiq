# IntentIQ OS — AI Business Operating System

**Version:** 5.1.0  
**Architecture:** Agents → Intent Layer → Human Approval → Action Layer  
**Platform:** Cloudflare Pages + D1

---

## 🔗 URLs
- **Production:** https://intentiq-6mp.pages.dev
- **Latest Deploy:** https://a5362b8f.intentiq-6mp.pages.dev
- **GitHub:** https://github.com/mkbrown261/intentiq

---

## ✅ Completed Features (v5.1)

### Core Platform
- **7 AI Agents:** MarketResearch, Pricing, Inventory, EmailMarketing, ProductCreation, BusinessHealth, Strategy
- **22 Intent Types** across all agents (incl. `upgrade_suggestion`)
- **Safe Mode:** Every AI recommendation requires human approval before action
- **Platform-owned AI:** Users never supply or see API keys
- **Hono + Cloudflare D1 + Workers** edge deployment

### Token Economy v2
- **Plans:** Free (10K/mo, 2K/day, $0) · Starter (1.2M/mo, 40K/day, $10) · Pro (3.6M/mo, 120K/day, $30) · Scale (12M/mo, 400K/day, $100)
- **Token costs:** Intent generate 2K · Chat 500 · Analysis 1.5K · Schedule run 2K
- **Daily caps** reset at UTC midnight
- **Cooldowns** by plan (Free: 30s · Starter: 5s · Pro: 2s · Scale: 0s)
- **80% profit buffer** on monthly limits

### Anti-Abuse System
- UA bot detection (curl, wget, scrapy, python-requests, httpx)
- Rate limiting: >20 req/min → throttle + flag
- Duplicate detection: >5 same requests/hr → block
- Severity chain: warning → throttled → banned
- Tables: `abuse_flags`, `cooldowns`, `request_log`

### Conversion Engine (NEW in v5.1)
- **7 trigger types:** token_50, token_80, token_100, feature_lock, value_moment, frequency, success_based
- **UX rules:** Max 1 trigger per check, 5-min cooldown between triggers, never show to premium users (pro/scale)
- **A/B testing:** A/B variants tracked per user, stored in `ab_tests` table
- **Behavioral tracking:** Daily active, feature hits, intent approvals → buffered and batch-sent
- **Personalized copy:** Niche-aware messages (e.g. hair products → pricing insights benefit)

### Upgrade Trigger System
- `token_50`: Light awareness for free users at 50% monthly usage
- `token_80`: Strong suggestion at 80% — all plans except scale
- `token_100`: Hard block with upgrade modal + billing path
- `feature_lock`: Locked feature hit → blurred preview card + benefits + CTA
- `value_moment`: High-value intent generated (pricing_optimization, product_opportunity, etc.) → upsell to higher tier
- `frequency`: Power user pattern detected → scheduling upsell
- `success_based`: User approving multiple intents → scaling automation suggestion

### Chat Assistant — Natural Upgrade Suggestions
- Niche-aware responses (e-commerce context)
- Upgrade mentioned **at most once** per conversation session
- Natural language: "btw, that's a Starter feature" NOT "UPGRADE NOW"
- Context-aware: Scheduling → Starter, Market Research → Starter, Strategy → Pro, Scale hints for high-volume
- Token limit awareness: personalized advice when >70%/80%/95% used

### Frontend — Upgrade UX
- **Inline usage bar:** Non-intrusive token progress bar on Today page (green/amber/red)
- **Trigger banner:** Slides in at top of content area, auto-dismisses after 20s
- **Upgrade modal:** Full-screen modal with plan highlight, benefits grid, CTA for critical triggers
- **Feature lock cards:** Blurred preview + lock overlay + unlock CTA for locked features
- **Locked scheduling card:** Free users on Schedules page see a blurred schedule preview with lock overlay + "Unlock with Starter" CTA
- **Locked advanced agents card:** Free/Starter users on Agents page see blurred StrategyAgent/AdOptimizer preview + "Unlock with Pro" CTA
- **Contextual upgrade CTA:** Inline in Schedules, Agents, Dashboard pages
- **My Usage dashboard:** Monthly + daily bars, plan comparison grid, cost transparency table

### Admin & Profit Dashboard
- `GET /api/admin/profit` — Revenue, cost, profit, margin per period
- `GET /api/admin/stats` — Users, subscriptions, MRR, cache stats
- `GET /api/admin/abuse` — Active flags
- `DELETE /api/admin/cache` — Clear expired cache
- `POST /api/admin/abuse/:id/resolve` — Resolve flag
- Secured by `X-Admin-Key: ADMIN_SECRET`

### Analytics & Tracking
- **Conversion funnel:** `GET /api/upgrade/analytics` — triggers shown, clicks, conversions, revenue
- **A/B results:** Per-variant click-through and conversion rates
- Tables: `upgrade_trigger_events`, `conversion_events`, `ab_tests`
- Platform milestone logging: 50%/80% crossing events stored for all plans

---

## 🗄️ Database Schema (D1 — 16 tables)

| Table | Purpose |
|-------|---------|
| users | User accounts |
| sessions | Auth tokens |
| subscriptions | Plan assignments |
| plans | Tier definitions (Free/Starter/Pro/Scale) |
| token_ledger | Monthly token grants + usage |
| daily_token_usage | Per-day usage tracking |
| request_log | Full request audit log |
| abuse_flags | Anti-abuse flags |
| cooldowns | Per-user cooldown state |
| profit_tracking | Per-user P&L per period |
| response_cache | AI response caching |
| chat_messages | Chat history |
| onboarding | Onboarding state |
| user_profiles | Business profile data |
| upgrade_trigger_events | Trigger log + action tracking |
| conversion_events | Conversion + A/B tracking |
| ab_tests | A/B test definitions |

---

## 🔌 API Routes

| Route | Description |
|-------|-------------|
| `GET /api/health` | System status |
| `POST /api/auth/register` | Register user |
| `POST /api/auth/login` | Login |
| `GET /api/auth/me` | Current user + token status |
| `GET /api/intents` | List intents (filters: status, type, agent) |
| `POST /api/intents/generate` | Generate intent (token-gated) |
| `PATCH /api/intents/:id` | Approve/reject/modify intent |
| `GET /api/chat/message` | Chat with AI assistant |
| `GET /api/chat/tokens` | Current token status |
| `GET /api/upgrade/check` | Evaluate upgrade triggers |
| `POST /api/upgrade/feature-lock` | Feature access trigger |
| `POST /api/upgrade/intent-value` | Post-intent value trigger |
| `POST /api/upgrade/behavior` | Log behavior event |
| `POST /api/upgrade/action` | Record trigger click/dismiss |
| `GET /api/upgrade/analytics` | Conversion funnel data |
| `GET /api/admin/profit` | Profit dashboard (admin) |
| `GET /api/admin/stats` | Platform stats (admin) |

---

## 🚀 Deployment

### Apply D1 migrations (production)
```bash
npx wrangler d1 migrations apply intentiq-production
```

### Set required secrets
```bash
npx wrangler pages secret put ANTHROPIC_API_KEY --project-name intentiq
npx wrangler pages secret put OPENAI_API_KEY --project-name intentiq
npx wrangler pages secret put JWT_SECRET --project-name intentiq      # openssl rand -hex 32
npx wrangler pages secret put ADMIN_SECRET --project-name intentiq
```

### Deploy
```bash
npm run build
npx wrangler pages deploy dist --project-name intentiq
```

---

## ⚠️ Not Production-Ready

| Issue | Severity | Fix |
|-------|----------|-----|
| Password hashing uses XOR (not bcrypt) | HIGH | Replace with `@node-rs/bcrypt` |
| No Stripe billing integration | HIGH | Implement `/api/webhooks/stripe` |
| No email verification | MEDIUM | Add via Resend/SendGrid |
| AI keys not set in production | HIGH | See secrets setup above |
| In-memory stores (agents/workflows) reset on deploy | MEDIUM | Migrate to D1 |
| No auth rate limiting (brute force) | MEDIUM | Add to auth routes |

---

## 🧰 Tech Stack

- **Backend:** Hono v4 + TypeScript, Cloudflare Workers
- **Database:** Cloudflare D1 (SQLite at edge)
- **Frontend:** Vanilla JS + Tailwind CDN + FontAwesome
- **Build:** Vite + @hono/vite-cloudflare-pages
- **Deploy:** Cloudflare Pages

---

*Last updated: 2026-03-25 · v5.1.0 · commit 9797cdf*
