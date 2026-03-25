// ================================================================
// MAIN APP — AI Business Operating System
// ================================================================
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import type { Env } from './lib/platform'
import intentRoutes    from './routes/intents'
import agentRoutes     from './routes/agents'
import workflowRoutes  from './routes/workflows'
import scheduleRoutes  from './routes/schedules'
import businessRoutes  from './routes/business'
import authRoutes      from './routes/auth'
import chatRoutes      from './routes/chat'
import onboardRoutes   from './routes/onboarding'
import adminRoutes     from './routes/admin'
import upgradeRoutes   from './routes/upgrade'
import { seedSystem } from './lib/store'

seedSystem()

const app = new Hono<{ Bindings: Env }>()

app.use('*', logger())
app.use('/api/*', cors())

app.route('/api/intents',    intentRoutes)
app.route('/api/agents',     agentRoutes)
app.route('/api/workflows',  workflowRoutes)
app.route('/api/schedules',  scheduleRoutes)
app.route('/api/business',   businessRoutes)
app.route('/api/auth',       authRoutes)
app.route('/api/chat',       chatRoutes)
app.route('/api/onboarding', onboardRoutes)
app.route('/api/admin',      adminRoutes)
app.route('/api/upgrade',    upgradeRoutes)

app.get('/api/health', (c) => c.json({
  status: 'ok',
  system: 'IntentIQ OS — AI Business Operating System',
  version: '5.1.0',
  architecture: 'Agents → Intent Layer → Human Approval → Action Layer',
  safeMode: true,
  philosophy: 'Guide, not execute. Suggest, not decide. Human approval required for everything.',
  aiOwnership: 'Platform-managed. Users never supply API keys.',
  agents: 7,
  intentTypes: 22,
  features: ['D1 Database', 'Token Economy v2', 'Anti-Abuse System', 'Profit Dashboard', 'Subscription Tiers', 'Onboarding', 'Chat Assistant', 'Auth', 'Admin Panel', 'Conversion Engine', 'A/B Testing', 'Behavioral Triggers'],
  timestamp: new Date().toISOString()
}))

app.get('*', (c) => c.html(HTML))

export default app

