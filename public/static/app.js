// ============================================================
// IntentIQ — Frontend Application
// ============================================================
// ARCHITECTURAL RULE:
//   This UI ONLY reads intents and submits approval/rejection.
//   It NEVER executes actions directly.
//   ALL intent actions flow through /api/intents/:id (PATCH).
// ============================================================

'use strict';

// ── State ────────────────────────────────────────────────────
const State = {
  currentPage: 'dashboard',
  intents: [],
  schedules: [],
  profile: null,
  stats: null,
  generating: false,
  pollingInterval: null,
  apiKeys: { anthropic: false, openai: false }
};

// ── API Client ───────────────────────────────────────────────
const API = {
  async get(path) {
    const r = await fetch(`/api${path}`);
    return r.json();
  },
  async post(path, body) {
    const r = await fetch(`/api${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    return r.json();
  },
  async patch(path, body) {
    const r = await fetch(`/api${path}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    return r.json();
  },
  async delete(path) {
    const r = await fetch(`/api${path}`, { method: 'DELETE' });
    return r.json();
  }
};

// ── Toast ────────────────────────────────────────────────────
function toast(message, type = 'success') {
  const colors = {
    success: 'bg-emerald-600 text-white',
    error: 'bg-red-600 text-white',
    info: 'bg-violet-600 text-white',
    warning: 'bg-amber-500 text-white'
  };
  const icons = { success: 'fa-check-circle', error: 'fa-times-circle', info: 'fa-info-circle', warning: 'fa-exclamation-triangle' };
  const el = document.createElement('div');
  el.className = `toast flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium ${colors[type]}`;
  el.innerHTML = `<i class="fas ${icons[type]}"></i><span>${message}</span>`;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }, 3000);
}

// ── Navigation ───────────────────────────────────────────────
function navigate(page) {
  State.currentPage = page;
  document.querySelectorAll('[data-nav]').forEach(el => {
    el.classList.toggle('active', el.dataset.nav === page);
    el.classList.toggle('text-white/90', el.dataset.nav === page);
    el.classList.toggle('text-white/70', el.dataset.nav !== page);
  });
  renderPage(page);
}

const pageTitles = {
  dashboard: ['Dashboard', 'AI-powered insights, your decisions'],
  intents: ['Intent Queue', 'All AI-generated recommendations awaiting your review'],
  generate: ['Generate Intent', 'Ask AI to analyze and generate a new recommendation'],
  schedules: ['Schedules', 'Automate AI analysis on a recurring schedule'],
  profile: ['Business Profile', 'Personalize AI recommendations for your business'],
  routing: ['AI Routing', 'See how tasks are routed to Claude and OpenAI']
};

async function renderPage(page) {
  const [title, subtitle] = pageTitles[page] ?? ['Page', ''];
  document.getElementById('page-title').textContent = title;
  document.getElementById('page-subtitle').textContent = subtitle;
  document.getElementById('app-content').innerHTML = '<div class="flex items-center justify-center h-40"><div class="generating-spinner w-8 h-8"></div></div>';
  await loadPageData(page);
}

async function loadPageData(page) {
  await refreshStats();
  if (page === 'dashboard') await renderDashboard();
  else if (page === 'intents') await renderIntentsPage();
  else if (page === 'generate') renderGeneratePage();
  else if (page === 'schedules') await renderSchedulesPage();
  else if (page === 'profile') await renderProfilePage();
  else if (page === 'routing') renderRoutingPage();
}

// ── Stats Refresh ────────────────────────────────────────────
async function refreshStats() {
  try {
    const r = await API.get('/intents/stats');
    if (r.success) {
      State.stats = r.data;
      updatePendingBadge(r.data.pendingIntents);
    }
  } catch (_) {}
}

