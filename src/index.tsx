// ============================================================
// MAIN APPLICATION ENTRY POINT
// ============================================================
// Intent-Driven E-Commerce AI Automation System
//
// ARCHITECTURAL RULE:
//   - ALL logic communicates ONLY via the INTENT LAYER
//   - The ACTION LAYER is NEVER touched automatically
//   - ALL actions require explicit human verification
// ============================================================

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import type { Env } from './lib/aiService'
import intentRoutes from './routes/intents'
import scheduleRoutes from './routes/schedules'
import profileRoutes from './routes/profile'
import { seedDefaultSchedules } from './lib/store'

// ── Initialize default data ──────────────────────────────────
seedDefaultSchedules()

// ── App Instance ─────────────────────────────────────────────
const app = new Hono<{ Bindings: Env }>()

// ── Global Middleware ────────────────────────────────────────
app.use('*', logger())
app.use('/api/*', cors())

// ── API Routes ───────────────────────────────────────────────
app.route('/api/intents', intentRoutes)
app.route('/api/schedules', scheduleRoutes)
app.route('/api/profile', profileRoutes)

// ── Health Check ─────────────────────────────────────────────
app.get('/api/health', (c) => {
  return c.json({
    status: 'ok',
    system: 'Intent-Driven E-Commerce AI',
    version: '1.0.0',
    architecture: 'INTENT LAYER ONLY — No automatic actions',
    timestamp: new Date().toISOString()
  })
})

// ── Frontend SPA ─────────────────────────────────────────────
// All frontend routes serve the main HTML shell.
// The full UI is rendered by the browser via /static/app.js
// ─────────────────────────────────────────────────────────────
app.get('*', (c) => {
  return c.html(getHTML())
})