// ================================================================
// FULL APPLICATION HTML SHELL
// ================================================================
const HTML = /* html */`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>IntentIQ OS — AI Business Operating System</title>
<script src="https://cdn.tailwindcss.com"></script>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css"/>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap"/>
<style>
*{font-family:'Inter',sans-serif;}
::-webkit-scrollbar{width:5px;height:5px;}
::-webkit-scrollbar-track{background:#f1f5f9;}
::-webkit-scrollbar-thumb{background:#c4b5fd;border-radius:99px;}

/* Layout */
.sidebar{background:linear-gradient(180deg,#0f0a1e 0%,#1a0f3a 40%,#2d1065 100%);transition:width 0.2s ease;}
.nav-item{transition:all 0.15s;border-left:3px solid transparent;}
.nav-item:hover{background:rgba(255,255,255,0.08);border-left-color:rgba(167,139,250,0.5);}
.nav-item.active{background:rgba(167,139,250,0.15);border-left-color:#a78bfa;}
.nav-section{color:rgba(167,139,250,0.5);font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;padding:0 16px;margin:16px 0 6px;}

/* Intent Cards */
.intent-card{border-left:4px solid transparent;transition:all 0.2s;animation:slideUp 0.3s ease;}
.intent-card:hover{transform:translateY(-2px);box-shadow:0 8px 30px rgba(0,0,0,0.1);}
.intent-card.urgent{border-left-color:#ef4444;}
.intent-card.high{border-left-color:#f59e0b;}
.intent-card.medium{border-left-color:#6366f1;}
.intent-card.low{border-left-color:#10b981;}
.intent-card.approved{opacity:0.7;}
.intent-card.rejected{opacity:0.45;}

/* Animations */
@keyframes slideUp{from{opacity:0;transform:translateY(12px);}to{opacity:1;transform:translateY(0);}}
@keyframes fadeIn{from{opacity:0;}to{opacity:1;}}
@keyframes spin{to{transform:rotate(360deg);}}
@keyframes pulse{0%,100%{opacity:1;}50%{opacity:0.5;}}
@keyframes shimmer{0%{background-position:200% 0;}100%{background-position:-200% 0;}}

.shimmer{background:linear-gradient(90deg,#f1f5f9 25%,#e2e8f0 50%,#f1f5f9 75%);background-size:200% 100%;animation:shimmer 1.4s infinite;}
.spinner{border:3px solid rgba(139,92,246,0.2);border-top-color:#7c3aed;animation:spin 0.7s linear infinite;border-radius:50%;}
.pulse-dot{animation:pulse 2s infinite;}

/* Confidence bar */
.conf-bar{height:4px;border-radius:99px;background:#e2e8f0;}
.conf-fill{height:100%;border-radius:99px;background:linear-gradient(90deg,#7c3aed,#a78bfa);transition:width 0.5s ease;}

/* Health ring */
.health-ring{transform:rotate(-90deg);transform-origin:50% 50%;}

/* Guided step */
.step-badge{width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0;}

/* Modal */
.modal-bg{backdrop-filter:blur(6px);animation:fadeIn 0.2s ease;}
.modal-box{animation:slideUp 0.25s ease;}

/* Priority badge */
.badge-urgent{background:#fef2f2;color:#dc2626;border:1px solid #fecaca;}
.badge-high{background:#fffbeb;color:#d97706;border:1px solid #fde68a;}
.badge-medium{background:#eef2ff;color:#4338ca;border:1px solid #c7d2fe;}
.badge-low{background:#f0fdf4;color:#16a34a;border:1px solid #bbf7d0;}

/* Risk badge */
.risk-high{background:#fef2f2;color:#dc2626;}
.risk-medium{background:#fffbeb;color:#d97706;}
.risk-low{background:#f0fdf4;color:#16a34a;}

/* Tab */
.tab-btn.active{background:white;color:#4c1d95;box-shadow:0 1px 3px rgba(0,0,0,0.1);}

/* Agent card glow */
.agent-glow{box-shadow:0 4px 20px rgba(139,92,246,0.12);}

/* Workflow step line */
.step-line{width:2px;background:#e2e8f0;margin:0 auto;}
.step-line.done{background:#a78bfa;}

/* Gradient header */
.page-header{background:linear-gradient(135deg,#1a0f3a 0%,#2d1065 100%);}

/* Stat card */
.stat-card{transition:transform 0.15s;}
.stat-card:hover{transform:translateY(-2px);}

/* Toast */
.toast{animation:slideUp 0.3s ease;max-width:320px;}

/* Safe badge */
.safe-badge{background:rgba(16,185,129,0.15);border:1px solid rgba(16,185,129,0.3);}

/* Button active press state — all interactive buttons */
button:not(:disabled):active{transform:scale(0.97);}
button:disabled{cursor:not-allowed;opacity:0.6;}

/* Input focus ring consistency */
input:focus, select:focus, textarea:focus{
  outline:none;
  box-shadow:0 0 0 3px rgba(139,92,246,0.2);
  border-color:#8b5cf6 !important;
  transition:box-shadow 0.15s, border-color 0.15s;
}

/* Filter tab active state */
.filter-btn{background:transparent;border:1px solid transparent;transition:all 0.15s;}
.filter-btn:hover{background:#f3f4f6;border-color:#e5e7eb;}
.filter-btn.active{background:white;color:#4c1d95;border-color:#ddd6fe;box-shadow:0 1px 3px rgba(0,0,0,0.1);}

/* Onboarding selection buttons */
.ob-btn{transition:all 0.15s;cursor:pointer;}
.ob-btn:hover{transform:translateY(-1px);box-shadow:0 2px 8px rgba(0,0,0,0.1);}

/* Intent card action buttons */
.intent-card button:not(:disabled):hover{filter:brightness(0.95);}

/* Card hover */
.card-hover{transition:transform 0.15s, box-shadow 0.15s;}
.card-hover:hover{transform:translateY(-2px);box-shadow:0 8px 30px rgba(0,0,0,0.1);}

/* Loading skeleton */
.skeleton{background:linear-gradient(90deg,#f1f5f9 25%,#e2e8f0 50%,#f1f5f9 75%);background-size:200% 100%;animation:shimmer 1.4s infinite;border-radius:8px;}
</style>
</head>
<body class="bg-slate-50 text-gray-900 h-screen overflow-hidden flex">

<!-- TOAST -->
<div id="toasts" class="fixed top-4 right-4 z-[100] flex flex-col gap-2"></div>

<!-- MODAL CONTAINER -->
<div id="modal" class="fixed inset-0 z-50 hidden modal-bg bg-black/50 flex items-center justify-center p-4" onclick="closeModal(event)">
  <div id="modal-box" class="modal-box bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto"></div>
</div>

<!-- ══════════════════════ SIDEBAR ══════════════════════════════ -->
<aside id="sidebar" class="sidebar w-[220px] flex flex-col shrink-0 h-screen overflow-y-auto">

  <!-- Logo -->
  <div class="p-4 border-b border-white/10">
    <div class="flex items-center gap-2.5">
      <div class="w-8 h-8 rounded-xl bg-violet-500/30 flex items-center justify-center">
        <i class="fas fa-brain text-violet-200 text-sm"></i>
      </div>
      <div>
        <div class="text-white font-bold leading-none text-sm">IntentIQ OS</div>
        <div class="text-violet-400 text-[10px] mt-0.5">AI Business Operating System</div>
      </div>
    </div>
  </div>

  <!-- Safe Mode -->
  <div class="mx-3 mt-3 px-3 py-2 rounded-lg safe-badge">
    <div class="flex items-center gap-1.5">
      <i class="fas fa-shield-alt text-emerald-400 text-xs"></i>
      <span class="text-emerald-300 text-xs font-semibold">Safe Mode Active</span>
    </div>
    <div class="text-[10px] text-emerald-400/60 mt-0.5">All actions need your approval</div>
  </div>

  <!-- Nav -->
  <nav class="flex-1 mt-4 px-2">
    <div class="nav-section">Overview</div>
    <button onclick="nav('today')" data-page="today" class="nav-item active w-full flex items-center gap-2.5 px-3 py-2 rounded-r-lg text-white/90 text-xs mb-0.5">
      <i class="fas fa-sun w-4 text-center text-violet-300"></i><span>Today's Priorities</span>
      <span id="sb-urgent" class="ml-auto text-[10px] bg-red-500 text-white rounded-full px-1.5 hidden">0</span>
    </button>
    <button onclick="nav('dashboard')" data-page="dashboard" class="nav-item w-full flex items-center gap-2.5 px-3 py-2 rounded-r-lg text-white/70 text-xs mb-0.5">
      <i class="fas fa-th-large w-4 text-center text-violet-300"></i><span>Dashboard</span>
    </button>
    <button onclick="nav('intents')" data-page="intents" class="nav-item w-full flex items-center gap-2.5 px-3 py-2 rounded-r-lg text-white/70 text-xs mb-0.5">
      <i class="fas fa-layer-group w-4 text-center text-violet-300"></i><span>Intent Queue</span>
      <span id="sb-pending" class="ml-auto text-[10px] bg-violet-500 text-white rounded-full px-1.5 hidden">0</span>
    </button>

    <div class="nav-section">AI Agents</div>
    <button onclick="nav('agents')" data-page="agents" class="nav-item w-full flex items-center gap-2.5 px-3 py-2 rounded-r-lg text-white/70 text-xs mb-0.5">
      <i class="fas fa-robot w-4 text-center text-violet-300"></i><span>Agent Control</span>
    </button>
    <button onclick="nav('generate')" data-page="generate" class="nav-item w-full flex items-center gap-2.5 px-3 py-2 rounded-r-lg text-white/70 text-xs mb-0.5">
      <i class="fas fa-magic w-4 text-center text-violet-300"></i><span>Generate Intent</span>
    </button>

    <div class="nav-section">Automation</div>
    <button onclick="nav('workflows')" data-page="workflows" class="nav-item w-full flex items-center gap-2.5 px-3 py-2 rounded-r-lg text-white/70 text-xs mb-0.5">
      <i class="fas fa-project-diagram w-4 text-center text-violet-300"></i><span>Workflows</span>
    </button>
    <button onclick="nav('schedules')" data-page="schedules" class="nav-item w-full flex items-center gap-2.5 px-3 py-2 rounded-r-lg text-white/70 text-xs mb-0.5">
      <i class="fas fa-calendar-alt w-4 text-center text-violet-300"></i><span>Schedules</span>
    </button>

    <div class="nav-section">Business</div>
    <button onclick="nav('health')" data-page="health" class="nav-item w-full flex items-center gap-2.5 px-3 py-2 rounded-r-lg text-white/70 text-xs mb-0.5">
      <i class="fas fa-heartbeat w-4 text-center text-violet-300"></i><span>Health Score</span>
    </button>
    <button onclick="nav('profile')" data-page="profile" class="nav-item w-full flex items-center gap-2.5 px-3 py-2 rounded-r-lg text-white/70 text-xs mb-0.5">
      <i class="fas fa-store w-4 text-center text-violet-300"></i><span>Business Profile</span>
    </button>
    <button onclick="nav('logs')" data-page="logs" class="nav-item w-full flex items-center gap-2.5 px-3 py-2 rounded-r-lg text-white/70 text-xs mb-0.5">
      <i class="fas fa-terminal w-4 text-center text-violet-300"></i><span>Agent Logs</span>
    </button>

    <div class="nav-section">Platform</div>
    <button onclick="nav('usage')" data-page="usage" class="nav-item w-full flex items-center gap-2.5 px-3 py-2 rounded-r-lg text-white/70 text-xs mb-0.5">
      <i class="fas fa-chart-bar w-4 text-center text-violet-300"></i><span>My Usage</span>
    </button>
    <button onclick="nav('admin')" data-page="admin" class="nav-item w-full flex items-center gap-2.5 px-3 py-2 rounded-r-lg text-white/70 text-xs mb-0.5">
      <i class="fas fa-shield-alt w-4 text-center text-violet-300"></i><span>Admin Panel</span>
    </button>
  </nav>

  <div class="p-3 border-t border-white/10 text-center text-[10px] text-violet-500/50">
    <i class="fas fa-lock mr-1"></i>Human approval required for all actions
  </div>
</aside>

<!-- ══════════════════════ MAIN ══════════════════════════════════ -->
<div class="flex-1 flex flex-col h-screen overflow-hidden">

  <!-- Top Bar -->
  <header class="bg-white border-b border-gray-200 px-5 py-3 flex items-center justify-between shrink-0 z-10">
    <div>
      <h1 id="page-title" class="text-base font-bold text-gray-800">Today's Priorities</h1>
      <p id="page-sub" class="text-[11px] text-gray-400 mt-0.5">AI-guided daily action plan</p>
    </div>
    <div class="flex items-center gap-2">
      <div id="ai-pill" class="flex items-center gap-1.5 text-[11px] bg-gray-100 text-gray-500 px-3 py-1.5 rounded-full">
        <span class="w-1.5 h-1.5 rounded-full bg-gray-300 inline-block"></span>Checking...
      </div>
      <button onclick="runDue()" title="Process scheduled tasks"
        class="w-8 h-8 rounded-full bg-violet-100 text-violet-600 flex items-center justify-center hover:bg-violet-200 transition-colors text-xs">
        <i class="fas fa-sync-alt"></i>
      </button>
      <button onclick="nav('generate')"
        class="flex items-center gap-1.5 bg-violet-600 text-white px-3 py-1.5 rounded-xl text-xs font-semibold hover:bg-violet-700 transition-colors">
        <i class="fas fa-magic"></i> Generate
      </button>
    </div>
  </header>

  <!-- Content -->
  <main id="content" class="flex-1 overflow-y-auto p-5"></main>
</div>

<script src="/static/app.js"></script>
</body>
</html>`