function updatePendingBadge(count) {
  const badge = document.getElementById('sidebar-pending-badge');
  if (!badge) return;
  if (count > 0) {
    badge.textContent = count;
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
}

// ── AI Status Check ──────────────────────────────────────────
async function checkAIStatus() {
  try {
    const r = await API.get('/health');
    const el = document.getElementById('ai-status');
    if (el && r.status === 'ok') {
      el.innerHTML = '<i class="fas fa-circle text-emerald-500 text-xs"></i><span class="text-emerald-600">AI System Online</span>';
    }
  } catch (_) {
    const el = document.getElementById('ai-status');
    if (el) el.innerHTML = '<i class="fas fa-circle text-amber-400 text-xs"></i><span>Demo Mode</span>';
  }
}

// ============================================================
// DASHBOARD
// ============================================================

async function renderDashboard() {
  const [statsRes, intentsRes] = await Promise.all([
    API.get('/intents/stats'),
    API.get('/intents?limit=5')
  ]);

  const stats = statsRes.data ?? {};
  const recent = intentsRes.data ?? [];
  State.stats = stats;

  document.getElementById('app-content').innerHTML = `
    <!-- Welcome Banner -->
    <div class="bg-gradient-to-r from-violet-600 to-purple-700 rounded-2xl p-6 mb-6 text-white relative overflow-hidden">
      <div class="absolute inset-0 opacity-10">
        <div class="absolute top-2 right-8 text-9xl"><i class="fas fa-brain"></i></div>
      </div>
      <div class="relative">
        <div class="flex items-center gap-2 mb-1">
          <div class="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
          <span class="text-violet-200 text-sm font-medium">Safe Mode — No Automatic Actions</span>
        </div>
        <h2 class="text-2xl font-bold mb-1">Your AI Commerce Brain</h2>
        <p class="text-violet-200 text-sm max-w-xl">IntentIQ thinks, analyzes, and suggests. <strong class="text-white">You decide everything.</strong> No pricing changes, no emails, no purchases happen without your explicit approval.</p>
        <div class="flex gap-3 mt-4">
          <button onclick="navigate('generate')" class="btn bg-white text-violet-700 px-4 py-2 rounded-xl text-sm font-semibold hover:bg-violet-50">
            <i class="fas fa-magic mr-2"></i>Generate Intent
          </button>
          <button onclick="navigate('intents')" class="btn bg-white/20 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-white/30">
            <i class="fas fa-layer-group mr-2"></i>View Queue
          </button>
        </div>
      </div>
    </div>

    <!-- Stats Grid -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      ${statCard('Total Intents', stats.totalIntents ?? 0, 'fa-layer-group', 'violet')}
      ${statCard('Pending Review', stats.pendingIntents ?? 0, 'fa-clock', 'amber', true)}
      ${statCard('Approved Today', stats.approvedToday ?? 0, 'fa-check-circle', 'emerald')}
      ${statCard('High Risk', stats.highRiskPending ?? 0, 'fa-exclamation-triangle', 'red')}
    </div>

    <!-- Two-column layout -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      <!-- Recent Intents -->
      <div class="lg:col-span-2">
        <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div class="flex items-center justify-between mb-4">
            <h3 class="font-semibold text-gray-800">Recent Intents</h3>
            <button onclick="navigate('intents')" class="text-violet-600 text-sm hover:underline">View all</button>
          </div>
          ${recent.length === 0 
            ? `<div class="text-center py-10 text-gray-400">
                <i class="fas fa-inbox text-4xl mb-3 block opacity-40"></i>
                <p class="font-medium">No intents yet</p>
                <p class="text-sm mt-1">Generate your first AI intent to get started</p>
                <button onclick="navigate('generate')" class="mt-4 btn bg-violet-600 text-white px-4 py-2 rounded-xl text-sm">
                  <i class="fas fa-magic mr-2"></i>Generate Now
                </button>
              </div>`
            : recent.map(i => miniIntentCard(i)).join('')
          }
        </div>
      </div>

      <!-- Right Column -->
      <div class="flex flex-col gap-4">

        <!-- Quick Actions -->
        <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h3 class="font-semibold text-gray-800 mb-4">Quick Generate</h3>
          <div class="flex flex-col gap-2">
            ${quickActionBtn('market_analysis', 'fa-chart-line', 'Market Analysis', 'bg-violet-50 text-violet-700', 'Analyze your market trends')}
            ${quickActionBtn('pricing_update', 'fa-tags', 'Pricing Review', 'bg-amber-50 text-amber-700', 'Review competitive pricing')}
            ${quickActionBtn('competitor_scan', 'fa-search', 'Competitor Scan', 'bg-blue-50 text-blue-700', 'Scan competitor moves')}
            ${quickActionBtn('inventory_action', 'fa-boxes', 'Inventory Check', 'bg-emerald-50 text-emerald-700', 'Review stock levels')}
            ${quickActionBtn('email_draft', 'fa-envelope', 'Email Draft', 'bg-pink-50 text-pink-700', 'Generate email campaign')}
          </div>
        </div>

        <!-- Active Schedules -->
        <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div class="flex items-center justify-between mb-3">
            <h3 class="font-semibold text-gray-800">Active Schedules</h3>
            <span class="text-xs bg-violet-100 text-violet-600 px-2 py-0.5 rounded-full">${stats.scheduledTasks ?? 0} active</span>
          </div>
          <div id="dashboard-schedules">
            <div class="shimmer h-10 rounded-lg mb-2"></div>
            <div class="shimmer h-10 rounded-lg mb-2"></div>
            <div class="shimmer h-10 rounded-lg"></div>
          </div>
          <script>loadDashboardSchedules();</script>
        </div>
      </div>
    </div>
  `;

  loadDashboardSchedules();
}

function statCard(label, value, icon, color, pulse = false) {
  const colors = {
    violet: 'from-violet-500 to-purple-600',
    amber: 'from-amber-400 to-orange-500',
    emerald: 'from-emerald-400 to-teal-500',
    red: 'from-red-400 to-rose-500',
    blue: 'from-blue-400 to-indigo-500'
  };
  return `
    <div class="stat-glow bg-white rounded-2xl p-5 border border-gray-100">
      <div class="flex items-center justify-between mb-3">
        <div class="w-10 h-10 rounded-xl bg-gradient-to-br ${colors[color]} flex items-center justify-center">
          <i class="fas ${icon} text-white text-sm"></i>
        </div>
        ${pulse && value > 0 ? '<div class="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></div>' : ''}
      </div>
      <div class="text-2xl font-bold text-gray-800">${value}</div>
      <div class="text-xs text-gray-500 mt-0.5">${label}</div>
    </div>
  `;
}

function quickActionBtn(intentType, icon, label, colorClass, hint) {
  return `
    <button onclick="quickGenerate('${intentType}')" 
      class="btn flex items-center gap-3 p-3 rounded-xl ${colorClass} hover:opacity-80 text-left w-full">
      <i class="fas ${icon} w-4 text-center"></i>
      <div>
        <div class="text-sm font-medium">${label}</div>
        <div class="text-xs opacity-70">${hint}</div>
      </div>
    </button>
  `;
}

async function loadDashboardSchedules() {
  try {
    const r = await API.get('/schedules');
    const el = document.getElementById('dashboard-schedules');
    if (!el) return;
    const active = (r.data ?? []).filter(s => s.isActive).slice(0, 3);
    if (active.length === 0) {
      el.innerHTML = '<p class="text-xs text-gray-400 text-center py-2">No active schedules</p>';
      return;
    }
    el.innerHTML = active.map(s => `
      <div class="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 cursor-pointer mb-1" onclick="navigate('schedules')">
        <div class="w-7 h-7 rounded-lg bg-violet-100 flex items-center justify-center shrink-0">
          <i class="fas fa-clock text-violet-500 text-xs"></i>
        </div>
        <div class="flex-1 min-w-0">
          <div class="text-xs font-medium text-gray-700 truncate">${s.name}</div>
          <div class="text-xs text-gray-400">${formatDate(s.nextRun)}</div>
        </div>
        <span class="text-xs text-emerald-600 font-medium">Active</span>
      </div>
    `).join('');
  } catch (_) {}
}

// ============================================================
// INTENT QUEUE PAGE
// ============================================================

async function renderIntentsPage() {
  const r = await API.get('/intents');
  State.intents = r.data ?? [];

  const types = [...new Set(State.intents.map(i => i.type))];

  document.getElementById('app-content').innerHTML = `
    <!-- Toolbar -->
    <div class="flex flex-wrap items-center gap-3 mb-6">
      <div class="flex gap-1 bg-gray-100 p-1 rounded-xl">
        ${['all', 'pending', 'approved', 'rejected'].map(s =>
          `<button onclick="filterIntents('${s}')" 
            class="tab-btn px-3 py-1.5 rounded-lg text-sm font-medium transition-all text-gray-600 ${s === 'all' ? 'active' : ''}"
            data-tab="${s}">${s.charAt(0).toUpperCase() + s.slice(1)}</button>`
        ).join('')}
      </div>
      <select id="type-filter" onchange="filterIntents()" class="text-sm border border-gray-200 rounded-xl px-3 py-2 text-gray-600 bg-white">
        <option value="">All Types</option>
        ${types.map(t => `<option value="${t}">${formatIntentType(t)}</option>`).join('')}
      </select>
      <div class="ml-auto flex gap-2">
        <button onclick="approveAllPending()" 
          class="btn text-sm bg-emerald-600 text-white px-4 py-2 rounded-xl font-medium hover:bg-emerald-700 hidden" 
          id="approve-all-btn">
          <i class="fas fa-check-double mr-1.5"></i>Approve All Low Risk
        </button>
        <button onclick="navigate('generate')" 
          class="btn text-sm bg-violet-600 text-white px-4 py-2 rounded-xl font-medium hover:bg-violet-700">
          <i class="fas fa-plus mr-1.5"></i>New Intent
        </button>
      </div>
    </div>

    <!-- Intent List -->
    <div id="intents-list">
      ${renderIntentCards(State.intents)}
    </div>
  `;

  checkApproveAllButton();
}

function filterIntents(status) {
  const tabs = document.querySelectorAll('[data-tab]');
  const typeFilter = document.getElementById('type-filter')?.value ?? '';

  let filtered = [...State.intents];

  // Status filter
  const activeTab = status ?? document.querySelector('.tab-btn.active')?.dataset.tab ?? 'all';
  tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === activeTab));
  if (activeTab !== 'all') filtered = filtered.filter(i => i.status === activeTab);

  // Type filter
  if (typeFilter) filtered = filtered.filter(i => i.type === typeFilter);

  document.getElementById('intents-list').innerHTML = renderIntentCards(filtered);
  checkApproveAllButton(filtered);
}

function checkApproveAllButton(intents) {
  const btn = document.getElementById('approve-all-btn');
  if (!btn) return;
  const src = intents ?? State.intents;
  const lowRiskPending = src.filter(i => i.status === 'pending' && i.riskLevel === 'low');
  btn.classList.toggle('hidden', lowRiskPending.length === 0);
}

function renderIntentCards(intents) {
  if (intents.length === 0) {
    return `<div class="text-center py-16 text-gray-400">
      <i class="fas fa-inbox text-5xl mb-4 block opacity-30"></i>
      <p class="font-medium text-gray-500">No intents found</p>
      <p class="text-sm mt-1">Generate a new intent to get started</p>
      <button onclick="navigate('generate')" class="mt-4 btn bg-violet-600 text-white px-4 py-2 rounded-xl text-sm">Generate Intent</button>
    </div>`;
  }

  return intents.map(intent => intentCard(intent)).join('');
}

