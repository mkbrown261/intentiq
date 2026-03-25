# IntentIQ OS — AI Business Operating System v5.0

## Project Overview
- **Name**: IntentIQ OS
- **Goal**: Platform-owned AI business advisor for e-commerce. Generates intents (recommendations) that require human approval before execution. No actions are automatic.
- **Architecture**: Agents → Intent Layer → Human Approval → Action Layer
- **Safe Mode**: Always on. Nothing executes without your approval.

## URLs
- **Production**: https://intentiq-6mp.pages.dev (also https://7ff37801.intentiq-6mp.pages.dev)
- **GitHub**: https://github.com/mkbrown261/intentiq
- **Health Check**: https://intentiq-6mp.pages.dev/api/health

## API Endpoints

### Auth
- `POST /api/auth/register` — Create account
- `POST /api/auth/login` — Login
- `GET  /api/auth/me` — Current user + token status
- `POST /api/auth/logout` — Logout

### Intents
- `GET  /api/intents` — List intents (filter: status, type, agent, priority)
- `POST /api/intents/generate` — Generate AI intent (token-gated)
- `PATCH /api/intents/:id` — Approve/reject/modify intent
- `DELETE /api/intents/:id` — Delete intent

### Chat
- `POST /api/chat/message` — Send chat message (500 tokens/msg)
- `GET  /api/chat/tokens` — Token status for current user
- `GET  /api/chat/history` — Chat history

### Admin (platform owner)
- `GET  /api/admin/profit` — Profit dashboard (revenue, cost, margin per user)
- `GET  /api/admin/stats` — Platform stats (users, MRR, token usage)
- `GET  /api/admin/abuse` — Active abuse flags
- `GET  /api/admin/users` — User list with subscription status
- `GET  /api/admin/usage-breakdown` — Per-feature AI cost breakdown
- `DELETE /api/admin/cache` — Clear expired response cache

### Schedules
- `POST /api/schedules` — Create recurring AI task
- `POST /api/schedules/:id/run` — Manual run (token-gated)
- `POST /api/schedules/run-due` — Process all due tasks (token-gated)

## Subscription Tiers

| Tier    | Price  | Monthly Tokens | Daily Tokens | Agents | Scheduling |
|---------|--------|---------------|--------------|--------|------------|
| Free    | $0     | 10,000        | 2,000        | 2      | No         |
| Starter | $10/mo | 1,200,000     | 40,000       | 5      | Yes        |
| Pro     | $30/mo | 3,600,000     | 120,000      | 7      | Yes + Advanced |
| Scale   | $100/mo| 12,000,000    | 400,000      | 7      | Yes + Advanced |

## Token Economy
- **Baseline**: $0.0025 per 1,000 tokens (platform cost)
- **Intent Generation**: 2,000 tokens
- **Chat Message**: 500 tokens
- **Schedule Run**: 2,000 tokens
- **80% profit buffer**: Only 80% of monthly tokens are spendable
- **Daily cap**: Enforced per plan; resets midnight UTC

## Anti-Abuse System
- Bot user-agent detection
- Rate limiting (>20 req/min → throttle)
- Duplicate request detection (same hash >5x/hour)
- Cooldown periods between requests per plan
- Auto-flagging with severity levels: `warning` → `throttled` → `banned`
- Admin can resolve or ban users via `/api/admin/abuse`

## Profit Tracking
- Per-user cost tracked in `profit_tracking` table
- Actual AI token costs logged in `token_usage` table
- Admin dashboard shows: total revenue, total cost, profit margin, per-user P&L
- High-cost user alerts (unprofitable users flagged automatically)

## Data Architecture
### Database: Cloudflare D1 (intentiq-production)
**Tables**: users, sessions, plans, subscriptions, token_ledger, token_usage,
daily_token_usage, request_log, abuse_flags, cooldowns, profit_tracking,
response_cache, chat_messages, onboarding, user_profiles

### In-Memory Stores (Agents/Intents)
Agents, Intents, Workflows, Schedules, Business Profile, Health Score, Insights,
AgentLogs — all in-memory Maps with seed data.

## AI Service Layer
- All AI calls route through `src/lib/platform.ts`
- Platform-owned keys (ANTHROPIC_API_KEY, OPENAI_API_KEY) — users never see these
- Model routing: Claude for analysis/intent, GPT-4o-mini for chat (cheapest viable)
- Token compression: trims prompts to <3,000 chars
- Response cache: 1h TTL (6h for market data)
- Demo fallback: works without any API key with realistic mock data

## Deployment
- **Platform**: Cloudflare Pages
- **Status**: ✅ Active — v5.0.0
- **DB**: intentiq-production (D1, aed205f4-2693-48a5-b2e2-0b83cd54859f)
- **Migrations**: 0001–0004 applied (local + remote)
- **Tech Stack**: Hono + TypeScript + TailwindCSS + Cloudflare D1
- **Last Updated**: 2026-03-25

## User Guide
1. **Login**: Use `demo@intentiq.com` / `demo1234` or register
2. **Review Today's Priorities**: AI agents generate pending intents automatically
3. **Approve/Reject Intents**: Click any intent card to review and decide
4. **Generate Intent**: Click "Generate" → pick agent + intent type → review
5. **Chat Assistant**: Corner bubble (💬) — ask questions about your business
6. **My Usage**: View token consumption, daily limits, plan comparison
7. **Admin Panel**: Platform owners see profit dashboard + abuse monitoring

## Required User Actions (for production)
1. `npx wrangler pages secret put ANTHROPIC_API_KEY --project-name intentiq`
2. `npx wrangler pages secret put OPENAI_API_KEY --project-name intentiq`
3. `npx wrangler pages secret put JWT_SECRET --project-name intentiq`
4. `npx wrangler pages secret put ADMIN_SECRET --project-name intentiq`
5. Set up Stripe and implement `/api/webhooks/stripe` for real billing
6. Replace XOR password hash with `@node-rs/bcrypt` in `src/lib/auth.ts`
7. Configure email service (Resend/SendGrid) for auth emails