// ============================================================
// MAIN HTML SHELL
// ============================================================
function getHTML(): string {
  return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>IntentIQ — AI Commerce Automation</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" />
  <style>
    * { font-family: 'Inter', sans-serif; }
    
    /* ── Scrollbar ────────────────────────────────── */
    ::-webkit-scrollbar { width: 6px; height: 6px; }
    ::-webkit-scrollbar-track { background: #f1f5f9; }
    ::-webkit-scrollbar-thumb { background: #94a3b8; border-radius: 3px; }

    /* ── Sidebar ──────────────────────────────────── */
    .sidebar-item { transition: all 0.15s ease; }
    .sidebar-item:hover { background: rgba(255,255,255,0.12); }
    .sidebar-item.active { background: rgba(255,255,255,0.18); border-left: 3px solid #a78bfa; }

    /* ── Intent Card ──────────────────────────────── */
    .intent-card { 
      transition: all 0.2s ease; 
      border-left: 4px solid transparent;
      animation: slideIn 0.3s ease;
    }
    .intent-card:hover { transform: translateY(-2px); box-shadow: 0 8px 25px rgba(0,0,0,0.08); }
    .intent-card.risk-high { border-left-color: #ef4444; }
    .intent-card.risk-medium { border-left-color: #f59e0b; }
    .intent-card.risk-low { border-left-color: #10b981; }
    .intent-card.status-approved { opacity: 0.75; border-left-color: #10b981; }
    .intent-card.status-rejected { opacity: 0.5; border-left-color: #6b7280; }

    /* ── Pulse animation for pending ─────────────── */
    @keyframes pulse-ring {
      0% { box-shadow: 0 0 0 0 rgba(167,139,250,0.4); }
      70% { box-shadow: 0 0 0 8px rgba(167,139,250,0); }
      100% { box-shadow: 0 0 0 0 rgba(167,139,250,0); }
    }
    .pending-badge { animation: pulse-ring 2s infinite; }

    /* ── Slide in animation ───────────────────────── */
    @keyframes slideIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }

    /* ── Toast ────────────────────────────────────── */
    .toast { 
      transition: all 0.3s ease;
      animation: slideIn 0.3s ease;
    }

    /* ── Button ───────────────────────────────────── */
    .btn { transition: all 0.15s ease; }
    .btn:hover { transform: translateY(-1px); }
    .btn:active { transform: translateY(0); }

    /* ── Shimmer loading ──────────────────────────── */
    .shimmer {
      background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%);
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
    }
    @keyframes shimmer {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }

    /* ── Guidance block ───────────────────────────── */
    .guidance-block {
      background: linear-gradient(135deg, #f0f4ff 0%, #faf5ff 100%);
      border: 1px solid #e0e7ff;
    }

    /* ── Stats card glow ──────────────────────────── */
    .stat-glow { box-shadow: 0 4px 15px rgba(167,139,250,0.15); }

    /* ── Modal overlay ────────────────────────────── */
    .modal-overlay {
      backdrop-filter: blur(4px);
      animation: fadeIn 0.2s ease;
    }
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    .modal-content {
      animation: slideIn 0.3s ease;
    }

    /* ── Risk badge ───────────────────────────────── */
    .risk-badge-high { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; }
    .risk-badge-medium { background: #fffbeb; color: #d97706; border: 1px solid #fde68a; }
    .risk-badge-low { background: #f0fdf4; color: #16a34a; border: 1px solid #bbf7d0; }

    /* ── Priority indicator ───────────────────────── */
    .priority-1 { color: #ef4444; }
    .priority-2 { color: #f59e0b; }
    .priority-3 { color: #3b82f6; }
    .priority-4, .priority-5 { color: #6b7280; }

    /* ── Navigation active ────────────────────────── */
    .nav-active { background: rgba(255,255,255,0.15); }

    /* ── Gradient bg ──────────────────────────────── */
    .gradient-sidebar {
      background: linear-gradient(180deg, #1e1b4b 0%, #312e81 50%, #4c1d95 100%);
    }

    /* ── Tab active ───────────────────────────────── */
    .tab-btn.active {
      background: white;
      color: #4c1d95;
      box-shadow: 0 1px 4px rgba(0,0,0,0.1);
    }

    /* ── Generating spinner ───────────────────────── */
    .generating-spinner {
      border: 3px solid rgba(167,139,250,0.3);
      border-top-color: #7c3aed;
      animation: spin 0.8s linear infinite;
      border-radius: 50%;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  </style>
</head>
<body class="bg-gray-50 text-gray-900 min-h-screen">

<!-- ── TOAST CONTAINER ─────────────────────────────────────── -->
<div id="toast-container" class="fixed top-4 right-4 z-50 flex flex-col gap-2 w-80"></div>

<!-- ── APP WRAPPER ─────────────────────────────────────────── -->
<div class="flex h-screen overflow-hidden">

  <!-- ══════════════════════════════════════════════════════ -->
  <!-- SIDEBAR                                                -->
  <!-- ══════════════════════════════════════════════════════ -->
  <aside class="gradient-sidebar w-64 flex flex-col shrink-0 overflow-y-auto">
    
    <!-- Logo -->
    <div class="p-5 border-b border-white/10">
      <div class="flex items-center gap-3">
        <div class="w-9 h-9 rounded-xl bg-violet-400/30 flex items-center justify-center">
          <i class="fas fa-brain text-violet-200 text-lg"></i>
        </div>
        <div>
          <div class="text-white font-bold text-lg leading-tight">IntentIQ</div>
          <div class="text-violet-300 text-xs">AI Commerce Brain</div>
        </div>
      </div>
    </div>

    <!-- Safety Badge -->
    <div class="mx-3 mt-3 px-3 py-2 rounded-lg bg-green-500/15 border border-green-400/20">
      <div class="flex items-center gap-2">
        <i class="fas fa-shield-alt text-green-400 text-xs"></i>
        <span class="text-green-300 text-xs font-medium">Safe Mode Active</span>
      </div>
      <div class="text-green-400/70 text-xs mt-0.5">No auto-actions ever</div>
    </div>

    <!-- Navigation -->
    <nav class="mt-4 px-2 flex-1">
      <div class="text-violet-400/60 text-xs uppercase tracking-wider px-3 mb-2 font-semibold">Main</div>
      
      <button onclick="navigate('dashboard')" 
        class="sidebar-item active w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-white/90 text-sm mb-1" 
        data-nav="dashboard">
        <i class="fas fa-home w-4 text-center text-violet-300"></i>
        <span>Dashboard</span>
      </button>

      <button onclick="navigate('intents')" 
        class="sidebar-item w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-white/70 text-sm mb-1"
        data-nav="intents">
        <i class="fas fa-layer-group w-4 text-center text-violet-300"></i>
        <span>Intent Queue</span>
        <span id="sidebar-pending-badge" class="ml-auto bg-violet-500 text-white text-xs rounded-full px-1.5 py-0.5 hidden">0</span>
      </button>

      <button onclick="navigate('generate')" 
        class="sidebar-item w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-white/70 text-sm mb-1"
        data-nav="generate">
        <i class="fas fa-magic w-4 text-center text-violet-300"></i>
        <span>Generate Intent</span>
      </button>

      <div class="text-violet-400/60 text-xs uppercase tracking-wider px-3 mb-2 mt-4 font-semibold">Automation</div>

      <button onclick="navigate('schedules')" 
        class="sidebar-item w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-white/70 text-sm mb-1"
        data-nav="schedules">
        <i class="fas fa-calendar-alt w-4 text-center text-violet-300"></i>
        <span>Schedules</span>
      </button>

      <div class="text-violet-400/60 text-xs uppercase tracking-wider px-3 mb-2 mt-4 font-semibold">Settings</div>

      <button onclick="navigate('profile')" 
        class="sidebar-item w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-white/70 text-sm mb-1"
        data-nav="profile">
        <i class="fas fa-user-cog w-4 text-center text-violet-300"></i>
        <span>Business Profile</span>
      </button>

      <button onclick="navigate('routing')" 
        class="sidebar-item w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-white/70 text-sm mb-1"
        data-nav="routing">
        <i class="fas fa-route w-4 text-center text-violet-300"></i>
        <span>AI Routing</span>
      </button>
    </nav>

    <!-- Safety Rule Footer -->
    <div class="p-3 border-t border-white/10">
      <div class="text-center text-violet-400/50 text-xs">
        <i class="fas fa-lock mr-1"></i>
        All actions require your approval
      </div>
    </div>
  </aside>

  <!-- ══════════════════════════════════════════════════════ -->
  <!-- MAIN CONTENT                                           -->
  <!-- ══════════════════════════════════════════════════════ -->
  <main class="flex-1 overflow-y-auto bg-gray-50">
    
    <!-- Top Bar -->
    <header class="bg-white border-b border-gray-200 px-6 py-3.5 flex items-center justify-between sticky top-0 z-10">
      <div>
        <h1 id="page-title" class="text-lg font-semibold text-gray-800">Dashboard</h1>
        <p id="page-subtitle" class="text-xs text-gray-500">AI-powered insights, your decisions</p>
      </div>
      <div class="flex items-center gap-3">
        <div id="ai-status" class="flex items-center gap-1.5 text-xs text-gray-500 bg-gray-100 px-3 py-1.5 rounded-full">
          <i class="fas fa-circle text-gray-400 text-xs"></i>
          <span>Checking AI...</span>
        </div>
        <button onclick="runDueTasks()" title="Run scheduled tasks" 
          class="btn w-8 h-8 rounded-full bg-violet-100 text-violet-600 flex items-center justify-center hover:bg-violet-200">
          <i class="fas fa-sync-alt text-xs"></i>
        </button>
      </div>
    </header>

    <!-- Page Content -->
    <div id="app-content" class="p-6">
      <!-- Rendered by JavaScript -->
    </div>
  </main>
</div>

<!-- ══════════════════════════════════════════════════════════ -->
<!-- INTENT DETAIL MODAL                                        -->
<!-- ══════════════════════════════════════════════════════════ -->
<div id="intent-modal" class="fixed inset-0 z-50 hidden modal-overlay bg-black/40 flex items-center justify-center p-4">
  <div class="modal-content bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
    <div id="intent-modal-content"></div>
  </div>
</div>

<!-- ══════════════════════════════════════════════════════════ -->
<!-- SCHEDULE MODAL                                             -->
<!-- ══════════════════════════════════════════════════════════ -->
<div id="schedule-modal" class="fixed inset-0 z-50 hidden modal-overlay bg-black/40 flex items-center justify-center p-4">
  <div class="modal-content bg-white rounded-2xl shadow-2xl w-full max-w-lg">
    <div id="schedule-modal-content"></div>
  </div>
</div>

<script src="/static/app.js"></script>
</body>
</html>`
}

export default app