function intentCard(intent) {
  const typeIcon = getIntentIcon(intent.type);
  const riskClass = `risk-${intent.riskLevel}`;
  const statusClass = `status-${intent.status}`;

  return `
    <div class="intent-card ${riskClass} ${statusClass} bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-4 cursor-pointer hover:shadow-md"
      onclick="openIntentModal('${intent.id}')">
      <div class="flex items-start gap-4">
        
        <!-- Icon -->
        <div class="w-11 h-11 rounded-xl ${getIntentBg(intent.type)} flex items-center justify-center shrink-0">
          <i class="fas ${typeIcon} ${getIntentIconColor(intent.type)}"></i>
        </div>

        <!-- Main Content -->
        <div class="flex-1 min-w-0">
          <div class="flex flex-wrap items-center gap-2 mb-1.5">
            <span class="text-xs font-semibold uppercase tracking-wide text-gray-400">${formatIntentType(intent.type)}</span>
            <span class="risk-badge-${intent.riskLevel} text-xs px-2 py-0.5 rounded-full font-medium">
              ${intent.riskLevel === 'high' ? '⚠️' : intent.riskLevel === 'medium' ? '⚡' : '✓'} ${intent.riskLevel} risk
            </span>
            ${intent.status !== 'pending' 
              ? `<span class="text-xs px-2 py-0.5 rounded-full font-medium ${getStatusBadgeClass(intent.status)}">${intent.status}</span>` 
              : `<span class="pending-badge text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-medium">⏳ awaiting review</span>`}
            <span class="ml-auto text-xs text-gray-400">
              <i class="fas fa-robot mr-1 text-gray-300"></i>${intent.metadata.generatedBy}
            </span>
          </div>
          
          <h3 class="font-semibold text-gray-800 text-sm mb-2 leading-snug">${intent.summary}</h3>
          
          <p class="text-xs text-gray-500 line-clamp-2">${intent.detailedBreakdown?.substring(0, 150)}...</p>

          <!-- Actions Preview -->
          ${intent.suggestedActions.length > 0 ? `
            <div class="flex gap-2 mt-3 flex-wrap">
              ${intent.suggestedActions.slice(0, 2).map(a => 
                `<span class="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-lg">
                  <i class="fas fa-arrow-right text-gray-400 mr-1"></i>${a.label}
                </span>`
              ).join('')}
              ${intent.suggestedActions.length > 2 ? `<span class="text-xs text-gray-400">+${intent.suggestedActions.length - 2} more</span>` : ''}
            </div>
          ` : ''}
        </div>

        <!-- Priority + Time -->
        <div class="text-right shrink-0">
          <div class="priority-${intent.metadata.priority} font-bold text-lg">${'●'.repeat(Math.max(0, 6 - intent.metadata.priority))}<span class="opacity-20">${'●'.repeat(intent.metadata.priority - 1)}</span></div>
          <div class="text-xs text-gray-400 mt-1">${timeAgo(intent.metadata.generatedAt)}</div>
          ${intent.metadata.estimatedValue ? `<div class="text-xs text-emerald-600 font-medium mt-1">${intent.metadata.estimatedValue}</div>` : ''}
        </div>
      </div>

      <!-- Approval Buttons (only for pending) -->
      ${intent.status === 'pending' ? `
        <div class="flex gap-2 mt-4 pt-4 border-t border-gray-100" onclick="event.stopPropagation()">
          <button onclick="approveIntent('${intent.id}')" 
            class="btn flex-1 bg-emerald-600 text-white py-2 rounded-xl text-sm font-medium hover:bg-emerald-700 flex items-center justify-center gap-1.5">
            <i class="fas fa-check"></i> Approve
          </button>
          <button onclick="openModifyModal('${intent.id}')" 
            class="btn flex-1 bg-blue-600 text-white py-2 rounded-xl text-sm font-medium hover:bg-blue-700 flex items-center justify-center gap-1.5">
            <i class="fas fa-edit"></i> Modify
          </button>
          <button onclick="rejectIntent('${intent.id}')" 
            class="btn flex-1 bg-red-50 text-red-600 py-2 rounded-xl text-sm font-medium hover:bg-red-100 flex items-center justify-center gap-1.5">
            <i class="fas fa-times"></i> Reject
          </button>
          <button onclick="openIntentModal('${intent.id}')" 
            class="btn w-10 bg-gray-100 text-gray-600 py-2 rounded-xl text-sm hover:bg-gray-200 flex items-center justify-center">
            <i class="fas fa-info"></i>
          </button>
        </div>
      ` : ''}
    </div>
  `;
}

function miniIntentCard(intent) {
  return `
    <div class="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 cursor-pointer mb-2 group"
      onclick="openIntentModal('${intent.id}')">
      <div class="w-9 h-9 rounded-xl ${getIntentBg(intent.type)} flex items-center justify-center shrink-0">
        <i class="fas ${getIntentIcon(intent.type)} ${getIntentIconColor(intent.type)} text-sm"></i>
      </div>
      <div class="flex-1 min-w-0">
        <div class="text-sm font-medium text-gray-700 truncate">${intent.summary}</div>
        <div class="text-xs text-gray-400 flex items-center gap-2">
          <span>${formatIntentType(intent.type)}</span>
          <span>·</span>
          <span>${timeAgo(intent.metadata.generatedAt)}</span>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <span class="risk-badge-${intent.riskLevel} text-xs px-1.5 py-0.5 rounded-full">${intent.riskLevel}</span>
        <i class="fas fa-chevron-right text-gray-300 text-xs group-hover:text-gray-500"></i>
      </div>
    </div>
  `;
}

// ============================================================
// INTENT MODAL (Detail + Guidance)
// ============================================================

async function openIntentModal(id) {
  const r = await API.get(`/intents/${id}`);
  if (!r.success) return toast('Failed to load intent', 'error');
  const intent = r.data;

  document.getElementById('intent-modal-content').innerHTML = `
    <!-- Header -->
    <div class="bg-gradient-to-r ${getIntentGradient(intent.type)} p-6 rounded-t-2xl">
      <div class="flex items-start justify-between">
        <div class="flex items-center gap-3">
          <div class="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center">
            <i class="fas ${getIntentIcon(intent.type)} text-white text-xl"></i>
          </div>
          <div>
            <div class="text-white/80 text-xs uppercase tracking-wide">${formatIntentType(intent.type)}</div>
            <div class="text-white font-bold text-lg leading-tight max-w-md">${intent.summary}</div>
          </div>
        </div>
        <button onclick="closeIntentModal()" class="text-white/70 hover:text-white ml-4">
          <i class="fas fa-times text-xl"></i>
        </button>
      </div>
      <div class="flex gap-2 mt-4">
        <span class="text-xs bg-white/20 text-white px-2 py-1 rounded-full">
          ${intent.riskLevel === 'high' ? '⚠️ High Risk' : intent.riskLevel === 'medium' ? '⚡ Medium Risk' : '✓ Low Risk'}
        </span>
        <span class="text-xs bg-white/20 text-white px-2 py-1 rounded-full">
          <i class="fas fa-robot mr-1"></i>${intent.metadata.generatedBy}
        </span>
        <span class="text-xs bg-white/20 text-white px-2 py-1 rounded-full">
          ${formatIntentType(intent.metadata.category)}
        </span>
        <span class="ml-auto text-xs bg-white/20 text-white px-2 py-1 rounded-full">
          ${intent.status === 'pending' ? '⏳ Awaiting Review' : intent.status === 'approved' ? '✅ Approved' : '❌ Rejected'}
        </span>
      </div>
    </div>

    <!-- Body -->
    <div class="p-6 space-y-5">

      <!-- Guidance Block (THE GUIDE SYSTEM) -->
      <div class="guidance-block rounded-xl p-4 space-y-3">
        <div class="text-xs uppercase tracking-wide text-violet-500 font-bold mb-1">
          <i class="fas fa-compass mr-1.5"></i>Your Step-by-Step Guide
        </div>
        <div>
          <div class="flex items-center gap-2 mb-1">
            <div class="w-5 h-5 rounded-full bg-violet-500 text-white flex items-center justify-center text-xs font-bold shrink-0">1</div>
            <span class="text-xs font-semibold text-violet-700 uppercase tracking-wide">Why This Matters</span>
          </div>
          <p class="text-sm text-gray-700 ml-7">${intent.guidance.whyThisMatters}</p>
        </div>
        <div>
          <div class="flex items-center gap-2 mb-1">
            <div class="w-5 h-5 rounded-full bg-violet-500 text-white flex items-center justify-center text-xs font-bold shrink-0">2</div>
            <span class="text-xs font-semibold text-violet-700 uppercase tracking-wide">What To Do Next</span>
          </div>
          <p class="text-sm text-gray-700 ml-7">${intent.guidance.whatToDoNext}</p>
        </div>
        <div>
          <div class="flex items-center gap-2 mb-1">
            <div class="w-5 h-5 rounded-full bg-violet-600 text-white flex items-center justify-center text-xs font-bold shrink-0">3</div>
            <span class="text-xs font-semibold text-violet-700 uppercase tracking-wide">Expected Outcome</span>
          </div>
          <p class="text-sm text-emerald-700 font-medium ml-7">${intent.guidance.expectedOutcome}</p>
        </div>
      </div>

      <!-- Detailed Breakdown -->
      <div>
        <h4 class="font-semibold text-gray-800 mb-3 flex items-center gap-2">
          <i class="fas fa-file-alt text-gray-400"></i> Detailed Analysis
        </h4>
        <div class="bg-gray-50 rounded-xl p-4 text-sm text-gray-700 whitespace-pre-line leading-relaxed">${intent.detailedBreakdown}</div>
      </div>

      <!-- Suggested Actions -->
      <div>
        <h4 class="font-semibold text-gray-800 mb-3 flex items-center gap-2">
          <i class="fas fa-tasks text-gray-400"></i> Suggested Actions
          <span class="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full ml-1">Requires your approval</span>
        </h4>
        <div class="space-y-2">
          ${intent.suggestedActions.map((a, idx) => `
            <div class="border border-gray-200 rounded-xl p-3 flex items-start gap-3">
              <div class="w-6 h-6 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center text-xs font-bold shrink-0">${idx + 1}</div>
              <div class="flex-1">
                <div class="font-medium text-sm text-gray-800">${a.label}</div>
                <div class="text-xs text-gray-500 mt-0.5">${a.description}</div>
                <div class="flex items-center gap-3 mt-1.5">
                  <span class="text-xs text-emerald-600"><i class="fas fa-chart-line mr-1"></i>${a.estimatedImpact}</span>
                  <span class="text-xs ${a.reversible ? 'text-blue-500' : 'text-red-500'}">
                    <i class="fas ${a.reversible ? 'fa-undo' : 'fa-exclamation-circle'} mr-1"></i>
                    ${a.reversible ? 'Reversible' : 'Irreversible'}
                  </span>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Tags -->
      <div class="flex flex-wrap gap-1.5">
        ${(intent.metadata.tags ?? []).map(t => `<span class="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">#${t}</span>`).join('')}
        <span class="text-xs text-gray-400 ml-auto">${new Date(intent.metadata.generatedAt).toLocaleString()}</span>
      </div>

      <!-- Modification Note -->
      ${intent.modificationNote ? `
        <div class="bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm text-blue-800">
          <i class="fas fa-edit mr-2"></i><strong>Note:</strong> ${intent.modificationNote}
        </div>
      ` : ''}
    </div>

    <!-- Footer Actions (Human Verification Layer) -->
    ${intent.status === 'pending' ? `
      <div class="border-t border-gray-100 p-5 bg-gray-50 rounded-b-2xl">
        <div class="text-xs text-gray-500 mb-3 text-center">
          <i class="fas fa-lock mr-1 text-gray-400"></i>
          Your decision required — No automatic actions will occur
        </div>
        <div class="flex gap-3">
          <button onclick="approveIntent('${intent.id}'); closeIntentModal();" 
            class="btn flex-1 bg-emerald-600 text-white py-3 rounded-xl font-semibold hover:bg-emerald-700 flex items-center justify-center gap-2">
            <i class="fas fa-check"></i> Approve Intent
          </button>
          <button onclick="openModifyModal('${intent.id}'); closeIntentModal();" 
            class="btn flex-1 bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 flex items-center justify-center gap-2">
            <i class="fas fa-edit"></i> Modify
          </button>
          <button onclick="rejectIntent('${intent.id}'); closeIntentModal();" 
            class="btn flex-1 bg-red-50 text-red-600 py-3 rounded-xl font-semibold hover:bg-red-100 flex items-center justify-center gap-2">
            <i class="fas fa-times"></i> Reject
          </button>
        </div>
      </div>
    ` : `
      <div class="border-t border-gray-100 p-4 bg-gray-50 rounded-b-2xl flex items-center justify-between">
        <span class="${getStatusBadgeClass(intent.status)} text-sm px-3 py-1.5 rounded-xl font-medium">
          ${intent.status === 'approved' ? '✅ You approved this intent' : '❌ You rejected this intent'}
        </span>
        <button onclick="closeIntentModal()" class="text-gray-500 hover:text-gray-700 text-sm">Close</button>
      </div>
    `}
  `;

  document.getElementById('intent-modal').classList.remove('hidden');
}

function closeIntentModal() {
  document.getElementById('intent-modal').classList.add('hidden');
}

// ── Modify Modal ──────────────────────────────────────────────
function openModifyModal(id) {
  const intent = State.intents.find(i => i.id === id);
  if (!intent) return;

  document.getElementById('schedule-modal-content').innerHTML = `
    <div class="p-6">
      <h3 class="font-bold text-gray-800 text-lg mb-1">Modify Intent</h3>
      <p class="text-sm text-gray-500 mb-4">Add a note explaining your modification before approving</p>
      <textarea id="modify-note" 
        class="w-full border border-gray-200 rounded-xl p-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-violet-400 resize-none" 
        rows="4"
        placeholder="e.g., Reduce suggested price change from 10% to 5% only on SKU A..."></textarea>
      <div class="flex gap-3 mt-4">
        <button onclick="submitModify('${id}')" 
          class="btn flex-1 bg-blue-600 text-white py-2.5 rounded-xl font-semibold hover:bg-blue-700">
          <i class="fas fa-check mr-2"></i>Save Modification
        </button>
        <button onclick="closeScheduleModal()" 
          class="btn bg-gray-100 text-gray-600 px-4 py-2.5 rounded-xl hover:bg-gray-200">
          Cancel
        </button>
      </div>
    </div>
  `;
  document.getElementById('schedule-modal').classList.remove('hidden');
}

async function submitModify(id) {
  const note = document.getElementById('modify-note').value.trim();
  if (!note) { toast('Please add a modification note', 'warning'); return; }

  const r = await API.patch(`/intents/${id}`, { status: 'modified', modificationNote: note });
  if (r.success) {
    toast('Intent modified ✏️', 'info');
    closeScheduleModal();
    await reloadIntents();
  } else {
    toast(r.error ?? 'Failed to modify', 'error');
  }
}

// ── Approve / Reject ─────────────────────────────────────────
async function approveIntent(id) {
  const intent = State.intents.find(i => i.id === id);
  if (intent?.riskLevel === 'high') {
    if (!confirm('⚠️ This is a HIGH RISK intent. Are you sure you want to approve it?')) return;
  }
  const r = await API.patch(`/intents/${id}`, { status: 'approved' });
  if (r.success) {
    toast('Intent approved ✅', 'success');
    await reloadIntents();
  } else {
    toast(r.error ?? 'Failed to approve', 'error');
  }
}

async function rejectIntent(id) {
  const r = await API.patch(`/intents/${id}`, { status: 'rejected' });
  if (r.success) {
    toast('Intent rejected ❌', 'info');
    await reloadIntents();
  } else {
    toast(r.error ?? 'Failed to reject', 'error');
  }
}

async function approveAllPending() {
  const pending = State.intents.filter(i => i.status === 'pending' && i.riskLevel === 'low');
  if (pending.length === 0) return;
  if (!confirm(`Approve all ${pending.length} low-risk pending intents?`)) return;
  let count = 0;
  for (const i of pending) {
    const r = await API.patch(`/intents/${i.id}`, { status: 'approved' });
    if (r.success) count++;
  }
  toast(`✅ Approved ${count} intents`, 'success');
  await reloadIntents();
}

async function reloadIntents() {
  const r = await API.get('/intents');
  State.intents = r.data ?? [];
  if (State.currentPage === 'intents') {
    document.getElementById('intents-list').innerHTML = renderIntentCards(State.intents);
  }
  await refreshStats();
}

// ============================================================
// GENERATE INTENT PAGE
// ============================================================

function renderGeneratePage() {
  const intentTypes = [
    { value: 'market_analysis', label: 'Market Analysis', icon: 'fa-chart-line', desc: 'Analyze trends, demand shifts, opportunities', model: 'Claude', color: 'violet' },
    { value: 'pricing_update', label: 'Pricing Review', icon: 'fa-tags', desc: 'Compare prices, suggest adjustments', model: 'Hybrid', color: 'amber' },
    { value: 'competitor_scan', label: 'Competitor Scan', icon: 'fa-search', desc: 'Analyze competitor moves and gaps', model: 'OpenAI', color: 'blue' },
    { value: 'inventory_action', label: 'Inventory Check', icon: 'fa-boxes', desc: 'Restock alerts, slow movers, optimization', model: 'OpenAI', color: 'emerald' },
    { value: 'email_draft', label: 'Email Campaign', icon: 'fa-envelope', desc: 'Generate email drafts and campaigns', model: 'Claude', color: 'pink' },
    { value: 'product_creation', label: 'Product Ideas', icon: 'fa-lightbulb', desc: 'New products, bundles, descriptions', model: 'Claude', color: 'yellow' },
    { value: 'trend_report', label: 'Trend Report', icon: 'fa-fire', desc: 'Rising and declining market trends', model: 'Claude', color: 'red' },
    { value: 'performance_review', label: 'Performance Review', icon: 'fa-tachometer-alt', desc: 'Business health and KPI analysis', model: 'Claude', color: 'indigo' },
    { value: 'opportunity_alert', label: 'Opportunity Hunt', icon: 'fa-gem', desc: 'Identify hidden business opportunities', model: 'Claude', color: 'purple' },
    { value: 'bundle_suggestion', label: 'Bundle Strategy', icon: 'fa-gift', desc: 'Suggest product bundles and combos', model: 'Hybrid', color: 'teal' },
    { value: 'restock_alert', label: 'Restock Alert', icon: 'fa-exclamation-triangle', desc: 'Urgent inventory replenishment needs', model: 'OpenAI', color: 'orange' },
    { value: 'campaign_suggestion', label: 'Campaign Idea', icon: 'fa-bullhorn', desc: 'Marketing campaign recommendations', model: 'Hybrid', color: 'rose' }
  ];

  const colorMap = {
    violet: 'bg-violet-50 border-violet-200 hover:bg-violet-100', amber: 'bg-amber-50 border-amber-200 hover:bg-amber-100',
    blue: 'bg-blue-50 border-blue-200 hover:bg-blue-100', emerald: 'bg-emerald-50 border-emerald-200 hover:bg-emerald-100',
    pink: 'bg-pink-50 border-pink-200 hover:bg-pink-100', yellow: 'bg-yellow-50 border-yellow-200 hover:bg-yellow-100',
    red: 'bg-red-50 border-red-200 hover:bg-red-100', indigo: 'bg-indigo-50 border-indigo-200 hover:bg-indigo-100',
    purple: 'bg-purple-50 border-purple-200 hover:bg-purple-100', teal: 'bg-teal-50 border-teal-200 hover:bg-teal-100',
    orange: 'bg-orange-50 border-orange-200 hover:bg-orange-100', rose: 'bg-rose-50 border-rose-200 hover:bg-rose-100'
  };
  const iconColorMap = {
    violet: 'text-violet-600', amber: 'text-amber-600', blue: 'text-blue-600', emerald: 'text-emerald-600',
    pink: 'text-pink-600', yellow: 'text-yellow-600', red: 'text-red-600', indigo: 'text-indigo-600',
    purple: 'text-purple-600', teal: 'text-teal-600', orange: 'text-orange-600', rose: 'text-rose-600'
  };

  document.getElementById('app-content').innerHTML = `
    <div class="max-w-4xl">
      
      <!-- Info Banner -->
      <div class="bg-violet-50 border border-violet-200 rounded-2xl p-4 mb-6 flex gap-3">
        <div class="text-violet-600 text-xl mt-0.5"><i class="fas fa-shield-alt"></i></div>
        <div>
          <div class="font-semibold text-violet-800 text-sm">Intent Generation — Not Action Execution</div>
          <div class="text-violet-700 text-xs mt-0.5">The AI will analyze your business and generate a structured recommendation. <strong>Nothing will happen automatically.</strong> You review and decide what to do.</div>
        </div>
      </div>

      <!-- Intent Type Selection -->
      <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-4">
        <h3 class="font-semibold text-gray-800 mb-1">Choose Analysis Type</h3>
        <p class="text-sm text-gray-500 mb-4">What would you like the AI to analyze?</p>
        <div class="grid grid-cols-2 md:grid-cols-3 gap-3">
          ${intentTypes.map(t => `
            <button onclick="selectIntentType('${t.value}')" 
              data-type="${t.value}"
              class="intent-type-btn ${colorMap[t.color]} border rounded-xl p-3 text-left transition-all">
              <i class="fas ${t.icon} ${iconColorMap[t.color]} mb-2 block"></i>
              <div class="font-medium text-gray-800 text-sm">${t.label}</div>
              <div class="text-xs text-gray-500 mt-0.5">${t.desc}</div>
              <div class="text-xs mt-2 flex items-center gap-1">
                <i class="fas fa-robot text-gray-400"></i>
                <span class="text-gray-500">via ${t.model}</span>
              </div>
            </button>
          `).join('')}
        </div>
      </div>

      <!-- Context Form -->
      <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-4" id="context-form">
        <h3 class="font-semibold text-gray-800 mb-1">Add Context (Optional)</h3>
        <p class="text-sm text-gray-500 mb-4">The more context you provide, the more personalized the intent will be.</p>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label class="text-xs font-medium text-gray-600 mb-1 block">Product Focus</label>
            <input id="ctx-product" type="text" placeholder="e.g., Shea Moisture Curl Cream"
              class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" />
          </div>
          <div>
            <label class="text-xs font-medium text-gray-600 mb-1 block">Price Range</label>
            <input id="ctx-price" type="text" placeholder="e.g., $15-$45"
              class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" />
          </div>
          <div>
            <label class="text-xs font-medium text-gray-600 mb-1 block">Competitors</label>
            <input id="ctx-competitors" type="text" placeholder="e.g., Amazon, Target, Etsy sellers"
              class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" />
          </div>
          <div>
            <label class="text-xs font-medium text-gray-600 mb-1 block">Current Challenge</label>
            <input id="ctx-challenge" type="text" placeholder="e.g., Sales slowing down this week"
              class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" />
          </div>
        </div>
        <div class="mt-3">
          <label class="text-xs font-medium text-gray-600 mb-1 block">Additional Notes</label>
          <textarea id="ctx-notes" rows="2" placeholder="Any other context that will help the AI..."
            class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 resize-none"></textarea>
        </div>
      </div>

      <!-- Generate Button -->
      <div class="flex items-center gap-3">
        <button onclick="generateIntent()" id="generate-btn"
          class="btn bg-gradient-to-r from-violet-600 to-purple-600 text-white px-8 py-3.5 rounded-xl font-semibold hover:opacity-90 flex items-center gap-3">
          <i class="fas fa-magic"></i>
          <span>Generate Intent</span>
        </button>
        <div id="selected-type-display" class="text-sm text-gray-500">
          <span class="text-gray-400">No type selected — defaults to Market Analysis</span>
        </div>
      </div>

      <!-- Generating Status -->
      <div id="generating-status" class="hidden mt-6 bg-white rounded-2xl border border-violet-200 p-6">
        <div class="flex items-center gap-4">
          <div class="generating-spinner w-10 h-10 shrink-0"></div>
          <div>
            <div class="font-semibold text-gray-800" id="generating-text">Generating intent...</div>
            <div class="text-sm text-gray-500 mt-0.5">AI is analyzing your business data. This will only produce a recommendation — no actions will be taken.</div>
          </div>
        </div>
      </div>
    </div>
  `;
}

let selectedIntentType = 'market_analysis';

function selectIntentType(type) {
  selectedIntentType = type;
  document.querySelectorAll('.intent-type-btn').forEach(btn => {
    btn.classList.toggle('ring-2', btn.dataset.type === type);
    btn.classList.toggle('ring-violet-500', btn.dataset.type === type);
  });
  const label = document.querySelector(`[data-type="${type}"]`)?.querySelector('.font-medium')?.textContent ?? type;
  document.getElementById('selected-type-display').innerHTML = `
    <i class="fas fa-check-circle text-violet-500 mr-1"></i>
    Selected: <strong class="text-violet-700">${label}</strong>
  `;
}

async function generateIntent() {
  if (State.generating) return;
  State.generating = true;

  const btn = document.getElementById('generate-btn');
  const status = document.getElementById('generating-status');
  btn.disabled = true;
  btn.innerHTML = '<div class="generating-spinner w-5 h-5"></div><span>Generating...</span>';
  status?.classList.remove('hidden');

  const context = {
    product: document.getElementById('ctx-product')?.value ?? '',
    priceRange: document.getElementById('ctx-price')?.value ?? '',
    competitors: document.getElementById('ctx-competitors')?.value ?? '',
    challenge: document.getElementById('ctx-challenge')?.value ?? '',
    notes: document.getElementById('ctx-notes')?.value ?? ''
  };

  const animTexts = [
    'AI is analyzing your market...',
    'Building structured recommendations...',
    'Assessing risk levels...',
    'Generating step-by-step guidance...',
    'Almost done...'
  ];
  let textIdx = 0;
  const textInterval = setInterval(() => {
    const el = document.getElementById('generating-text');
    if (el) el.textContent = animTexts[textIdx++ % animTexts.length];
  }, 1500);

  try {
    const r = await API.post('/intents/generate', {
      intentType: selectedIntentType ?? 'market_analysis',
      context
    });

    clearInterval(textInterval);
    State.generating = false;
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-magic"></i><span>Generate Intent</span>';
    status?.classList.add('hidden');

    if (r.success) {
      State.intents.unshift(r.data);
      toast('✅ Intent generated! Redirecting to queue...', 'success');
      setTimeout(() => navigate('intents'), 1000);
    } else {
      toast(r.error ?? 'Generation failed', 'error');
    }
  } catch (err) {
    clearInterval(textInterval);
    State.generating = false;
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-magic"></i><span>Generate Intent</span>';
    status?.classList.add('hidden');
    toast('Network error — please try again', 'error');
  }
}

async function quickGenerate(intentType) {
  const r = await API.post('/intents/generate', { intentType, context: {} });
  if (r.success) {
    State.intents.unshift(r.data);
    toast('✅ Intent generated!', 'success');
    navigate('intents');
  } else {
    toast(r.error ?? 'Failed to generate', 'error');
  }
}

// ============================================================
// SCHEDULES PAGE
// ============================================================

async function renderSchedulesPage() {
  const r = await API.get('/schedules');
  State.schedules = r.data ?? [];

  document.getElementById('app-content').innerHTML = `
    <div class="mb-6 flex items-center justify-between">
      <div>
        <p class="text-sm text-gray-500 mt-1">Schedules generate intents automatically. You still review and approve everything.</p>
      </div>
      <button onclick="openNewScheduleModal()" class="btn bg-violet-600 text-white px-4 py-2.5 rounded-xl font-medium hover:bg-violet-700">
        <i class="fas fa-plus mr-2"></i>New Schedule
      </button>
    </div>

    <!-- Schedule Cards -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      ${State.schedules.map(s => scheduleCard(s)).join('')}
      ${State.schedules.length === 0 ? `
        <div class="col-span-3 text-center py-16 text-gray-400">
          <i class="fas fa-calendar-times text-5xl mb-4 block opacity-30"></i>
          <p class="font-medium">No schedules yet</p>
          <p class="text-sm mt-1">Create a schedule to automate AI analysis</p>
        </div>
      ` : ''}
    </div>

    <!-- Example Schedules Guide -->
    <div class="mt-8 bg-gradient-to-r from-violet-50 to-purple-50 rounded-2xl p-6 border border-violet-100">
      <h4 class="font-semibold text-violet-800 mb-3">
        <i class="fas fa-lightbulb mr-2 text-violet-500"></i>Recommended Schedule Setup
      </h4>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        ${[
          { freq: 'Daily', time: 'Every morning 7am', type: 'Competitor Scan', icon: 'fa-search', note: 'Catch competitor moves before you start your day' },
          { freq: 'Weekly', time: 'Every Wednesday 9am', type: 'Market Analysis', icon: 'fa-chart-line', note: 'Mid-week market pulse for strategic adjustments' },
          { freq: 'Weekly', time: 'Every Saturday 10am', type: 'Performance Review', icon: 'fa-tachometer-alt', note: 'Weekly business health check before the weekend' }
        ].map(rec => `
          <div class="bg-white rounded-xl p-4 border border-violet-100">
            <i class="fas ${rec.icon} text-violet-500 mb-2 block"></i>
            <div class="font-medium text-gray-800 text-sm">${rec.freq}: ${rec.type}</div>
            <div class="text-xs text-violet-600 mt-0.5">${rec.time}</div>
            <div class="text-xs text-gray-500 mt-2">${rec.note}</div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function scheduleCard(s) {
  return `
    <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
      <div class="flex items-start justify-between mb-3">
        <div class="w-10 h-10 rounded-xl ${getIntentBg(s.intentType)} flex items-center justify-center">
          <i class="fas ${getIntentIcon(s.intentType)} ${getIntentIconColor(s.intentType)}"></i>
        </div>
        <div class="flex gap-2">
          <button onclick="runScheduleNow('${s.id}')" title="Run now" class="w-7 h-7 rounded-lg bg-violet-100 text-violet-600 flex items-center justify-center hover:bg-violet-200 text-xs">
            <i class="fas fa-play"></i>
          </button>
          <button onclick="toggleSchedule('${s.id}', ${!s.isActive})" title="Toggle" class="w-7 h-7 rounded-lg ${s.isActive ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 text-gray-400'} flex items-center justify-center hover:opacity-80 text-xs">
            <i class="fas ${s.isActive ? 'fa-pause' : 'fa-play'}"></i>
          </button>
          <button onclick="deleteSchedule('${s.id}')" title="Delete" class="w-7 h-7 rounded-lg bg-red-50 text-red-500 flex items-center justify-center hover:bg-red-100 text-xs">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </div>
      <h3 class="font-semibold text-gray-800 text-sm mb-0.5">${s.name}</h3>
      <p class="text-xs text-gray-500 mb-3">${s.description}</p>
      <div class="flex flex-wrap gap-2 text-xs">
        <span class="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
          <i class="fas fa-sync-alt mr-1"></i>${s.frequency}
          ${s.dayOfWeek ? ` · ${s.dayOfWeek}` : ''}
          ${s.hour !== undefined ? ` · ${s.hour}:00` : ''}
        </span>
        <span class="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
          <i class="fas fa-robot mr-1"></i>${s.aiModel}
        </span>
      </div>
      <div class="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
        <span><i class="fas fa-clock mr-1"></i>Next: ${formatDate(s.nextRun)}</span>
        <span class="${s.isActive ? 'text-emerald-500' : 'text-gray-400'} font-medium">${s.isActive ? '● Active' : '○ Paused'}</span>
      </div>
    </div>
  `;
}

async function runScheduleNow(id) {
  toast('Running scheduled task...', 'info');
  const r = await API.post(`/schedules/${id}/run`, {});
  if (r.success) {
    toast('✅ Intent generated from schedule!', 'success');
    navigate('intents');
  } else {
    toast(r.error ?? 'Failed to run', 'error');
  }
}

async function toggleSchedule(id, isActive) {
  const r = await API.patch(`/schedules/${id}`, { isActive });
  if (r.success) {
    toast(`Schedule ${isActive ? 'activated' : 'paused'}`, 'info');
    await renderSchedulesPage();
  }
}

async function deleteSchedule(id) {
  if (!confirm('Delete this schedule?')) return;
  const r = await API.delete(`/schedules/${id}`);
  if (r.success) {
    toast('Schedule deleted', 'info');
    await renderSchedulesPage();
  }
}

function openNewScheduleModal() {
  document.getElementById('schedule-modal-content').innerHTML = `
    <div class="p-6">
      <h3 class="font-bold text-gray-800 text-lg mb-4">Create New Schedule</h3>
      <div class="space-y-3">
        <div>
          <label class="text-xs font-medium text-gray-600 mb-1 block">Schedule Name *</label>
          <input id="s-name" type="text" placeholder="e.g., Daily Morning Scan"
            class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" />
        </div>
        <div>
          <label class="text-xs font-medium text-gray-600 mb-1 block">Intent Type *</label>
          <select id="s-type" class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400">
            ${[
              ['market_analysis','Market Analysis'],['pricing_update','Pricing Review'],
              ['competitor_scan','Competitor Scan'],['inventory_action','Inventory Check'],
              ['email_draft','Email Draft'],['product_creation','Product Ideas'],
              ['trend_report','Trend Report'],['performance_review','Performance Review'],
              ['opportunity_alert','Opportunity Alert'],['bundle_suggestion','Bundle Strategy'],
              ['restock_alert','Restock Alert'],['campaign_suggestion','Campaign Idea']
            ].map(([v,l]) => `<option value="${v}">${l}</option>`).join('')}
          </select>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-xs font-medium text-gray-600 mb-1 block">Frequency *</label>
            <select id="s-freq" onchange="toggleDaySelect()" class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400">
              <option value="daily">Daily</option>
              <option value="weekly" selected>Weekly</option>
              <option value="biweekly">Bi-weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
          <div id="day-select-wrap">
            <label class="text-xs font-medium text-gray-600 mb-1 block">Day of Week</label>
            <select id="s-day" class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400">
              ${['monday','tuesday','wednesday','thursday','friday','saturday','sunday'].map(d => `<option value="${d}">${d.charAt(0).toUpperCase()+d.slice(1)}</option>`).join('')}
            </select>
          </div>
        </div>
        <div>
          <label class="text-xs font-medium text-gray-600 mb-1 block">Hour (0-23)</label>
          <input id="s-hour" type="number" min="0" max="23" value="9"
            class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" />
        </div>
        <div>
          <label class="text-xs font-medium text-gray-600 mb-1 block">AI Model</label>
          <select id="s-model" class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400">
            <option value="claude">Claude (Anthropic)</option>
            <option value="openai">GPT (OpenAI)</option>
            <option value="hybrid">Hybrid (Best of both)</option>
          </select>
        </div>
      </div>
      <div class="flex gap-3 mt-5">
        <button onclick="saveNewSchedule()" class="btn flex-1 bg-violet-600 text-white py-2.5 rounded-xl font-semibold hover:bg-violet-700">
          <i class="fas fa-calendar-plus mr-2"></i>Create Schedule
        </button>
        <button onclick="closeScheduleModal()" class="btn bg-gray-100 text-gray-600 px-4 py-2.5 rounded-xl hover:bg-gray-200">Cancel</button>
      </div>
    </div>
  `;
  document.getElementById('schedule-modal').classList.remove('hidden');
}

function toggleDaySelect() {
  const freq = document.getElementById('s-freq')?.value;
  const wrap = document.getElementById('day-select-wrap');
  if (wrap) wrap.style.display = (freq === 'daily' || freq === 'monthly') ? 'none' : 'block';
}

async function saveNewSchedule() {
  const name = document.getElementById('s-name')?.value.trim();
  const intentType = document.getElementById('s-type')?.value;
  const frequency = document.getElementById('s-freq')?.value;
  const dayOfWeek = document.getElementById('s-day')?.value;
  const hour = parseInt(document.getElementById('s-hour')?.value ?? '9');
  const aiModel = document.getElementById('s-model')?.value;

  if (!name) { toast('Please enter a schedule name', 'warning'); return; }

  const r = await API.post('/schedules', { name, intentType, frequency, dayOfWeek, hour, aiModel });
  if (r.success) {
    toast('✅ Schedule created!', 'success');
    closeScheduleModal();
    await renderSchedulesPage();
  } else {
    toast(r.error ?? 'Failed to create', 'error');
  }
}

function closeScheduleModal() {
  document.getElementById('schedule-modal').classList.add('hidden');
}

// ============================================================
// PROFILE PAGE
// ============================================================

async function renderProfilePage() {
  const r = await API.get('/profile');
  const p = r.data ?? {};

  document.getElementById('app-content').innerHTML = `
    <div class="max-w-2xl">
      <div class="bg-violet-50 border border-violet-200 rounded-2xl p-4 mb-6">
        <div class="flex gap-2">
          <i class="fas fa-info-circle text-violet-500 mt-0.5"></i>
          <div class="text-sm text-violet-700">
            <strong>Personalization Active.</strong> The AI uses your profile to generate more relevant, niche-specific intents. The more accurate your profile, the better your recommendations.
          </div>
        </div>
      </div>

      <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-5">
        <div>
          <label class="text-xs font-medium text-gray-600 mb-1 block">Business Name</label>
          <input id="p-name" type="text" value="${p.businessName ?? ''}"
            class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" />
        </div>
        <div>
          <label class="text-xs font-medium text-gray-600 mb-1 block">Business Niche</label>
          <input id="p-niche" type="text" value="${p.niche ?? ''}" placeholder="e.g., hair products, electronics, clothing"
            class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" />
          <p class="text-xs text-gray-400 mt-1">Be specific — "natural hair care products" beats "beauty"</p>
        </div>
        <div>
          <label class="text-xs font-medium text-gray-600 mb-1 block">Pricing Style</label>
          <select id="p-pricing" class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400">
            ${['aggressive','moderate','premium'].map(s =>
              `<option value="${s}" ${p.pricingStyle === s ? 'selected' : ''}>${s.charAt(0).toUpperCase()+s.slice(1)}</option>`
            ).join('')}
          </select>
        </div>
        <div>
          <label class="text-xs font-medium text-gray-600 mb-1 block">Focus Categories (comma-separated)</label>
          <input id="p-categories" type="text" value="${(p.focusCategories ?? []).join(', ')}" placeholder="e.g., hair care, accessories, tools"
            class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" />
        </div>
        <div>
          <label class="text-xs font-medium text-gray-600 mb-1 block">Monthly Budget (USD)</label>
          <input id="p-budget" type="number" value="${p.monthlyBudget ?? ''}" placeholder="e.g., 5000"
            class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" />
        </div>
        <div>
          <label class="text-xs font-medium text-gray-600 mb-1 block">Preferred AI Model</label>
          <select id="p-ai" class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400">
            ${['claude','openai','hybrid'].map(m =>
              `<option value="${m}" ${p.preferredAI === m ? 'selected' : ''}>${m.charAt(0).toUpperCase()+m.slice(1)}</option>`
            ).join('')}
          </select>
        </div>
        <div class="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
          <div>
            <div class="text-sm font-medium text-gray-700">Auto-reject high risk intents</div>
            <div class="text-xs text-gray-500">Automatically reject intents marked as high risk</div>
          </div>
          <label class="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" id="p-autoreject" ${p.autoRejectHighRisk ? 'checked' : ''} class="sr-only peer" />
            <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:bg-violet-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
          </label>
        </div>

        <button onclick="saveProfile()" class="btn w-full bg-violet-600 text-white py-3 rounded-xl font-semibold hover:bg-violet-700">
          <i class="fas fa-save mr-2"></i>Save Profile
        </button>
      </div>
    </div>
  `;
}

async function saveProfile() {
  const categories = document.getElementById('p-categories')?.value.split(',').map(s => s.trim()).filter(Boolean) ?? [];
  const updates = {
    businessName: document.getElementById('p-name')?.value.trim(),
    niche: document.getElementById('p-niche')?.value.trim(),
    pricingStyle: document.getElementById('p-pricing')?.value,
    focusCategories: categories,
    monthlyBudget: parseInt(document.getElementById('p-budget')?.value ?? '0') || undefined,
    preferredAI: document.getElementById('p-ai')?.value,
    autoRejectHighRisk: document.getElementById('p-autoreject')?.checked ?? false
  };
  const r = await API.patch('/profile', updates);
  if (r.success) toast('✅ Profile saved! AI will use your new settings.', 'success');
  else toast(r.error ?? 'Failed to save', 'error');
}

// ============================================================
// AI ROUTING PAGE
// ============================================================

function renderRoutingPage() {
  const routingTable = [
    { type: 'market_analysis', model: 'Claude', fallback: 'OpenAI', reason: 'Contextual trend reasoning & narrative analysis', category: 'Research' },
    { type: 'pricing_update', model: 'Hybrid', fallback: 'Claude', reason: 'OpenAI structures data; Claude reasons about risk', category: 'Strategy' },
    { type: 'product_creation', model: 'Claude', fallback: 'OpenAI', reason: 'Creative descriptions & bundle strategies', category: 'Products' },
    { type: 'email_draft', model: 'Claude', fallback: 'OpenAI', reason: 'Natural, persuasive copy with brand voice', category: 'Marketing' },
    { type: 'inventory_action', model: 'OpenAI', fallback: 'Claude', reason: 'Structured inventory pattern analysis', category: 'Operations' },
    { type: 'competitor_scan', model: 'OpenAI', fallback: 'Claude', reason: 'Fast structured price & market comparisons', category: 'Intelligence' },
    { type: 'trend_report', model: 'Claude', fallback: 'OpenAI', reason: 'Macro & micro trend reasoning', category: 'Research' },
    { type: 'bundle_suggestion', model: 'Hybrid', fallback: 'Claude', reason: 'OpenAI scans affinities; Claude creates strategy', category: 'Products' },
    { type: 'restock_alert', model: 'OpenAI', fallback: 'Claude', reason: 'Numeric threshold analysis & structured output', category: 'Operations' },
    { type: 'campaign_suggestion', model: 'Hybrid', fallback: 'Claude', reason: 'Audience segmentation + campaign narratives', category: 'Marketing' },
    { type: 'performance_review', model: 'Claude', fallback: 'OpenAI', reason: 'Multi-dimensional performance synthesis', category: 'Strategy' },
    { type: 'opportunity_alert', model: 'Claude', fallback: 'OpenAI', reason: 'Identifies non-obvious market opportunities', category: 'Strategy' }
  ];

  const modelColors = { 'Claude': 'bg-violet-100 text-violet-700', 'OpenAI': 'bg-emerald-100 text-emerald-700', 'Hybrid': 'bg-amber-100 text-amber-700' };

  document.getElementById('app-content').innerHTML = `
    <div class="mb-6">
      <div class="grid grid-cols-3 gap-4 mb-6">
        ${[
          { model: 'Claude (Anthropic)', icon: 'fa-brain', color: 'violet', desc: 'Long-form reasoning, analysis, creative writing, nuanced recommendations', used: '8 intent types' },
          { model: 'OpenAI GPT-4o', icon: 'fa-bolt', color: 'emerald', desc: 'Structured JSON outputs, pattern matching, numeric analysis, fast scanning', used: '3 intent types' },
          { model: 'Hybrid Mode', icon: 'fa-sync', color: 'amber', desc: 'Both models consulted. Claude synthesizes the final intent recommendation.', used: '3 intent types' }
        ].map(m => `
          <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div class="w-10 h-10 rounded-xl bg-${m.color}-100 flex items-center justify-center mb-3">
              <i class="fas ${m.icon} text-${m.color}-600"></i>
            </div>
            <div class="font-semibold text-gray-800 text-sm">${m.model}</div>
            <div class="text-xs text-gray-500 mt-1">${m.desc}</div>
            <div class="text-xs text-${m.color}-600 font-medium mt-2">${m.used}</div>
          </div>
        `).join('')}
      </div>

      <!-- Routing Table -->
      <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div class="px-5 py-4 border-b border-gray-100">
          <h3 class="font-semibold text-gray-800">Intent → AI Model Routing Table</h3>
          <p class="text-xs text-gray-500 mt-0.5">Each intent type is routed to the most suitable AI model based on task requirements</p>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
              <tr>
                <th class="px-5 py-3 text-left">Intent Type</th>
                <th class="px-5 py-3 text-left">Primary Model</th>
                <th class="px-5 py-3 text-left">Fallback</th>
                <th class="px-5 py-3 text-left">Category</th>
                <th class="px-5 py-3 text-left">Reasoning</th>
              </tr>
            </thead>
            <tbody>
              ${routingTable.map((r, idx) => `
                <tr class="${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'} border-t border-gray-100">
                  <td class="px-5 py-3">
                    <div class="flex items-center gap-2">
                      <i class="fas ${getIntentIcon(r.type)} text-gray-400 w-4 text-center"></i>
                      <span class="font-medium text-gray-700">${formatIntentType(r.type)}</span>
                    </div>
                  </td>
                  <td class="px-5 py-3"><span class="text-xs font-semibold px-2 py-1 rounded-full ${modelColors[r.model]}">${r.model}</span></td>
                  <td class="px-5 py-3"><span class="text-xs text-gray-500">${r.fallback}</span></td>
                  <td class="px-5 py-3"><span class="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">${r.category}</span></td>
                  <td class="px-5 py-3 text-xs text-gray-500 max-w-xs">${r.reason}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Architecture Note -->
      <div class="mt-4 bg-gray-800 text-gray-200 rounded-2xl p-5 text-xs leading-relaxed">
        <div class="text-green-400 font-mono mb-2">// SYSTEM ARCHITECTURE — INTENT LAYER</div>
        <div class="font-mono text-gray-300">
          User Request → <span class="text-violet-300">AI Router</span> → <span class="text-yellow-300">AI Model (Claude/OpenAI)</span> → <span class="text-emerald-300">Intent Generator</span> → <span class="text-blue-300">Intent Store</span> → <span class="text-orange-300">User Review</span><br/>
          <br/>
          <span class="text-red-400">ACTION LAYER: ████████ UNTOUCHED ████████</span><br/>
          No pricing changes | No emails sent | No purchases made | No auto-execution<br/>
          <br/>
          <span class="text-green-400">HUMAN VERIFICATION LAYER: ALWAYS ACTIVE</span><br/>
          requiresApproval: <span class="text-blue-300">true</span> <span class="text-gray-500">// immutable — cannot be overridden</span>
        </div>
      </div>
    </div>
  `;
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

function formatIntentType(type) {
  if (!type) return '';
  return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function timeAgo(isoString) {
  const diff = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatDate(isoString) {
  if (!isoString) return 'N/A';
  const d = new Date(isoString);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function getIntentIcon(type) {
  const icons = {
    market_analysis: 'fa-chart-line', pricing_update: 'fa-tags', product_creation: 'fa-lightbulb',
    email_draft: 'fa-envelope', inventory_action: 'fa-boxes', competitor_scan: 'fa-search',
    trend_report: 'fa-fire', bundle_suggestion: 'fa-gift', restock_alert: 'fa-exclamation-triangle',
    campaign_suggestion: 'fa-bullhorn', performance_review: 'fa-tachometer-alt', opportunity_alert: 'fa-gem'
  };
  return icons[type] ?? 'fa-brain';
}

function getIntentBg(type) {
  const bgs = {
    market_analysis: 'bg-violet-100', pricing_update: 'bg-amber-100', product_creation: 'bg-yellow-100',
    email_draft: 'bg-pink-100', inventory_action: 'bg-emerald-100', competitor_scan: 'bg-blue-100',
    trend_report: 'bg-red-100', bundle_suggestion: 'bg-teal-100', restock_alert: 'bg-orange-100',
    campaign_suggestion: 'bg-rose-100', performance_review: 'bg-indigo-100', opportunity_alert: 'bg-purple-100'
  };
  return bgs[type] ?? 'bg-gray-100';
}

function getIntentIconColor(type) {
  const colors = {
    market_analysis: 'text-violet-600', pricing_update: 'text-amber-600', product_creation: 'text-yellow-600',
    email_draft: 'text-pink-600', inventory_action: 'text-emerald-600', competitor_scan: 'text-blue-600',
    trend_report: 'text-red-600', bundle_suggestion: 'text-teal-600', restock_alert: 'text-orange-600',
    campaign_suggestion: 'text-rose-600', performance_review: 'text-indigo-600', opportunity_alert: 'text-purple-600'
  };
  return colors[type] ?? 'text-gray-600';
}

function getIntentGradient(type) {
  const grads = {
    market_analysis: 'from-violet-600 to-purple-700', pricing_update: 'from-amber-500 to-orange-600',
    product_creation: 'from-yellow-500 to-amber-600', email_draft: 'from-pink-500 to-rose-600',
    inventory_action: 'from-emerald-500 to-teal-600', competitor_scan: 'from-blue-500 to-indigo-600',
    trend_report: 'from-red-500 to-rose-600', bundle_suggestion: 'from-teal-500 to-cyan-600',
    restock_alert: 'from-orange-500 to-red-600', campaign_suggestion: 'from-rose-500 to-pink-600',
    performance_review: 'from-indigo-500 to-violet-600', opportunity_alert: 'from-purple-500 to-violet-600'
  };
  return grads[type] ?? 'from-gray-600 to-gray-700';
}

function getStatusBadgeClass(status) {
  return {
    approved: 'bg-emerald-100 text-emerald-700',
    rejected: 'bg-gray-100 text-gray-500',
    modified: 'bg-blue-100 text-blue-700',
    pending: 'bg-violet-100 text-violet-700'
  }[status] ?? 'bg-gray-100 text-gray-600';
}

// ── Run Due Tasks ─────────────────────────────────────────────
async function runDueTasks() {
  const r = await API.post('/schedules/run-due', {});
  if (r.data?.ran > 0) {
    toast(`✅ ${r.data.ran} scheduled tasks processed`, 'success');
    if (State.currentPage === 'dashboard') await renderDashboard();
  } else {
    toast('No tasks due right now', 'info');
  }
}

// ── Close modals on backdrop click ───────────────────────────
document.getElementById('intent-modal').addEventListener('click', function(e) {
  if (e.target === this) closeIntentModal();
});
document.getElementById('schedule-modal').addEventListener('click', function(e) {
  if (e.target === this) closeScheduleModal();
});

// ── Keyboard shortcuts ────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeIntentModal(); closeScheduleModal(); }
});

// ── Polling (check for due schedules every 5 min) ────────────
function startPolling() {
  State.pollingInterval = setInterval(() => {
    runDueTasks();
    refreshStats();
  }, 5 * 60 * 1000);
}

// ============================================================
// APP INIT
// ============================================================
(async function init() {
  await checkAIStatus();
  await navigate('dashboard');
  startPolling();
})();
