// ================================================================
// IntentIQ OS — AI Business Operating System
// Frontend v3.0 — Full Guided UI
// ================================================================
'use strict';

// ── State ─────────────────────────────────────────────────────────
const S = {
  page: 'today',
  intents: [],
  agents: [],
  workflows: [],
  schedules: [],
  profile: null,
  health: null,
  stats: null,
  insights: [],
  logs: [],
  generating: false,
  intentFilter: 'all',
  intentSearch: ''
};

// ── API ───────────────────────────────────────────────────────────
const api = {
  get:   async p => { const r = await fetch('/api'+p); return r.json(); },
  post:  async (p,b) => { const r = await fetch('/api'+p,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)}); return r.json(); },
  patch: async (p,b) => { const r = await fetch('/api'+p,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)}); return r.json(); },
  del:   async p => { const r = await fetch('/api'+p,{method:'DELETE'}); return r.json(); }
};

// ── Toast ─────────────────────────────────────────────────────────
const TOAST_CFG = {success:'bg-emerald-600',error:'bg-red-600',info:'bg-violet-600',warning:'bg-amber-500'};
const TOAST_ICO = {success:'fa-check-circle',error:'fa-times-circle',info:'fa-info-circle',warning:'fa-exclamation-triangle'};
function toast(msg, type='success') {
  const el = document.createElement('div');
  el.className = `toast flex items-center gap-2.5 text-white px-4 py-3 rounded-xl shadow-2xl text-sm font-medium ${TOAST_CFG[type]||TOAST_CFG.info} border border-white/20`;
  el.innerHTML = `<i class="fas ${TOAST_ICO[type]||TOAST_ICO.info} shrink-0"></i><span>${msg}</span>`;
  document.getElementById('toasts').appendChild(el);
  setTimeout(()=>{ el.style.opacity='0'; el.style.transform='translateX(20px)'; el.style.transition='all 0.3s'; setTimeout(()=>el.remove(),300); }, 3500);
}

// ── Helpers ───────────────────────────────────────────────────────
function ago(iso) {
  const d = Date.now()-new Date(iso).getTime(), m = Math.floor(d/60000);
  if(m<1) return 'Just now'; if(m<60) return m+'m ago';
  const h = Math.floor(m/60); if(h<24) return h+'h ago';
  return Math.floor(h/24)+'d ago';
}
function fmtDate(iso) { if(!iso) return 'N/A'; return new Date(iso).toLocaleDateString('en-US',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}); }
function fmtDateShort(iso) { if(!iso) return 'N/A'; return new Date(iso).toLocaleDateString('en-US',{month:'short',day:'numeric'}); }
function fmtType(t) { return (t||'').replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase()); }
function getGreeting() { const h=new Date().getHours(); return h<12?'morning':h<17?'afternoon':'evening'; }
function clamp(n,min,max) { return Math.max(min,Math.min(max,n)); }
function esc(s) { return String(s||'').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

// ── Icon / Color Maps ─────────────────────────────────────────────
const INTENT_ICONS={
  inventory_restock:'fa-boxes',inventory_liquidate:'fa-dumpster',
  pricing_adjust:'fa-tags',pricing_bundle:'fa-gift',pricing_discount:'fa-percent',
  market_trend:'fa-chart-line',market_opportunity:'fa-gem',competitor_alert:'fa-search',
  email_campaign:'fa-envelope',email_abandoned_cart:'fa-shopping-cart',email_reengagement:'fa-redo',
  product_create:'fa-lightbulb',product_bundle:'fa-gift',product_variation:'fa-palette',
  workflow_suggestion:'fa-project-diagram',business_health:'fa-heartbeat',performance_alert:'fa-tachometer-alt',
  seasonality_alert:'fa-calendar-star',customer_segment:'fa-users',ad_optimization:'fa-bullhorn',
  financial_insight:'fa-dollar-sign',strategy_review:'fa-chess',upgrade_suggestion:'fa-arrow-circle-up'
};
const INTENT_BG={
  inventory_restock:'bg-emerald-100',inventory_liquidate:'bg-teal-100',
  pricing_adjust:'bg-amber-100',pricing_bundle:'bg-yellow-100',pricing_discount:'bg-orange-100',
  market_trend:'bg-violet-100',market_opportunity:'bg-purple-100',competitor_alert:'bg-blue-100',
  email_campaign:'bg-pink-100',email_abandoned_cart:'bg-rose-100',email_reengagement:'bg-fuchsia-100',
  product_create:'bg-yellow-100',product_bundle:'bg-lime-100',product_variation:'bg-cyan-100',
  business_health:'bg-red-100',performance_alert:'bg-orange-100',strategy_review:'bg-indigo-100',
  customer_segment:'bg-sky-100',financial_insight:'bg-green-100',ad_optimization:'bg-pink-100',
  workflow_suggestion:'bg-slate-100',seasonality_alert:'bg-amber-100',upgrade_suggestion:'bg-violet-100'
};
const INTENT_IC={
  inventory_restock:'text-emerald-600',inventory_liquidate:'text-teal-600',
  pricing_adjust:'text-amber-600',pricing_bundle:'text-yellow-600',pricing_discount:'text-orange-600',
  market_trend:'text-violet-600',market_opportunity:'text-purple-600',competitor_alert:'text-blue-600',
  email_campaign:'text-pink-600',email_abandoned_cart:'text-rose-600',email_reengagement:'text-fuchsia-600',
  product_create:'text-yellow-600',product_bundle:'text-lime-600',product_variation:'text-cyan-600',
  business_health:'text-red-600',performance_alert:'text-orange-600',strategy_review:'text-indigo-600',
  customer_segment:'text-sky-600',financial_insight:'text-green-600',ad_optimization:'text-pink-600',
  workflow_suggestion:'text-slate-600',seasonality_alert:'text-amber-600',upgrade_suggestion:'text-violet-600'
};
const AGENT_COLORS={
  MarketResearchAgent:'violet',PricingAgent:'amber',InventoryAgent:'emerald',
  EmailMarketingAgent:'pink',ProductCreationAgent:'yellow',BusinessHealthAgent:'red',StrategyAgent:'indigo'
};
const AGENT_ICONS={
  MarketResearchAgent:'fa-chart-line',PricingAgent:'fa-tags',InventoryAgent:'fa-boxes',
  EmailMarketingAgent:'fa-envelope',ProductCreationAgent:'fa-lightbulb',BusinessHealthAgent:'fa-heartbeat',StrategyAgent:'fa-chess'
};
function iIcon(t){return INTENT_ICONS[t]||'fa-brain';}
function iBg(t){return INTENT_BG[t]||'bg-gray-100';}
function iColor(t){return INTENT_IC[t]||'text-gray-600';}

const INTENT_TYPES_BY_AGENT = {
  MarketResearchAgent: ['market_trend','market_opportunity','competitor_alert','seasonality_alert','strategy_review'],
  PricingAgent: ['pricing_adjust','pricing_bundle','pricing_discount','financial_insight'],
  InventoryAgent: ['inventory_restock','inventory_liquidate','performance_alert'],
  EmailMarketingAgent: ['email_campaign','email_abandoned_cart','email_reengagement','customer_segment'],
  ProductCreationAgent: ['product_create','product_bundle','product_variation'],
  BusinessHealthAgent: ['business_health','performance_alert','financial_insight','upgrade_suggestion'],
  StrategyAgent: ['strategy_review','workflow_suggestion','ad_optimization']
};

// ── Modal ─────────────────────────────────────────────────────────
function openModal(html) {
  const m = document.getElementById('modal');
  const b = document.getElementById('modal-box');
  b.innerHTML = html;
  m.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}
function closeModal(e) {
  if(!e || e.target===document.getElementById('modal')) {
    document.getElementById('modal').classList.add('hidden');
    document.body.style.overflow = '';
  }
}
window.closeModal = closeModal;

// ── Navigation ────────────────────────────────────────────────────
const PAGE_META = {
  today:     ["Today's Priorities","Your AI-guided daily action plan — approve, modify, or reject"],
  dashboard: ['Dashboard','Business overview, insights, and key metrics'],
  intents:   ['Intent Queue','All AI recommendations awaiting your review'],
  agents:    ['Agent Control Center','Manage your 7 specialized AI agents'],
  generate:  ['Generate Intent','Ask an AI agent to analyze and recommend'],
  workflows: ['Workflow Engine','Multi-step guided business workflows'],
  schedules: ['Schedule Manager','Automated recurring AI analysis tasks'],
  health:    ['Business Health Score','Complete health report across all business areas'],
  profile:   ['Business Profile','Personalize your AI agents with your business context'],
  logs:      ['Agent Activity Logs','See what your AI agents have been doing'],
  usage:     ['My Usage','Token usage, daily limits, plan details, and upgrade options'],
  admin:     ['Admin Panel','Profit dashboard, abuse monitoring, system stats']
};

function nav(page) {
  S.page = page;
  document.querySelectorAll('[data-page]').forEach(el=>{
    const active = el.dataset.page===page;
    el.classList.toggle('active',active);
    el.classList.toggle('text-white/90',active);
    el.classList.toggle('text-white/70',!active);
  });
  const [title,sub] = PAGE_META[page]||['Page',''];
  document.getElementById('page-title').textContent = title;
  document.getElementById('page-sub').textContent = sub;
  document.getElementById('content').innerHTML = loadingHTML();
  renderPage(page);
}
window.nav = nav;

function loadingHTML() {
  return `<div class="flex items-center justify-center h-48"><div class="spinner w-10 h-10"></div></div>`;
}

async function renderPage(page) {
  await refreshStats();
  const map = {
    today: renderToday, dashboard: renderDashboard,
    intents: renderIntents, agents: renderAgents,
    generate: renderGenerate, workflows: renderWorkflows,
    schedules: renderSchedules, health: renderHealth,
    profile: renderProfile, logs: renderLogs,
    usage: renderUsage, admin: renderAdmin
  };
  if(map[page]) await map[page]();

  // After page renders, check for triggers (non-blocking, no UI interruption)
  if (!['usage','admin'].includes(page)) {
    setTimeout(checkUpgradeTriggers, 800);
  }
}

// ── Stats Badge Update ────────────────────────────────────────────
async function refreshStats() {
  try {
    const r = await api.get('/intents/stats');
    if(r.success) {
      S.stats = r.data;
      const pb = document.getElementById('sb-pending');
      const ub = document.getElementById('sb-urgent');
      const p = r.data.pendingIntents||0, u = r.data.urgentIntents||0;
      if(pb) { pb.textContent=p; pb.classList.toggle('hidden',p===0); }
      if(ub) { ub.textContent=u; ub.classList.toggle('hidden',u===0); }
      const pill = document.getElementById('ai-pill');
      if(pill) {
        pill.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block pulse-dot"></span><span class="text-emerald-600 font-medium">AI Active</span>`;
      }
    }
  } catch(_) {}
}

// ================================================================
// TODAY'S PRIORITIES — Guided Entry Point
// ================================================================
async function renderToday() {
  const [iRes,hRes,pRes,wRes] = await Promise.all([
    api.get('/intents?status=pending&limit=30'),
    api.get('/business/health-score'),
    api.get('/business/profile'),
    api.get('/workflows')
  ]);
  S.intents  = iRes.data||[];
  S.health   = hRes.data||{overall:72,inventory:68,pricing:74,marketing:65,products:80,operations:75,trend:'up',alerts:[]};
  S.profile  = pRes.data||{businessName:'My Business',niche:'e-commerce'};
  S.workflows= wRes.data||[];

  const pending  = S.intents.filter(i=>i.status==='pending');
  const urgent   = pending.filter(i=>i.priority==='urgent');
  const high     = pending.filter(i=>i.priority==='high');
  const rest     = pending.filter(i=>i.priority!=='urgent'&&i.priority!=='high');
  const activeWF = S.workflows.filter(w=>w.status==='active');
  const name     = (S.profile.businessName||'Your Business');

  document.getElementById('content').innerHTML = `
    <!-- Inline Usage Bar (non-intrusive, always visible) -->
    ${renderInlineUsageBar()}

    <!-- Welcome Banner -->
    <div class="page-header rounded-2xl p-5 mb-5 text-white relative overflow-hidden">
      <div class="absolute right-4 top-4 opacity-[0.06] text-[120px] leading-none pointer-events-none select-none"><i class="fas fa-brain"></i></div>
      <div class="relative z-10">
        <div class="flex items-center gap-2 mb-2">
          <div class="w-2 h-2 rounded-full bg-emerald-400 pulse-dot"></div>
          <span class="text-violet-300 text-xs font-medium">AI COO Active — Safe Mode Enabled</span>
        </div>
        <h2 class="text-xl font-bold mb-1">Good ${getGreeting()}, ${name.split(' ')[0]}.</h2>
        <p class="text-violet-200 text-sm max-w-xl">Your AI agents have been working. Here's what needs your attention today. <strong class="text-white">You approve everything before anything happens.</strong></p>
        <div class="flex gap-2 mt-4 flex-wrap items-end">
          <div class="bg-white/10 rounded-xl px-3 py-2 text-center min-w-[72px]">
            <div class="text-2xl font-bold">${pending.length}</div>
            <div class="text-violet-300 text-[10px] font-medium">Pending</div>
          </div>
          <div class="bg-red-500/20 border border-red-400/20 rounded-xl px-3 py-2 text-center min-w-[72px]">
            <div class="text-2xl font-bold text-red-200">${urgent.length}</div>
            <div class="text-violet-300 text-[10px] font-medium">Urgent</div>
          </div>
          <div class="bg-white/10 rounded-xl px-3 py-2 text-center min-w-[72px]">
            <div class="text-2xl font-bold">${S.health.overall}</div>
            <div class="text-violet-300 text-[10px] font-medium">Health</div>
          </div>
          <div class="bg-white/10 rounded-xl px-3 py-2 text-center min-w-[72px]">
            <div class="text-2xl font-bold">${activeWF.length}</div>
            <div class="text-violet-300 text-[10px] font-medium">Workflows</div>
          </div>
          <div class="ml-auto flex gap-2">
            <button onclick="runDue()" title="Process scheduled tasks" class="px-3 py-2 rounded-xl bg-white/10 text-white text-xs font-semibold hover:bg-white/20 transition-colors border border-white/10">
              <i class="fas fa-sync-alt mr-1.5"></i>Run Scheduled
            </button>
            <button onclick="nav('generate')" class="px-4 py-2 rounded-xl bg-white text-violet-700 text-xs font-bold hover:bg-violet-50 transition-colors">
              <i class="fas fa-magic mr-1.5"></i>Generate Intent
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Active Workflows banner -->
    ${activeWF.length>0 ? `
      <div class="bg-violet-50 border border-violet-200 rounded-2xl p-4 mb-5">
        <div class="flex items-center gap-2 mb-2">
          <i class="fas fa-project-diagram text-violet-600 text-sm"></i>
          <span class="text-sm font-bold text-violet-700">${activeWF.length} Active Workflow${activeWF.length>1?'s':''} In Progress</span>
        </div>
        <div class="flex flex-wrap gap-2">
          ${activeWF.map(w=>`
            <button onclick="nav('workflows')" class="flex items-center gap-2 bg-white border border-violet-200 rounded-xl px-3 py-1.5 text-xs font-medium text-violet-700 hover:bg-violet-100 transition-colors">
              <div class="w-16 bg-gray-100 rounded-full h-1.5"><div class="bg-violet-500 h-1.5 rounded-full" style="width:${w.progress||0}%"></div></div>
              ${esc(w.name)} — ${w.progress||0}%
            </button>
          `).join('')}
        </div>
      </div>
    ` : ''}

    <!-- Health alerts -->
    ${(S.health.alerts||[]).filter(a=>a.severity==='critical'||a.severity==='warning').slice(0,2).map(a=>`
      <div class="flex items-start gap-3 rounded-xl p-3 mb-3 ${a.severity==='critical'?'bg-red-50 border border-red-200':'bg-amber-50 border border-amber-200'}">
        <i class="fas ${a.severity==='critical'?'fa-exclamation-circle text-red-500':'fa-exclamation-triangle text-amber-500'} mt-0.5"></i>
        <div class="flex-1 text-xs">
          <span class="font-semibold ${a.severity==='critical'?'text-red-700':'text-amber-700'}">${esc(a.area)}: </span>
          <span class="${a.severity==='critical'?'text-red-600':'text-amber-600'}">${esc(a.message)}</span>
        </div>
      </div>
    `).join('')}

    ${pending.length===0 ? `
      <div class="bg-white rounded-2xl border border-gray-100 p-14 text-center shadow-sm">
        <div class="text-5xl mb-4">🎉</div>
        <div class="font-bold text-gray-700 text-xl">All caught up!</div>
        <p class="text-gray-400 text-sm mt-2 mb-6 max-w-md mx-auto">No pending intents. Your scheduled agents will generate new recommendations automatically, or you can generate one now.</p>
        <div class="flex gap-3 justify-center flex-wrap">
          <button onclick="nav('generate')" class="bg-violet-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-violet-700 transition-colors">
            <i class="fas fa-magic mr-2"></i>Generate Intent Now
          </button>
          <button onclick="runDue()" class="bg-gray-100 text-gray-600 px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-200 transition-colors">
            <i class="fas fa-sync-alt mr-2"></i>Run Scheduled Tasks
          </button>
        </div>
      </div>
    ` : `
      <!-- Urgent -->
      ${urgent.length>0 ? `
        <div class="mb-5">
          <div class="flex items-center gap-2 mb-3">
            <div class="w-2 h-2 rounded-full bg-red-500 pulse-dot"></div>
            <span class="text-xs font-bold text-red-600 uppercase tracking-widest">Urgent — Act Today</span>
            <span class="bg-red-100 text-red-600 text-[10px] px-2 py-0.5 rounded-full font-semibold">${urgent.length}</span>
            <div class="ml-auto">
              <button onclick="batchApprove('low')" class="text-[10px] text-gray-400 hover:text-violet-600 transition-colors">Approve all low-risk</button>
            </div>
          </div>
          <div class="space-y-3">${urgent.map(i=>intentCardHTML(i)).join('')}</div>
        </div>
      ` : ''}

      <!-- High Priority -->
      ${high.length>0 ? `
        <div class="mb-5">
          <div class="flex items-center gap-2 mb-3">
            <span class="text-xs font-bold text-amber-600 uppercase tracking-widest">High Priority</span>
            <span class="bg-amber-100 text-amber-600 text-[10px] px-2 py-0.5 rounded-full font-semibold">${high.length}</span>
          </div>
          <div class="space-y-3">${high.map(i=>intentCardHTML(i)).join('')}</div>
        </div>
      ` : ''}

      <!-- Other -->
      ${rest.length>0 ? `
        <div class="mb-5">
          <div class="flex items-center gap-2 mb-3">
            <span class="text-xs font-bold text-gray-400 uppercase tracking-widest">Other Recommendations</span>
            <span class="bg-gray-100 text-gray-500 text-[10px] px-2 py-0.5 rounded-full font-semibold">${rest.length}</span>
          </div>
          <div class="space-y-3">${rest.map(i=>intentCardHTML(i)).join('')}</div>
        </div>
      ` : ''}
    `}
  `;
}

// ── Intent Card HTML ──────────────────────────────────────────────
function intentCardHTML(intent, compact=false) {
  const isPending = intent.status==='pending';
  const isApproved = intent.status==='approved';
  const isRejected = intent.status==='rejected';
  return `
    <div class="intent-card ${intent.priority} bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden" id="ic-${intent.id}">
      <div class="p-4 cursor-pointer" onclick="openIntent('${intent.id}')">
        <div class="flex items-start gap-3">
          <div class="w-10 h-10 rounded-xl ${iBg(intent.type)} flex items-center justify-center shrink-0">
            <i class="fas ${iIcon(intent.type)} ${iColor(intent.type)} text-sm"></i>
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex flex-wrap items-center gap-1.5 mb-1">
              <span class="text-[10px] font-bold uppercase tracking-wide text-gray-400">${fmtType(intent.type)}</span>
              <span class="badge-${intent.priority} text-[10px] px-2 py-0.5 rounded-full font-semibold">${intent.priority==='urgent'?'🚨 ':intent.priority==='high'?'⚡ ':''} ${intent.priority}</span>
              <span class="risk-${intent.riskLevel} text-[10px] px-2 py-0.5 rounded-full font-medium">${intent.riskLevel} risk</span>
              ${intent.metadata?.estimatedValue ? `<span class="text-[10px] text-emerald-600 font-bold">${esc(intent.metadata.estimatedValue)}</span>` : ''}
              <span class="ml-auto text-[10px] text-gray-400">${ago(intent.createdAt)}</span>
            </div>
            <div class="font-semibold text-gray-800 text-sm leading-snug mb-2">${esc(intent.summary)}</div>

            ${intent.whyThisMatters && isPending ? `
              <div class="bg-violet-50 border border-violet-100 rounded-xl px-3 py-2 text-xs text-violet-700 mb-2">
                <span class="font-semibold">💡 Why it matters: </span>${esc(intent.whyThisMatters.substring(0,130))}${intent.whyThisMatters.length>130?'...':''}
              </div>
            ` : ''}

            ${intent.suggestedNextSteps?.length>0 && isPending ? `
              <div class="flex items-center gap-1.5 text-xs text-gray-500 mb-2">
                <i class="fas fa-arrow-right text-violet-400 text-[10px]"></i>
                <span class="font-medium">Next:</span> ${esc(intent.suggestedNextSteps[0])}
              </div>
            ` : ''}

            <!-- Confidence bar + agent -->
            <div class="flex items-center gap-3 mt-2">
              <div class="flex items-center gap-1.5 flex-1 min-w-0">
                <div class="conf-bar flex-1 min-w-[60px]"><div class="conf-fill" style="width:${intent.confidenceLevel||75}%"></div></div>
                <span class="text-[10px] text-gray-400 shrink-0">${intent.confidenceLevel||75}%</span>
              </div>
              <div class="flex items-center gap-1 text-[10px] text-gray-400">
                <i class="fas ${AGENT_ICONS[intent.generatedBy]||'fa-robot'} text-[10px]"></i>
                <span>${(intent.generatedBy||'AI').replace('Agent','')}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      ${isPending ? `
        <div class="border-t border-gray-50 px-4 py-2.5 flex gap-2">
          <button onclick="event.stopPropagation();quickDecide('${intent.id}','approved')" class="flex-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold px-3 py-2 rounded-xl transition-colors border border-emerald-200">
            <i class="fas fa-check mr-1.5"></i>Approve
          </button>
          <button onclick="event.stopPropagation();openModify('${intent.id}')" class="flex-1 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold px-3 py-2 rounded-xl transition-colors border border-blue-200">
            <i class="fas fa-edit mr-1.5"></i>Modify
          </button>
          <button onclick="event.stopPropagation();quickDecide('${intent.id}','rejected')" class="flex-1 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold px-3 py-2 rounded-xl transition-colors border border-red-200">
            <i class="fas fa-times mr-1.5"></i>Reject
          </button>
        </div>
      ` : `
        <div class="border-t border-gray-50 px-4 py-2 flex items-center gap-2">
          <span class="text-[10px] font-semibold ${isApproved?'text-emerald-600':isRejected?'text-red-500':'text-blue-600'}">
            <i class="fas ${isApproved?'fa-check-circle':isRejected?'fa-times-circle':'fa-edit'} mr-1"></i>
            ${intent.status.charAt(0).toUpperCase()+intent.status.slice(1)} ${intent.reviewedAt?ago(intent.reviewedAt):''}
          </span>
          ${intent.modificationNote ? `<span class="text-[10px] text-gray-400 italic truncate">— ${esc(intent.modificationNote)}</span>` : ''}
        </div>
      `}
    </div>
  `;
}

// ── Quick Decide ──────────────────────────────────────────────────
async function quickDecide(id, decision) {
  if(decision==='approved' && S.intents.find(i=>i.id===id)?.riskLevel==='high') {
    if(!confirm('This is a HIGH RISK intent. Are you sure you want to approve it?')) return;
  }
  const r = await api.patch(`/intents/${id}`, {decision});
  if(r.success) {
    toast(decision==='approved'?'✅ Intent approved — take action when ready':'❌ Intent rejected', decision==='approved'?'success':'info');
    const card = document.getElementById(`ic-${id}`);
    if(card) { card.style.opacity='0'; card.style.transform='translateX(20px)'; card.style.transition='all 0.3s'; setTimeout(()=>card.remove(),300); }
    await refreshStats();
    S.intents = S.intents.map(i=>i.id===id?{...i,status:decision,reviewedAt:new Date().toISOString()}:i);
  } else { toast('Failed to update intent','error'); }
}
window.quickDecide = quickDecide;

async function batchApprove(riskLevel='low') {
  const targets = S.intents.filter(i=>i.status==='pending'&&i.riskLevel===riskLevel);
  if(targets.length===0) { toast(`No pending ${riskLevel}-risk intents`,'info'); return; }
  if(!confirm(`Approve all ${targets.length} pending ${riskLevel}-risk intents?`)) return;
  let count = 0;
  for(const i of targets) {
    const r = await api.patch(`/intents/${i.id}`,{decision:'approved'});
    if(r.success) count++;
  }
  toast(`✅ ${count} intents approved`,'success');
  if(S.page==='today') renderToday();
  else if(S.page==='intents') renderIntents();
  await refreshStats();
}
window.batchApprove = batchApprove;

// ── Open Intent Detail Modal ──────────────────────────────────────
async function openIntent(id) {
  let intent = S.intents.find(i=>i.id===id);
  if(!intent) {
    const r = await api.get(`/intents/${id}`);
    if(!r.success) { toast('Intent not found','error'); return; }
    intent = r.data;
  }
  openModal(intentDetailHTML(intent));
}
window.openIntent = openIntent;

function intentDetailHTML(i) {
  const isPending = i.status==='pending';
  return `
    <div class="p-5">
      <!-- Header -->
      <div class="flex items-start gap-3 mb-4">
        <div class="w-12 h-12 rounded-xl ${iBg(i.type)} flex items-center justify-center shrink-0">
          <span class="fas ${iIcon(i.type)} ${iColor(i.type)} text-lg"></span>
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex flex-wrap items-center gap-1.5 mb-1">
            <span class="text-xs font-bold uppercase tracking-wider text-gray-400">${fmtType(i.type)}</span>
            <span class="badge-${i.priority} text-[10px] px-2 py-0.5 rounded-full font-semibold">${i.priority}</span>
            <span class="risk-${i.riskLevel} text-[10px] px-2 py-0.5 rounded-full font-medium">${i.riskLevel} risk</span>
            <span class="bg-gray-100 text-gray-500 text-[10px] px-2 py-0.5 rounded-full">${i.status}</span>
          </div>
          <h3 class="font-bold text-gray-800 text-base leading-snug">${esc(i.summary)}</h3>
          <div class="text-xs text-gray-400 mt-1">${fmtDate(i.createdAt)} · Generated by ${(i.generatedBy||'AI').replace('Agent','')} Agent</div>
        </div>
        <button onclick="closeModal()" class="text-gray-400 hover:text-gray-600 text-lg shrink-0"><i class="fas fa-times"></i></button>
      </div>

      <!-- Confidence + value -->
      <div class="flex items-center gap-4 bg-gray-50 rounded-xl p-3 mb-4">
        <div class="flex-1">
          <div class="text-[10px] text-gray-400 mb-1 font-medium">AI CONFIDENCE</div>
          <div class="conf-bar"><div class="conf-fill" style="width:${i.confidenceLevel||75}%"></div></div>
          <div class="text-xs text-gray-500 mt-1">${i.confidenceLevel||75}% confidence</div>
        </div>
        ${i.metadata?.estimatedValue ? `
          <div class="text-right">
            <div class="text-[10px] text-gray-400 font-medium mb-1">ESTIMATED VALUE</div>
            <div class="text-lg font-bold text-emerald-600">${esc(i.metadata.estimatedValue)}</div>
          </div>
        ` : ''}
        ${i.metadata?.estimatedTimeToAct ? `
          <div class="text-right">
            <div class="text-[10px] text-gray-400 font-medium mb-1">ACT WITHIN</div>
            <div class="text-sm font-bold text-amber-600">${esc(i.metadata.estimatedTimeToAct)}</div>
          </div>
        ` : ''}
      </div>

      <!-- Why This Matters -->
      ${i.whyThisMatters ? `
        <div class="bg-violet-50 border border-violet-200 rounded-xl p-4 mb-4">
          <div class="flex items-center gap-2 mb-2">
            <i class="fas fa-lightbulb text-violet-500 text-sm"></i>
            <span class="text-xs font-bold text-violet-700 uppercase tracking-wider">Why This Matters</span>
          </div>
          <p class="text-sm text-violet-800 leading-relaxed">${esc(i.whyThisMatters)}</p>
        </div>
      ` : ''}

      <!-- Detailed Reasoning -->
      ${i.detailedReasoning ? `
        <div class="mb-4">
          <div class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Detailed Analysis</div>
          <div class="bg-gray-50 rounded-xl p-4 text-sm text-gray-700 leading-relaxed whitespace-pre-line border border-gray-100">${esc(i.detailedReasoning)}</div>
        </div>
      ` : ''}

      <!-- Suggested Next Steps -->
      ${i.suggestedNextSteps?.length>0 ? `
        <div class="mb-4">
          <div class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Suggested Next Steps</div>
          <div class="space-y-2">
            ${i.suggestedNextSteps.map((s,idx)=>`
              <div class="flex items-start gap-3 bg-white border border-gray-100 rounded-xl p-3">
                <div class="step-badge bg-violet-100 text-violet-700 shrink-0">${idx+1}</div>
                <span class="text-sm text-gray-700 leading-snug">${esc(s)}</span>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}

      <!-- Expected Result -->
      ${i.expectedResult ? `
        <div class="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-4">
          <div class="flex items-center gap-2 mb-1.5">
            <i class="fas fa-bullseye text-emerald-500 text-sm"></i>
            <span class="text-xs font-bold text-emerald-700 uppercase tracking-wider">Expected Result</span>
          </div>
          <p class="text-sm text-emerald-800">${esc(i.expectedResult)}</p>
        </div>
      ` : ''}

      <!-- Alternative Options -->
      ${i.alternativeOptions?.length>0 ? `
        <div class="mb-4">
          <div class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Alternative Options</div>
          <div class="space-y-1.5">
            ${i.alternativeOptions.map(a=>`<div class="flex items-start gap-2 text-sm text-gray-600"><i class="fas fa-angle-right text-gray-300 mt-0.5 text-xs shrink-0"></i>${esc(a)}</div>`).join('')}
          </div>
        </div>
      ` : ''}

      <!-- Tags -->
      ${i.tags?.length>0 ? `
        <div class="flex flex-wrap gap-1.5 mb-4">
          ${i.tags.map(t=>`<span class="bg-gray-100 text-gray-500 text-[10px] px-2 py-0.5 rounded-full">#${esc(t)}</span>`).join('')}
        </div>
      ` : ''}

      <!-- Modification note if any -->
      ${i.modificationNote ? `
        <div class="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-4 text-sm text-blue-700">
          <i class="fas fa-edit mr-2"></i><strong>Modification note:</strong> ${esc(i.modificationNote)}
        </div>
      ` : ''}

      <!-- Safety Badge -->
      <div class="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl p-3 mb-4">
        <i class="fas fa-shield-alt text-emerald-500"></i>
        <span class="text-xs text-emerald-700 font-medium">Safe Mode: This intent requires your explicit approval before any action is taken.</span>
      </div>

      <!-- Action Buttons -->
      ${isPending ? `
        <div class="flex gap-2 mt-2">
          <button onclick="quickDecide('${i.id}','approved');closeModal();" class="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-3 rounded-xl transition-colors text-sm">
            <i class="fas fa-check mr-2"></i>Approve
          </button>
          <button onclick="closeModal();openModify('${i.id}');" class="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-3 rounded-xl transition-colors text-sm">
            <i class="fas fa-edit mr-2"></i>Modify
          </button>
          <button onclick="quickDecide('${i.id}','rejected');closeModal();" class="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold px-4 py-3 rounded-xl transition-colors text-sm">
            <i class="fas fa-times mr-2"></i>Reject
          </button>
        </div>
      ` : `
        <div class="flex items-center justify-center gap-2 py-3 bg-gray-50 rounded-xl">
          <i class="fas ${i.status==='approved'?'fa-check-circle text-emerald-500':i.status==='rejected'?'fa-times-circle text-red-500':'fa-edit text-blue-500'}"></i>
          <span class="text-sm font-semibold text-gray-600">${i.status.charAt(0).toUpperCase()+i.status.slice(1)} on ${fmtDate(i.reviewedAt)}</span>
        </div>
      `}
    </div>
  `;
}

// ── Modify Modal ──────────────────────────────────────────────────
function openModify(id) {
  const intent = S.intents.find(i=>i.id===id);
  openModal(`
    <div class="p-5">
      <h3 class="font-bold text-gray-800 text-lg mb-1"><i class="fas fa-edit text-blue-500 mr-2"></i>Modify Intent</h3>
      <p class="text-sm text-gray-500 mb-4">Add a note explaining your modification. The intent will be saved as "modified" for your records.</p>
      ${intent ? `<div class="bg-gray-50 rounded-xl p-3 mb-4 text-sm text-gray-700 font-medium">${esc(intent.summary)}</div>` : ''}
      <textarea id="mod-note" class="w-full border border-gray-200 rounded-xl p-3 text-sm h-28 resize-none focus:outline-none focus:ring-2 focus:ring-blue-300" placeholder="e.g. Approved the pricing change but adjusted the discount to 8% instead of 12%..."></textarea>
      <div class="flex gap-2 mt-4">
        <button onclick="submitModify('${id}')" class="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-3 rounded-xl text-sm transition-colors">
          <i class="fas fa-save mr-2"></i>Save Modification
        </button>
        <button onclick="closeModal()" class="px-4 py-3 rounded-xl bg-gray-100 text-gray-600 text-sm font-semibold hover:bg-gray-200 transition-colors">Cancel</button>
      </div>
    </div>
  `);
}
window.openModify = openModify;

async function submitModify(id) {
  const note = document.getElementById('mod-note')?.value?.trim();
  if(!note) { toast('Please add a modification note','warning'); return; }
  const r = await api.patch(`/intents/${id}`,{decision:'modified',note});
  if(r.success) {
    toast('✏️ Intent modified and saved','info');
    closeModal();
    S.intents = S.intents.map(i=>i.id===id?{...i,status:'modified',modificationNote:note,reviewedAt:new Date().toISOString()}:i);
    if(S.page==='today') renderToday();
    else if(S.page==='intents') renderIntents();
    await refreshStats();
  } else { toast('Failed to modify intent','error'); }
}
window.submitModify = submitModify;

// ================================================================
// DASHBOARD
// ================================================================
async function renderDashboard() {
  const [statsRes, insRes, hRes] = await Promise.all([
    api.get('/intents/stats'),
    api.get('/business/insights'),
    api.get('/business/health-score')
  ]);
  const stats = statsRes.data||{};
  const insights = insRes.data||[];
  const health = hRes.data||{overall:72,inventory:68,pricing:74,marketing:65,products:80,operations:75,trend:'up',alerts:[]};

  document.getElementById('content').innerHTML = `
    <!-- Stats row -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
      ${[
        {l:'Pending Intents',v:stats.pendingIntents||0,i:'fa-layer-group',c:'violet',sub:'Awaiting your review'},
        {l:'Approved Today',v:stats.approvedToday||0,i:'fa-check-circle',c:'emerald',sub:'Actions you greenlit'},
        {l:'Health Score',v:(stats.healthScore||72)+'/100',i:'fa-heartbeat',c:'red',sub:'Overall business health'},
        {l:'Active Workflows',v:stats.activeWorkflows||0,i:'fa-project-diagram',c:'blue',sub:'In progress now'}
      ].map(s=>`
        <div class="stat-card bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
          <div class="flex items-start justify-between mb-3">
            <div class="w-9 h-9 rounded-xl bg-${s.c}-100 flex items-center justify-center">
              <i class="fas ${s.i} text-${s.c}-600 text-sm"></i>
            </div>
          </div>
          <div class="text-2xl font-bold text-gray-800 mb-0.5">${s.v}</div>
          <div class="text-xs font-semibold text-gray-700">${s.l}</div>
          <div class="text-[10px] text-gray-400 mt-0.5">${s.sub}</div>
        </div>
      `).join('')}
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5">
      <!-- Insights -->
      <div class="lg:col-span-2 bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
        <div class="px-5 py-4 border-b border-gray-50">
          <div class="font-bold text-gray-800">Weekly Insights</div>
          <div class="text-xs text-gray-400">Key metrics from your business</div>
        </div>
        <div class="grid grid-cols-2 divide-x divide-y divide-gray-50">
          ${insights.map(ins=>`
            <div class="p-4">
              <div class="flex items-center gap-2 mb-2">
                <div class="w-8 h-8 rounded-lg bg-${ins.color}-100 flex items-center justify-center">
                  <i class="fas ${ins.icon} text-${ins.color}-600 text-xs"></i>
                </div>
                <div>
                  <div class="text-xs font-semibold text-gray-700">${esc(ins.title)}</div>
                  <div class="text-[10px] text-gray-400">${esc(ins.area)}</div>
                </div>
              </div>
              <div class="text-xl font-bold text-gray-800">${esc(ins.value)}</div>
              <div class="flex items-center gap-1 mt-1">
                <i class="fas ${ins.trend==='up'?'fa-arrow-up text-emerald-500':ins.trend==='down'?'fa-arrow-down text-red-500':'fa-minus text-gray-400'} text-[10px]"></i>
                <span class="text-[10px] ${ins.trend==='up'?'text-emerald-600':ins.trend==='down'?'text-red-500':'text-gray-400'} font-medium">${ins.trendPercent?Math.abs(ins.trendPercent)+'%':''} ${ins.trend}</span>
              </div>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Health Ring -->
      <div class="bg-white border border-gray-100 rounded-2xl shadow-sm p-5">
        <div class="font-bold text-gray-800 mb-1">Business Health</div>
        <div class="text-xs text-gray-400 mb-4">Overall score</div>
        <div class="flex items-center justify-center mb-4">
          <div class="relative w-28 h-28">
            <svg viewBox="0 0 36 36" class="w-full h-full health-ring">
              <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#e2e8f0" stroke-width="3"/>
              <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#7c3aed" stroke-width="3" stroke-dasharray="${health.overall}, 100" stroke-linecap="round"/>
            </svg>
            <div class="absolute inset-0 flex flex-col items-center justify-center">
              <span class="text-2xl font-bold text-gray-800">${health.overall}</span>
              <span class="text-[10px] text-gray-400">/100</span>
            </div>
          </div>
        </div>
        <div class="space-y-2">
          ${[
            {l:'Inventory',v:health.inventory||68,c:'emerald'},
            {l:'Pricing',v:health.pricing||74,c:'amber'},
            {l:'Marketing',v:health.marketing||65,c:'pink'},
            {l:'Products',v:health.products||80,c:'blue'}
          ].map(a=>`
            <div class="flex items-center gap-2">
              <span class="text-[10px] text-gray-500 w-16 shrink-0">${a.l}</span>
              <div class="flex-1 bg-gray-100 rounded-full h-1.5">
                <div class="h-1.5 rounded-full bg-${a.c}-500" style="width:${a.v}%"></div>
              </div>
              <span class="text-[10px] text-gray-500 w-6 text-right">${a.v}</span>
            </div>
          `).join('')}
        </div>
        <button onclick="nav('health')" class="mt-4 w-full text-center text-xs text-violet-600 font-semibold hover:text-violet-700">
          View Full Report →
        </button>
      </div>
    </div>

    <!-- Recent intents + Quick generate -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div class="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
        <div class="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
          <div><div class="font-bold text-gray-800">Recent Intents</div><div class="text-xs text-gray-400">Latest AI recommendations</div></div>
          <button onclick="nav('intents')" class="text-xs text-violet-600 font-semibold hover:text-violet-700">View all →</button>
        </div>
        <div class="divide-y divide-gray-50" id="dash-recent-intents">
          <div class="p-4 text-center text-gray-400 text-sm">Loading...</div>
        </div>
      </div>
      <div class="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
        <div class="px-5 py-4 border-b border-gray-50">
          <div class="font-bold text-gray-800">Quick Generate</div>
          <div class="text-xs text-gray-400">Instantly get an AI analysis</div>
        </div>
        <div class="p-4 grid grid-cols-2 gap-2">
          ${[
            {label:'Market Analysis',type:'market_trend',agent:'MarketResearchAgent',icon:'fa-chart-line',color:'violet'},
            {label:'Pricing Review',type:'pricing_adjust',agent:'PricingAgent',icon:'fa-tags',color:'amber'},
            {label:'Inventory Check',type:'inventory_restock',agent:'InventoryAgent',icon:'fa-boxes',color:'emerald'},
            {label:'Email Campaign',type:'email_campaign',agent:'EmailMarketingAgent',icon:'fa-envelope',color:'pink'},
            {label:'Product Ideas',type:'product_create',agent:'ProductCreationAgent',icon:'fa-lightbulb',color:'yellow'},
            {label:'Health Report',type:'business_health',agent:'BusinessHealthAgent',icon:'fa-heartbeat',color:'red'}
          ].map(q=>`
            <button onclick="quickGenerate('${q.type}','${q.agent}')" class="flex items-center gap-2 bg-gray-50 hover:bg-${q.color}-50 border border-gray-100 hover:border-${q.color}-200 rounded-xl p-3 text-left transition-colors group">
              <div class="w-7 h-7 rounded-lg bg-${q.color}-100 flex items-center justify-center shrink-0">
                <i class="fas ${q.icon} text-${q.color}-600 text-xs"></i>
              </div>
              <span class="text-xs font-medium text-gray-600 group-hover:text-gray-800">${q.label}</span>
            </button>
          `).join('')}
        </div>
      </div>
    </div>
  `;

  // Load recent intents
  const recRes = await api.get('/intents?limit=5');
  const recent = recRes.data||[];
  const el = document.getElementById('dash-recent-intents');
  if(el) {
    el.innerHTML = recent.length===0
      ? '<div class="p-5 text-center text-gray-400 text-sm">No intents yet — generate one!</div>'
      : recent.map(i=>`
        <div class="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors" onclick="openIntent('${i.id}')">
          <div class="w-8 h-8 rounded-lg ${iBg(i.type)} flex items-center justify-center shrink-0">
            <i class="fas ${iIcon(i.type)} ${iColor(i.type)} text-xs"></i>
          </div>
          <div class="flex-1 min-w-0">
            <div class="text-xs font-semibold text-gray-700 truncate">${esc(i.summary)}</div>
            <div class="text-[10px] text-gray-400">${fmtType(i.type)} · ${ago(i.createdAt)}</div>
          </div>
          <span class="text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 ${i.status==='pending'?'bg-violet-100 text-violet-600':i.status==='approved'?'bg-emerald-100 text-emerald-600':'bg-gray-100 text-gray-500'}">${i.status}</span>
        </div>
      `).join('');
  }
}

async function quickGenerate(intentType, agentName) {
  toast('Generating intent...','info');
  const r = await api.post('/intents/generate',{intentType,agentName});
  if(r.success) {
    S.intents.unshift(r.data);
    toast('✅ New intent generated — check Today\'s Priorities','success');
    await refreshStats();
    openIntent(r.data.id);
  } else { toast('Generation failed','error'); }
}
window.quickGenerate = quickGenerate;

// ================================================================
// INTENT QUEUE
// ================================================================
async function renderIntents() {
  const res = await api.get('/intents?limit=100');
  S.intents = res.data||[];

  document.getElementById('content').innerHTML = `
    <!-- Filters -->
    <div class="bg-white border border-gray-100 rounded-2xl shadow-sm p-4 mb-4">
      <div class="flex flex-wrap items-center gap-2">
        <div class="relative flex-1 min-w-[180px]">
          <i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs"></i>
          <input id="intent-search" type="text" placeholder="Search intents..." value="${esc(S.intentSearch)}"
            class="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-300"
            oninput="S.intentSearch=this.value;renderIntentList()">
        </div>
        <div class="flex gap-1.5 flex-wrap">
          ${['all','pending','approved','rejected','modified'].map(f=>`
            <button onclick="S.intentFilter='${f}';document.querySelectorAll('.filter-btn').forEach(b=>b.classList.remove('active'));this.classList.add('active');renderIntentList()"
              class="filter-btn tab-btn text-[11px] px-3 py-1.5 rounded-lg font-medium text-gray-500 hover:bg-gray-100 transition-colors ${S.intentFilter===f?'active':''}">
              ${f.charAt(0).toUpperCase()+f.slice(1)}
            </button>
          `).join('')}
        </div>
        <div class="flex gap-2 ml-auto">
          <button onclick="batchApprove('low')" class="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded-xl font-semibold hover:bg-emerald-100 transition-colors">
            <i class="fas fa-check-double mr-1"></i>Approve All Low-Risk
          </button>
          <button onclick="nav('generate')" class="text-xs bg-violet-600 text-white px-3 py-1.5 rounded-xl font-semibold hover:bg-violet-700 transition-colors">
            <i class="fas fa-magic mr-1"></i>Generate
          </button>
        </div>
      </div>
    </div>
    <div id="intent-list"></div>
  `;

  renderIntentList();
}

function renderIntentList() {
  let filtered = S.intents;
  if(S.intentFilter!=='all') filtered = filtered.filter(i=>i.status===S.intentFilter);
  if(S.intentSearch) {
    const q = S.intentSearch.toLowerCase();
    filtered = filtered.filter(i=>i.summary?.toLowerCase().includes(q)||i.type?.includes(q)||i.generatedBy?.toLowerCase().includes(q));
  }
  const el = document.getElementById('intent-list');
  if(!el) return;
  if(filtered.length===0) {
    el.innerHTML = `<div class="bg-white rounded-2xl border border-gray-100 p-12 text-center"><i class="fas fa-inbox text-4xl text-gray-200 mb-3 block"></i><div class="text-gray-400 text-sm">No intents found for this filter.</div></div>`;
    return;
  }
  el.innerHTML = `<div class="space-y-3">${filtered.map(i=>intentCardHTML(i)).join('')}</div>`;
}

// ================================================================
// AGENT CONTROL CENTER
// ================================================================
async function renderAgents() {
  const r = await api.get('/agents');
  S.agents = r.data||[];

  const planName = S.tokens?.planName || 'free';
  const hasAdvanced = ['pro','scale'].includes(planName);
  // Advanced agents: StrategyAgent, AdOptimizationAgent-type functionality
  const ADVANCED_AGENT_IDS = ['StrategyAgent'];

  document.getElementById('content').innerHTML = `
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
      ${S.agents.map(a=>`
        <div class="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden agent-glow">
          <div class="p-4 border-b border-gray-50">
            <div class="flex items-start gap-3">
              <div class="w-10 h-10 rounded-xl bg-${AGENT_COLORS[a.id]||'gray'}-100 flex items-center justify-center shrink-0">
                <i class="fas ${AGENT_ICONS[a.id]||'fa-robot'} text-${AGENT_COLORS[a.id]||'gray'}-600 text-sm"></i>
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="font-bold text-gray-800 text-sm">${esc(a.displayName)}</span>
                  <span class="text-[10px] px-2 py-0.5 rounded-full font-semibold ${a.isActive?'bg-emerald-100 text-emerald-600':'bg-gray-100 text-gray-400'}">
                    ${a.isActive?'Active':'Inactive'}
                  </span>
                </div>
                <div class="text-xs text-gray-400 mt-0.5">${esc(a.description)}</div>
              </div>
              <button onclick="toggleAgent('${a.id}',${!a.isActive})" class="shrink-0 text-xs px-3 py-1.5 rounded-xl font-semibold transition-colors ${a.isActive?'bg-gray-100 text-gray-600 hover:bg-red-50 hover:text-red-600':'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}">
                ${a.isActive?'Pause':'Enable'}
              </button>
            </div>
          </div>
          <div class="p-4">
            <div class="grid grid-cols-3 gap-2 mb-3 text-center">
              <div><div class="text-base font-bold text-gray-800">${a.totalIntentsGenerated||0}</div><div class="text-[10px] text-gray-400">Intents</div></div>
              <div><div class="text-base font-bold text-${a.successRate>=85?'emerald':a.successRate>=70?'amber':'red'}-600">${a.successRate||0}%</div><div class="text-[10px] text-gray-400">Success</div></div>
              <div><div class="text-base font-bold text-gray-800">${a.intentTypes.length}</div><div class="text-[10px] text-gray-400">Types</div></div>
            </div>
            <div class="flex flex-wrap gap-1 mb-3">
              ${a.responsibilities.map(r=>`<span class="bg-gray-50 text-gray-500 text-[10px] px-2 py-0.5 rounded-lg border border-gray-100">${esc(r)}</span>`).join('')}
            </div>
            <div class="flex gap-2">
              <button onclick="generateFromAgent('${a.id}')" class="flex-1 bg-${AGENT_COLORS[a.id]||'gray'}-600 hover:opacity-90 text-white text-xs font-bold px-3 py-2 rounded-xl transition-opacity ${!a.isActive?'opacity-50 cursor-not-allowed':''}">
                <i class="fas fa-magic mr-1.5"></i>Generate Intent
              </button>
              <button onclick="openAgentDetail('${a.id}')" class="px-3 py-2 rounded-xl bg-gray-100 text-gray-600 text-xs font-semibold hover:bg-gray-200 transition-colors">
                <i class="fas fa-info"></i>
              </button>
            </div>
          </div>
        </div>
      `).join('')}
    </div>

    <!-- Locked: Advanced Agents (Pro feature) -->
    ${!hasAdvanced ? `
      <div class="relative rounded-2xl border-2 border-dashed border-purple-200 bg-purple-50/40 overflow-hidden mb-4">
        <!-- Blurred preview -->
        <div class="p-5 filter blur-[3px] pointer-events-none select-none opacity-30">
          <div class="grid grid-cols-2 gap-4">
            ${[['StrategyAgent','Strategy Agent','fa-chess','violet','Generates strategic business plans and pivots'],['AdOptimizationAgent','Ad Optimizer','fa-bullhorn','indigo','ROI-focused ad spend recommendations']].map(([id,name,icon,color,desc])=>`
              <div class="bg-white rounded-2xl border border-gray-100 p-4">
                <div class="flex items-center gap-3 mb-3">
                  <div class="w-10 h-10 rounded-xl bg-${color}-100 flex items-center justify-center"><i class="fas ${icon} text-${color}-600 text-sm"></i></div>
                  <div><div class="font-bold text-gray-800 text-sm">${name}</div><div class="text-xs text-gray-400">${desc}</div></div>
                </div>
                <div class="grid grid-cols-3 gap-2 text-center bg-gray-50 rounded-xl p-2"><div><div class="text-sm font-bold">47</div><div class="text-[10px] text-gray-400">Intents</div></div><div><div class="text-sm font-bold text-emerald-600">94%</div><div class="text-[10px] text-gray-400">Success</div></div><div><div class="text-sm font-bold">8</div><div class="text-[10px] text-gray-400">Types</div></div></div>
              </div>
            `).join('')}
          </div>
        </div>
        <!-- Lock overlay -->
        <div class="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
          <div class="w-14 h-14 rounded-2xl bg-white shadow-md flex items-center justify-center mb-3">
            <i class="fas fa-robot text-purple-500 text-xl"></i>
          </div>
          <div class="font-bold text-gray-800 text-lg mb-1">Advanced AI Agents</div>
          <div class="text-sm text-gray-500 max-w-xs mb-1">Unlock Strategy Agent + Ad Optimization for complete business intelligence coverage.</div>
          <div class="text-xs text-purple-600 font-semibold mb-4">✨ Full 7-agent suite · Up to 7 agents active</div>
          <button onclick="triggerFeatureLock('advanced_agents')"
            class="bg-purple-600 hover:bg-purple-700 text-white font-bold px-6 py-2.5 rounded-xl text-sm transition-colors shadow-sm">
            <i class="fas fa-lock-open mr-2"></i>Unlock with Pro · $30/mo
          </button>
          <p class="text-xs text-gray-400 mt-2">Pro plan includes all 7 specialized AI agents</p>
        </div>
      </div>
    ` : ''}
  `;
}

async function toggleAgent(id, active) {
  const r = await api.patch(`/agents/${id}`,{isActive:active});
  if(r.success) { toast(`Agent ${active?'enabled':'paused'}`,'info'); renderAgents(); }
}
window.toggleAgent = toggleAgent;

async function generateFromAgent(agentId) {
  const agent = S.agents.find(a=>a.id===agentId);
  if(!agent||!agent.isActive) { toast('This agent is paused','warning'); return; }
  const types = agent.intentTypes;
  const intentType = types[Math.floor(Math.random()*types.length)];
  toast(`${agent.displayName} is analyzing...`,'info');
  const r = await api.post('/intents/generate',{agentName:agentId,intentType});
  if(r.success) {
    S.intents.unshift(r.data);
    toast(`✅ Intent generated by ${agent.displayName}`,'success');
    await refreshStats();
    openIntent(r.data.id);
  } else { toast('Generation failed: '+r.error,'error'); }
}
window.generateFromAgent = generateFromAgent;

async function openAgentDetail(id) {
  const r = await api.get(`/agents/${id}`);
  if(!r.success) return;
  const {agent, recentIntents} = r.data;
  openModal(`
    <div class="p-5">
      <div class="flex items-center gap-3 mb-4">
        <div class="w-12 h-12 rounded-xl bg-${AGENT_COLORS[id]||'gray'}-100 flex items-center justify-center">
          <i class="fas ${AGENT_ICONS[id]||'fa-robot'} text-${AGENT_COLORS[id]||'gray'}-600 text-lg"></i>
        </div>
        <div>
          <h3 class="font-bold text-gray-800 text-lg">${esc(agent.displayName)}</h3>
          <p class="text-sm text-gray-400">${esc(agent.description)}</p>
        </div>
        <button onclick="closeModal()" class="ml-auto text-gray-400 hover:text-gray-600 text-xl"><i class="fas fa-times"></i></button>
      </div>
      <div class="mb-4">
        <div class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Responsibilities</div>
        <div class="flex flex-wrap gap-2">${agent.responsibilities.map(r=>`<span class="bg-${AGENT_COLORS[id]||'gray'}-50 text-${AGENT_COLORS[id]||'gray'}-600 text-xs px-3 py-1 rounded-lg border border-${AGENT_COLORS[id]||'gray'}-100">${esc(r)}</span>`).join('')}</div>
      </div>
      <div class="mb-4">
        <div class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Can Generate</div>
        <div class="flex flex-wrap gap-1.5">${agent.intentTypes.map(t=>`<span class="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded-lg">${fmtType(t)}</span>`).join('')}</div>
      </div>
      <div>
        <div class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Recent Intents</div>
        ${recentIntents?.length>0
          ? recentIntents.slice(0,5).map(i=>`
              <div class="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0 cursor-pointer hover:bg-gray-50 rounded-lg px-2" onclick="closeModal();openIntent('${i.id}')">
                <div class="w-7 h-7 rounded-lg ${iBg(i.type)} flex items-center justify-center shrink-0"><i class="fas ${iIcon(i.type)} ${iColor(i.type)} text-xs"></i></div>
                <div class="flex-1 min-w-0"><div class="text-xs font-medium text-gray-700 truncate">${esc(i.summary)}</div><div class="text-[10px] text-gray-400">${fmtType(i.type)} · ${ago(i.createdAt)}</div></div>
                <span class="text-[10px] px-2 py-0.5 rounded-full ${i.status==='pending'?'bg-violet-100 text-violet-600':i.status==='approved'?'bg-emerald-100 text-emerald-600':'bg-gray-100 text-gray-500'}">${i.status}</span>
              </div>
          `).join('')
          : '<div class="text-sm text-gray-400 text-center py-4">No intents yet</div>'
        }
      </div>
    </div>
  `);
}
window.openAgentDetail = openAgentDetail;

// ================================================================
// GENERATE INTENT
// ================================================================
async function renderGenerate() {
  const r = await api.get('/agents');
  S.agents = r.data||[];
  const pr = await api.get('/business/profile');
  S.profile = pr.data||{niche:'e-commerce'};

  document.getElementById('content').innerHTML = `
    <div class="max-w-2xl mx-auto">
      <div class="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
        <div class="page-header p-5 text-white">
          <div class="flex items-center gap-2 mb-1">
            <i class="fas fa-magic text-violet-200"></i>
            <span class="font-bold">AI Intent Generator</span>
          </div>
          <p class="text-violet-200 text-sm">Select an agent and intent type. Your AI will analyze and generate a structured recommendation for your review.</p>
          <div class="mt-3 flex items-center gap-2 text-xs bg-white/10 rounded-xl px-3 py-2 w-fit">
            <i class="fas fa-shield-alt text-emerald-300"></i>
            <span class="text-emerald-200">Safe Mode: Generates INTENTS only — no automatic actions</span>
          </div>
        </div>
        <div class="p-5">
          <div class="mb-4">
            <label class="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2">Select AI Agent</label>
            <div class="grid grid-cols-1 gap-2" id="agent-selector">
              ${S.agents.map(a=>`
                <label class="flex items-center gap-3 border-2 border-gray-100 rounded-xl p-3 cursor-pointer hover:border-${AGENT_COLORS[a.id]||'gray'}-200 transition-colors has-[:checked]:border-${AGENT_COLORS[a.id]||'gray'}-400 has-[:checked]:bg-${AGENT_COLORS[a.id]||'gray'}-50">
                  <input type="radio" name="gen-agent" value="${a.id}" class="sr-only" onchange="updateIntentTypes('${a.id}')">
                  <div class="w-8 h-8 rounded-lg bg-${AGENT_COLORS[a.id]||'gray'}-100 flex items-center justify-center shrink-0">
                    <i class="fas ${AGENT_ICONS[a.id]||'fa-robot'} text-${AGENT_COLORS[a.id]||'gray'}-600 text-sm"></i>
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="text-sm font-semibold text-gray-700">${esc(a.displayName)}</div>
                    <div class="text-[10px] text-gray-400">${esc(a.description.substring(0,70))}...</div>
                  </div>
                  ${!a.isActive ? '<span class="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full shrink-0">Paused</span>' : ''}
                </label>
              `).join('')}
            </div>
          </div>

          <div class="mb-4">
            <label class="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2">Intent Type</label>
            <select id="gen-type" class="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white">
              <option value="">— Select an agent first —</option>
            </select>
          </div>

          <div class="mb-5">
            <label class="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2">Additional Context <span class="text-gray-300 font-normal">(optional)</span></label>
            <textarea id="gen-context" class="w-full border border-gray-200 rounded-xl p-3 text-sm h-20 resize-none focus:outline-none focus:ring-2 focus:ring-violet-300" placeholder="e.g. Focus on our top 3 products, Q2 strategy, or competitor XYZ..."></textarea>
          </div>

          <button onclick="submitGenerate()" id="gen-btn" class="w-full bg-violet-600 hover:bg-violet-700 text-white font-bold px-5 py-3.5 rounded-xl transition-colors text-sm flex items-center justify-center gap-2">
            <i class="fas fa-magic"></i>
            <span>Generate Intent Now</span>
          </button>

          <div id="gen-result"></div>
        </div>
      </div>

      <!-- What happens next -->
      <div class="bg-gray-50 border border-gray-100 rounded-2xl p-5 mt-4">
        <div class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">What Happens Next</div>
        <div class="space-y-2">
          ${[
            ['fa-brain text-violet-500','AI agent analyzes your business context'],
            ['fa-file-alt text-blue-500','A structured INTENT is generated with reasoning, steps, and risk level'],
            ['fa-user-check text-emerald-500','You review and Approve, Modify, or Reject'],
            ['fa-check-circle text-emerald-500','Only approved intents become actionable — nothing happens automatically']
          ].map(([ic,t])=>`
            <div class="flex items-center gap-3 text-sm text-gray-600">
              <i class="fas ${ic} w-5 text-center shrink-0"></i>
              <span>${t}</span>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}

function updateIntentTypes(agentId) {
  const sel = document.getElementById('gen-type');
  if(!sel) return;
  const types = INTENT_TYPES_BY_AGENT[agentId]||[];
  sel.innerHTML = types.map(t=>`<option value="${t}">${fmtType(t)}</option>`).join('');
}
window.updateIntentTypes = updateIntentTypes;

async function submitGenerate() {
  const agentEl = document.querySelector('input[name="gen-agent"]:checked');
  const typeEl = document.getElementById('gen-type');
  const ctxEl = document.getElementById('gen-context');
  const btn = document.getElementById('gen-btn');
  const resEl = document.getElementById('gen-result');

  if(!agentEl) { toast('Please select an AI agent','warning'); return; }
  if(!typeEl?.value) { toast('Please select an intent type','warning'); return; }

  const agentName = agentEl.value;
  const intentType = typeEl.value;
  const ctx = ctxEl?.value?.trim()||'';

  btn.disabled = true;
  btn.innerHTML = '<div class="spinner w-5 h-5"></div><span>Generating...</span>';
  if(resEl) resEl.innerHTML = '';

  const r = await api.post('/intents/generate',{
    agentName, intentType,
    context: ctx ? {userNote: ctx} : {}
  });

  btn.disabled = false;
  btn.innerHTML = '<i class="fas fa-magic"></i><span>Generate Intent Now</span>';

  if(r.success) {
    S.intents.unshift(r.data);
    toast('✅ Intent generated successfully!','success');
    await refreshStats();
    if(resEl) {
      resEl.innerHTML = `
        <div class="mt-4 bg-emerald-50 border border-emerald-200 rounded-xl p-4">
          <div class="flex items-center gap-2 mb-2">
            <i class="fas fa-check-circle text-emerald-500"></i>
            <span class="text-sm font-bold text-emerald-700">Intent Generated!</span>
          </div>
          <div class="text-sm text-emerald-600 mb-3">${esc(r.data.summary)}</div>
          <button onclick="openIntent('${r.data.id}')" class="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold py-2.5 rounded-xl transition-colors">
            <i class="fas fa-eye mr-2"></i>Review & Decide
          </button>
        </div>
      `;
    }
    // Check if this is a high-value intent → fire value_moment trigger
    checkValueMoment(intentType);
  } else if(r.upgradeRequired) {
    // Token limit hit — show upgrade message in results area
    if(resEl) resEl.innerHTML = `
      <div class="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-4">
        <div class="flex items-center gap-2 mb-2">
          <i class="fas fa-exclamation-triangle text-amber-500"></i>
          <span class="text-sm font-bold text-amber-700">Token limit reached</span>
        </div>
        <div class="text-xs text-amber-600 mb-3">${esc(r.error||'Your plan tokens are exhausted for this month.')}</div>
        <button onclick="nav('usage')" class="w-full bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold py-2.5 rounded-xl transition-colors">
          <i class="fas fa-arrow-up mr-2"></i>Upgrade Plan →
        </button>
      </div>
    `;
    toast('Token limit reached — upgrade to continue', 'warning');
  } else {
    if(resEl) resEl.innerHTML = `<div class="mt-4 bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-600"><i class="fas fa-exclamation-circle mr-2"></i>${esc(r.error||'Generation failed')}</div>`;
    toast('Generation failed: '+(r.error||'Unknown error'),'error');
  }
}
window.submitGenerate = submitGenerate;

// ================================================================
// WORKFLOWS
// ================================================================
async function renderWorkflows() {
  const r = await api.get('/workflows');
  S.workflows = r.data||[];

  const statusColors = {active:'emerald',draft:'gray',completed:'blue',paused:'amber'};

  document.getElementById('content').innerHTML = `
    <div class="flex items-center justify-between mb-4">
      <div>
        <div class="text-sm text-gray-500">Multi-step guided processes. Each step generates an intent for your approval.</div>
      </div>
      <button onclick="openCreateWorkflow()" class="bg-violet-600 text-white text-xs font-bold px-4 py-2.5 rounded-xl hover:bg-violet-700 transition-colors">
        <i class="fas fa-plus mr-1.5"></i>New Workflow
      </button>
    </div>

    <div class="space-y-4">
      ${S.workflows.length===0 ? `
        <div class="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <i class="fas fa-project-diagram text-4xl text-gray-200 mb-3 block"></i>
          <div class="text-gray-500 font-semibold">No workflows yet</div>
          <p class="text-gray-400 text-sm mt-1 mb-4">Create a multi-step workflow to guide your team through complex business processes.</p>
          <button onclick="openCreateWorkflow()" class="bg-violet-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-violet-700">
            <i class="fas fa-plus mr-2"></i>Create First Workflow
          </button>
        </div>
      ` : S.workflows.map(wf=>`
        <div class="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
          <div class="p-4 border-b border-gray-50">
            <div class="flex items-start justify-between">
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 mb-1 flex-wrap">
                  <span class="font-bold text-gray-800">${esc(wf.name)}</span>
                  <span class="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-${statusColors[wf.status]||'gray'}-100 text-${statusColors[wf.status]||'gray'}-600">${wf.status}</span>
                  ${wf.tags?.map(t=>`<span class="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-md">${esc(t)}</span>`).join('')||''}
                </div>
                <div class="text-xs text-gray-400">${esc(wf.description)}</div>
              </div>
              <div class="flex gap-2 shrink-0 ml-3">
                ${wf.status!=='completed' ? `
                  <button onclick="runWorkflowStep('${wf.id}')" class="text-xs bg-violet-600 text-white px-3 py-1.5 rounded-xl font-semibold hover:bg-violet-700 transition-colors">
                    <i class="fas fa-play mr-1"></i>Run Next Step
                  </button>
                ` : `<span class="text-xs text-emerald-600 font-semibold flex items-center gap-1"><i class="fas fa-check-circle"></i> Complete</span>`}
                <button onclick="deleteWorkflow('${wf.id}')" class="text-xs text-red-400 hover:text-red-600 transition-colors px-2 py-1.5"><i class="fas fa-trash"></i></button>
              </div>
            </div>
          </div>
          <div class="p-4">
            <!-- Progress bar -->
            <div class="flex items-center gap-3 mb-4">
              <div class="flex-1 bg-gray-100 rounded-full h-2">
                <div class="bg-violet-500 h-2 rounded-full transition-all" style="width:${wf.progress||0}%"></div>
              </div>
              <span class="text-xs text-gray-400 shrink-0">${wf.progress||0}%</span>
              <span class="text-xs text-gray-400 shrink-0">${wf.approvedIntents||0}/${wf.totalIntents||0} approved</span>
            </div>
            <!-- Steps -->
            <div class="space-y-2">
              ${wf.steps.map((step,idx)=>`
                <div class="flex items-center gap-3 ${idx===wf.currentStepIndex&&wf.status!=='completed'?'bg-violet-50 border border-violet-200':'bg-gray-50 border border-gray-100'} rounded-xl p-3">
                  <div class="w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${step.status==='done'?'bg-emerald-100 text-emerald-600':step.status==='in_progress'?'bg-violet-100 text-violet-600':'bg-gray-100 text-gray-400'}">
                    <i class="fas ${step.status==='done'?'fa-check':step.status==='in_progress'?'fa-spinner fa-spin':'fa-circle text-[8px]'} text-xs"></i>
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="text-xs font-semibold text-gray-700">${esc(step.label)}</div>
                    <div class="text-[10px] text-gray-400">${esc(step.description)}</div>
                  </div>
                  <div class="flex items-center gap-1.5 shrink-0">
                    <div class="w-5 h-5 rounded-md bg-${AGENT_COLORS[step.agentName]||'gray'}-100 flex items-center justify-center">
                      <i class="fas ${AGENT_ICONS[step.agentName]||'fa-robot'} text-${AGENT_COLORS[step.agentName]||'gray'}-600 text-[10px]"></i>
                    </div>
                    ${idx===wf.currentStepIndex&&wf.status!=='completed' ? `<span class="text-[10px] text-violet-600 font-semibold">Current</span>` : ''}
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

async function runWorkflowStep(wfId) {
  toast('Running next workflow step...','info');
  const r = await api.post(`/workflows/${wfId}/run-step`,{});
  if(r.success) {
    toast(r.message||'Step complete!','success');
    S.workflows = S.workflows.map(w=>w.id===wfId?{...w,progress:r.data.progress,status:r.data.isComplete?'completed':w.status}:w);
    openIntent(r.data.intent.id);
    renderWorkflows();
  } else { toast('Step failed: '+(r.error||'Unknown'),'error'); }
}
window.runWorkflowStep = runWorkflowStep;

async function deleteWorkflow(id) {
  if(!confirm('Delete this workflow?')) return;
  const r = await api.del(`/workflows/${id}`);
  if(r.success) { toast('Workflow deleted','info'); renderWorkflows(); }
}
window.deleteWorkflow = deleteWorkflow;

function openCreateWorkflow() {
  const agentList = Object.keys(INTENT_TYPES_BY_AGENT);
  openModal(`
    <div class="p-5">
      <h3 class="font-bold text-gray-800 text-lg mb-1"><i class="fas fa-project-diagram text-violet-500 mr-2"></i>Create New Workflow</h3>
      <p class="text-sm text-gray-400 mb-4">Build a multi-step process. Each step will ask an AI agent to generate an intent for your approval.</p>
      <div class="space-y-3">
        <div>
          <label class="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Workflow Name</label>
          <input id="wf-name" type="text" placeholder="e.g. New Product Launch" class="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300">
        </div>
        <div>
          <label class="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Description</label>
          <input id="wf-desc" type="text" placeholder="Brief description of this workflow" class="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300">
        </div>
        <div>
          <label class="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Agents Involved</label>
          <div class="flex flex-wrap gap-2">
            ${agentList.map(a=>`
              <label class="flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" name="wf-agents" value="${a}" class="rounded accent-violet-600">
                <span class="text-xs font-medium text-gray-600">${a.replace('Agent','')}</span>
              </label>
            `).join('')}
          </div>
        </div>
      </div>
      <div class="flex gap-2 mt-5">
        <button onclick="submitCreateWorkflow()" class="flex-1 bg-violet-600 hover:bg-violet-700 text-white font-bold px-4 py-3 rounded-xl text-sm transition-colors">
          <i class="fas fa-plus mr-2"></i>Create Workflow
        </button>
        <button onclick="closeModal()" class="px-4 py-3 rounded-xl bg-gray-100 text-gray-600 text-sm font-semibold hover:bg-gray-200">Cancel</button>
      </div>
    </div>
  `);
}
window.openCreateWorkflow = openCreateWorkflow;

async function submitCreateWorkflow() {
  const name = document.getElementById('wf-name')?.value?.trim();
  const desc = document.getElementById('wf-desc')?.value?.trim();
  const checked = [...document.querySelectorAll('input[name="wf-agents"]:checked')].map(el=>el.value);
  if(!name) { toast('Please enter a workflow name','warning'); return; }
  const steps = checked.map((agent,i)=>({
    id:`step-${i}`, label:`${agent.replace('Agent','')} Analysis`, description:`Run ${agent.replace('Agent','')} agent`, status:'pending', agentName:agent, order:i+1
  }));
  const r = await api.post('/workflows',{name,description:desc,agentsInvolved:checked,steps,triggerType:'manual'});
  if(r.success) { toast('✅ Workflow created','success'); closeModal(); renderWorkflows(); }
  else toast('Failed to create workflow','error');
}
window.submitCreateWorkflow = submitCreateWorkflow;

// ================================================================
// SCHEDULES
// ================================================================
async function renderSchedules() {
  const r = await api.get('/schedules');
  S.schedules = r.data||[];

  const freqColor = {daily:'emerald',weekly:'blue',biweekly:'violet',monthly:'amber',quarterly:'indigo'};
  const planName = S.tokens?.planName || 'free';
  const hasScheduling = ['starter','pro','scale'].includes(planName);

  // ── Header ─────────────────────────────────────────────────────
  const addBtn = hasScheduling
    ? `<button onclick="openCreateSchedule()" class="bg-violet-600 text-white text-xs font-bold px-4 py-2.5 rounded-xl hover:bg-violet-700 transition-colors"><i class="fas fa-plus mr-1.5"></i>New Schedule</button>`
    : `<button onclick="triggerFeatureLock('scheduling')" class="bg-gray-100 text-gray-500 text-xs font-bold px-4 py-2.5 rounded-xl hover:bg-gray-200 transition-colors"><i class="fas fa-lock mr-1.5"></i>Unlock Scheduling</button>`;

  const header = `<div class="flex items-center justify-between mb-4">
    <div class="text-sm text-gray-500">Schedules automatically generate intents for your review — nothing executes automatically.</div>
    ${addBtn}
  </div>`;

  // ── Locked card (free plan only) ───────────────────────────────
  const previewRows = [
    ['Daily Inventory Check','daily','emerald'],
    ['Weekly Pricing Analysis','weekly','blue'],
    ['Monthly Health Report','monthly','amber'],
    ['Market Trend Scan','weekly','violet']
  ].map(function(item) {
    var n=item[0], f=item[1], c=item[2];
    return '<div class="bg-white rounded-2xl border border-gray-100 p-4">'
      + '<div class="flex items-center gap-2 mb-2"><span class="font-bold text-gray-700 text-sm">'+n+'</span>'
      + '<span class="text-[10px] px-2 py-0.5 rounded-full bg-'+c+'-100 text-'+c+'-600">'+f+'</span></div>'
      + '<div class="grid grid-cols-3 gap-2 text-center bg-gray-50 rounded-xl p-2">'
      + '<div><div class="text-sm font-bold">12</div><div class="text-[10px] text-gray-400">Runs</div></div>'
      + '<div><div class="text-sm font-bold">36</div><div class="text-[10px] text-gray-400">Intents</div></div>'
      + '<div><div class="text-sm font-bold">9:00 AM</div><div class="text-[10px] text-gray-400">Time</div></div>'
      + '</div></div>';
  }).join('');

  const lockedCard = !hasScheduling ? (
    '<div class="relative rounded-2xl border-2 border-dashed border-violet-200 bg-violet-50/40 overflow-hidden mb-5">'
    + '<div class="p-5 filter blur-sm pointer-events-none select-none opacity-30">'
    + '<div class="grid grid-cols-2 gap-3">' + previewRows + '</div></div>'
    + '<div class="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">'
    + '<div class="w-14 h-14 rounded-2xl bg-white shadow-md flex items-center justify-center mb-3">'
    + '<i class="fas fa-calendar-alt text-violet-500 text-xl"></i></div>'
    + '<div class="font-bold text-gray-800 text-lg mb-1">Automated Scheduling</div>'
    + '<div class="text-sm text-gray-500 max-w-xs mb-1">Set AI agents to run on autopilot — daily, weekly, or monthly. Generate insights while you sleep.</div>'
    + '<div class="text-xs text-violet-600 font-semibold mb-4">✨ Saves 2–3 hours/week · Never miss a market shift</div>'
    + '<button onclick="triggerFeatureLock(\'scheduling\')" class="bg-violet-600 hover:bg-violet-700 text-white font-bold px-6 py-2.5 rounded-xl text-sm transition-colors shadow-sm">'
    + '<i class="fas fa-lock-open mr-2"></i>Unlock with Starter · $10/mo</button>'
    + '<p class="text-xs text-gray-400 mt-2">Upgrade to see your scheduled agents working 24/7</p>'
    + '</div></div>'
  ) : '';

  // ── Schedule grid (paid plans) ─────────────────────────────────
  let schedGrid = '';
  if (hasScheduling) {
    if (S.schedules.length === 0) {
      schedGrid = '<div class="col-span-2 bg-white rounded-2xl border border-gray-100 p-12 text-center">'
        + '<i class="fas fa-calendar-alt text-4xl text-gray-200 mb-3 block"></i>'
        + '<div class="text-gray-500 font-semibold">No schedules yet</div>'
        + '<button onclick="openCreateSchedule()" class="mt-4 bg-violet-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-violet-700">'
        + '<i class="fas fa-plus mr-2"></i>Create First Schedule</button></div>';
    } else {
      schedGrid = S.schedules.map(function(s) {
        const fc = freqColor[s.frequency] || 'gray';
        const agentBadge = s.agentName
          ? '<div class="mt-2 flex items-center gap-1.5">'
            + '<div class="w-5 h-5 rounded bg-'+(AGENT_COLORS[s.agentName]||'gray')+'-100 flex items-center justify-center">'
            + '<i class="fas '+(AGENT_ICONS[s.agentName]||'fa-robot')+' text-'+(AGENT_COLORS[s.agentName]||'gray')+'-600 text-[9px]"></i></div>'
            + '<span class="text-[10px] text-gray-500">'+s.agentName.replace('Agent',' Agent')+'</span></div>'
          : '';
        return '<div class="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden"><div class="p-4">'
          + '<div class="flex items-start justify-between mb-3">'
          + '<div class="flex-1 min-w-0">'
          + '<div class="flex items-center gap-2 flex-wrap mb-1">'
          + '<span class="font-bold text-gray-800 text-sm">'+esc(s.name)+'</span>'
          + '<span class="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-'+fc+'-100 text-'+fc+'-600">'+s.frequency+'</span>'
          + '<span class="text-[10px] px-2 py-0.5 rounded-full font-semibold '+(s.isActive?'bg-emerald-100 text-emerald-600':'bg-gray-100 text-gray-400')+'">'+(s.isActive?'Active':'Paused')+'</span>'
          + '</div><div class="text-xs text-gray-400">'+esc(s.description)+'</div></div>'
          + '<div class="flex gap-1 shrink-0 ml-2">'
          + '<button onclick="runSchedule(\''+s.id+'\')" title="Run Now" class="w-8 h-8 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center hover:bg-violet-100 transition-colors text-xs"><i class="fas fa-play"></i></button>'
          + '<button onclick="toggleSchedule(\''+s.id+'\','+(!s.isActive)+')" title="'+(s.isActive?'Pause':'Enable')+'" class="w-8 h-8 rounded-xl '+(s.isActive?'bg-amber-50 text-amber-600':'bg-emerald-50 text-emerald-600')+' flex items-center justify-center hover:opacity-80 transition-opacity text-xs"><i class="fas '+(s.isActive?'fa-pause':'fa-play-circle')+'"></i></button>'
          + '<button onclick="deleteSchedule(\''+s.id+'\')" class="w-8 h-8 rounded-xl bg-red-50 text-red-400 flex items-center justify-center hover:bg-red-100 transition-colors text-xs"><i class="fas fa-trash"></i></button>'
          + '</div></div>'
          + '<div class="grid grid-cols-3 gap-2 text-center bg-gray-50 rounded-xl p-3 mb-3">'
          + '<div><div class="text-sm font-bold text-gray-700">'+(s.totalRuns||0)+'</div><div class="text-[10px] text-gray-400">Runs</div></div>'
          + '<div><div class="text-sm font-bold text-gray-700">'+(s.intentsGenerated||0)+'</div><div class="text-[10px] text-gray-400">Intents</div></div>'
          + '<div><div class="text-sm font-bold text-gray-700">'+(s.hour!=null?formatHour(s.hour):'—')+'</div><div class="text-[10px] text-gray-400">Time</div></div>'
          + '</div>'
          + '<div class="flex items-center justify-between text-xs text-gray-400">'
          + '<span><i class="fas fa-history mr-1"></i>Last: '+(s.lastRun?ago(s.lastRun):'Never')+'</span>'
          + '<span><i class="fas fa-clock mr-1"></i>Next: '+fmtDateShort(s.nextRun)+'</span></div>'
          + agentBadge
          + '</div></div>';
      }).join('');
    }
    schedGrid = '<div class="grid grid-cols-1 md:grid-cols-2 gap-3">' + schedGrid + '</div>';
  }

  document.getElementById('content').innerHTML = header + lockedCard + schedGrid;
}


function formatHour(h) { const ampm = h<12?'AM':'PM'; return (h%12||12)+':00 '+ampm; }

async function runSchedule(id) {
  toast('Running schedule...','info');
  const r = await api.post(`/schedules/${id}/run`,{});
  if(r.success) {
    toast(`✅ Schedule ran! Intent generated for review.`,'success');
    S.intents.unshift(r.data.intent);
    openIntent(r.data.intent.id);
    renderSchedules();
  } else { toast('Run failed: '+(r.error||'Unknown'),'error'); }
}
window.runSchedule = runSchedule;

async function toggleSchedule(id, active) {
  const r = await api.patch(`/schedules/${id}`,{isActive:active});
  if(r.success) { toast(`Schedule ${active?'enabled':'paused'}`,'info'); renderSchedules(); }
}
window.toggleSchedule = toggleSchedule;

async function deleteSchedule(id) {
  if(!confirm('Delete this schedule?')) return;
  const r = await api.del(`/schedules/${id}`);
  if(r.success) { toast('Schedule deleted','info'); renderSchedules(); }
}
window.deleteSchedule = deleteSchedule;

function openCreateSchedule() {
  const agentList = Object.keys(INTENT_TYPES_BY_AGENT);
  openModal(`
    <div class="p-5">
      <h3 class="font-bold text-gray-800 text-lg mb-1"><i class="fas fa-calendar-plus text-violet-500 mr-2"></i>Create Schedule</h3>
      <p class="text-sm text-gray-400 mb-4">Set up a recurring AI task. It will automatically generate intents for your review — never execute anything.</p>
      <div class="space-y-3">
        <div>
          <label class="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Name</label>
          <input id="sc-name" type="text" placeholder="e.g. Daily Inventory Check" class="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300">
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">AI Agent</label>
            <select id="sc-agent" onchange="updateSchedTypes()" class="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white">
              ${agentList.map(a=>`<option value="${a}">${a.replace('Agent','')} Agent</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Intent Type</label>
            <select id="sc-type" class="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white">
              ${(INTENT_TYPES_BY_AGENT[agentList[0]]||[]).map(t=>`<option value="${t}">${fmtType(t)}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Frequency</label>
            <select id="sc-freq" class="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white">
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="biweekly">Bi-weekly</option>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
            </select>
          </div>
          <div>
            <label class="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Hour (24h)</label>
            <input id="sc-hour" type="number" min="0" max="23" value="9" class="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300">
          </div>
        </div>
      </div>
      <div class="flex gap-2 mt-5">
        <button onclick="submitCreateSchedule()" class="flex-1 bg-violet-600 hover:bg-violet-700 text-white font-bold px-4 py-3 rounded-xl text-sm transition-colors">
          <i class="fas fa-calendar-plus mr-2"></i>Create Schedule
        </button>
        <button onclick="closeModal()" class="px-4 py-3 rounded-xl bg-gray-100 text-gray-600 text-sm font-semibold hover:bg-gray-200">Cancel</button>
      </div>
    </div>
  `);
  setTimeout(()=>updateSchedTypes(),50);
}
window.openCreateSchedule = openCreateSchedule;

function updateSchedTypes() {
  const agent = document.getElementById('sc-agent')?.value;
  const sel = document.getElementById('sc-type');
  if(!sel||!agent) return;
  const types = INTENT_TYPES_BY_AGENT[agent]||[];
  sel.innerHTML = types.map(t=>`<option value="${t}">${fmtType(t)}</option>`).join('');
}
window.updateSchedTypes = updateSchedTypes;

async function submitCreateSchedule() {
  const name = document.getElementById('sc-name')?.value?.trim();
  const agentName = document.getElementById('sc-agent')?.value;
  const intentType = document.getElementById('sc-type')?.value;
  const frequency = document.getElementById('sc-freq')?.value;
  const hour = parseInt(document.getElementById('sc-hour')?.value||'9');
  if(!name) { toast('Please enter a schedule name','warning'); return; }
  const r = await api.post('/schedules',{name,agentName,intentType,frequency,hour});
  if(r.success) { toast('✅ Schedule created','success'); closeModal(); renderSchedules(); }
  else toast('Failed to create schedule: '+(r.error||'Unknown'),'error');
}
window.submitCreateSchedule = submitCreateSchedule;

// ── Run Due ───────────────────────────────────────────────────────
async function runDue() {
  toast('Processing scheduled tasks...','info');
  const r = await api.post('/schedules/run-due',{});
  if(r.success) {
    const n = r.data?.ran||0;
    toast(n>0?`✅ ${n} scheduled task${n>1?'s':''} ran — check Intent Queue`:'No tasks due right now','info');
    await refreshStats();
    if(S.page==='today') renderToday();
    else if(S.page==='schedules') renderSchedules();
  }
}
window.runDue = runDue;

// ================================================================
// BUSINESS HEALTH SCORE
// ================================================================
async function renderHealth() {
  const [hRes, iRes] = await Promise.all([
    api.get('/business/health-score'),
    api.get('/business/insights')
  ]);
  S.health = hRes.data||{overall:72,inventory:68,pricing:74,marketing:65,products:80,operations:75,trend:'up',alerts:[]};
  S.insights = iRes.data||[];

  const areas = [
    {key:'inventory',label:'Inventory',icon:'fa-boxes',color:'emerald',desc:'Stock levels, velocity, restock health'},
    {key:'pricing',label:'Pricing Strategy',icon:'fa-tags',color:'amber',desc:'Competitive positioning, margin health'},
    {key:'marketing',label:'Marketing',icon:'fa-envelope',color:'pink',desc:'Email open rates, campaign performance'},
    {key:'products',label:'Products',icon:'fa-lightbulb',color:'blue',desc:'Catalog performance, ratings, AOV'},
    {key:'operations',label:'Operations',icon:'fa-cogs',color:'violet',desc:'Workflow efficiency, process health'}
  ];

  function scoreColor(v) { return v>=80?'emerald':v>=60?'amber':'red'; }
  function scoreBg(v) { return v>=80?'bg-emerald-500':v>=60?'bg-amber-500':'bg-red-500'; }

  document.getElementById('content').innerHTML = `
    <!-- Overall Score -->
    <div class="bg-gradient-to-r from-[#1a0f3a] to-[#4c1d95] rounded-2xl p-6 mb-5 text-white">
      <div class="flex items-center gap-6">
        <div class="relative w-24 h-24 shrink-0">
          <svg viewBox="0 0 36 36" class="w-full h-full health-ring">
            <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="3"/>
            <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="${S.health.overall>=80?'#10b981':S.health.overall>=60?'#f59e0b':'#ef4444'}" stroke-width="3" stroke-dasharray="${S.health.overall}, 100" stroke-linecap="round"/>
          </svg>
          <div class="absolute inset-0 flex flex-col items-center justify-center">
            <span class="text-2xl font-bold">${S.health.overall}</span>
            <span class="text-[10px] text-white/60">/100</span>
          </div>
        </div>
        <div class="flex-1">
          <div class="flex items-center gap-2 mb-1">
            <span class="text-xl font-bold">Business Health Score</span>
            <span class="flex items-center gap-1 text-sm ${S.health.trend==='up'?'text-emerald-300':'text-red-300'}">
              <i class="fas ${S.health.trend==='up'?'fa-arrow-up':S.health.trend==='down'?'fa-arrow-down':'fa-minus'}"></i>
              ${S.health.trend}
            </span>
          </div>
          <p class="text-violet-200 text-sm">${S.health.overall>=80?'Excellent! Your business is in great shape.':S.health.overall>=60?'Good foundation with clear improvement opportunities.':'Needs attention — take action on the recommendations below.'}</p>
          <div class="mt-3 text-xs text-violet-300">Last updated ${S.health.lastUpdated?ago(S.health.lastUpdated):'today'}</div>
        </div>
        <button onclick="generateHealthIntent()" class="shrink-0 bg-white/10 hover:bg-white/20 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-colors border border-white/10">
          <i class="fas fa-heartbeat mr-2"></i>Generate Report
        </button>
      </div>
    </div>

    <!-- Area Scores -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
      ${areas.map(a=>{
        const score = S.health[a.key]||65;
        return `
          <div class="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
            <div class="flex items-center gap-3 mb-3">
              <div class="w-9 h-9 rounded-xl bg-${a.color}-100 flex items-center justify-center shrink-0">
                <i class="fas ${a.icon} text-${a.color}-600 text-sm"></i>
              </div>
              <div class="flex-1 min-w-0">
                <div class="text-sm font-bold text-gray-700">${a.label}</div>
                <div class="text-[10px] text-gray-400">${a.desc}</div>
              </div>
              <div class="text-xl font-bold text-${scoreColor(score)}-600">${score}</div>
            </div>
            <div class="w-full bg-gray-100 rounded-full h-2">
              <div class="${scoreBg(score)} h-2 rounded-full transition-all" style="width:${score}%"></div>
            </div>
            <div class="mt-2 text-[10px] text-gray-400">${score>=80?'✅ Strong':score>=60?'⚠️ Needs work':'❌ Critical attention needed'}</div>
          </div>
        `;
      }).join('')}
    </div>

    <!-- Alerts -->
    ${(S.health.alerts||[]).length>0 ? `
      <div class="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden mb-5">
        <div class="px-5 py-4 border-b border-gray-50">
          <div class="font-bold text-gray-800">Health Alerts</div>
        </div>
        <div class="divide-y divide-gray-50">
          ${S.health.alerts.map(a=>`
            <div class="flex items-start gap-3 p-4">
              <div class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${a.severity==='critical'?'bg-red-100':a.severity==='warning'?'bg-amber-100':'bg-blue-100'}">
                <i class="fas ${a.severity==='critical'?'fa-exclamation-circle text-red-600':a.severity==='warning'?'fa-exclamation-triangle text-amber-600':'fa-info-circle text-blue-600'} text-sm"></i>
              </div>
              <div>
                <div class="text-xs font-bold ${a.severity==='critical'?'text-red-700':a.severity==='warning'?'text-amber-700':'text-blue-700'}">${esc(a.area)}</div>
                <div class="text-sm text-gray-600">${esc(a.message)}</div>
                <div class="text-[10px] text-gray-400 mt-0.5">${ago(a.createdAt)}</div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    ` : ''}

    <!-- Insights grid -->
    <div class="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
      <div class="px-5 py-4 border-b border-gray-50">
        <div class="font-bold text-gray-800">Business Insights</div>
        <div class="text-xs text-gray-400">Key metrics from your business</div>
      </div>
      <div class="grid grid-cols-2 md:grid-cols-4 divide-x divide-y divide-gray-50">
        ${S.insights.map(ins=>`
          <div class="p-4">
            <div class="flex items-center gap-2 mb-2">
              <div class="w-7 h-7 rounded-lg bg-${ins.color}-100 flex items-center justify-center">
                <i class="fas ${ins.icon} text-${ins.color}-600 text-xs"></i>
              </div>
              <span class="text-xs font-semibold text-gray-600">${esc(ins.title)}</span>
            </div>
            <div class="text-2xl font-bold text-gray-800">${esc(ins.value)}</div>
            <div class="flex items-center gap-1 mt-1">
              <i class="fas ${ins.trend==='up'?'fa-arrow-up text-emerald-500':ins.trend==='down'?'fa-arrow-down text-red-500':'fa-minus text-gray-400'} text-[10px]"></i>
              <span class="text-[10px] ${ins.trend==='up'?'text-emerald-600':ins.trend==='down'?'text-red-500':'text-gray-400'}">${ins.trendPercent?Math.abs(ins.trendPercent)+'% ':''} ${ins.trend}</span>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

async function generateHealthIntent() {
  toast('Generating health report...','info');
  const r = await api.post('/intents/generate',{agentName:'BusinessHealthAgent',intentType:'business_health'});
  if(r.success) { S.intents.unshift(r.data); toast('✅ Health report generated','success'); openIntent(r.data.id); }
  else toast('Failed','error');
}
window.generateHealthIntent = generateHealthIntent;

// ================================================================
// BUSINESS PROFILE
// ================================================================
async function renderProfile() {
  const r = await api.get('/business/profile');
  S.profile = r.data||{};
  const p = S.profile;

  document.getElementById('content').innerHTML = `
    <div class="max-w-2xl mx-auto space-y-4">
      <!-- Header -->
      <div class="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
        <div class="page-header p-5 text-white">
          <div class="flex items-center gap-3">
            <div class="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center">
              <i class="fas fa-store text-violet-200 text-lg"></i>
            </div>
            <div>
              <div class="font-bold text-lg">${esc(p.businessName||'My Business')}</div>
              <div class="text-violet-200 text-sm">${esc(p.niche||'E-commerce')} · ${esc(p.platform||'multi')}</div>
            </div>
          </div>
        </div>
        <div class="p-5">
          <div class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Business Information</div>
          <div class="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label class="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Business Name</label>
              <input id="p-businessName" type="text" value="${esc(p.businessName||'')}" class="w-full border border-gray-200 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300">
            </div>
            <div>
              <label class="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Owner Name</label>
              <input id="p-ownerName" type="text" value="${esc(p.ownerName||'')}" class="w-full border border-gray-200 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300">
            </div>
            <div>
              <label class="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Niche</label>
              <input id="p-niche" type="text" value="${esc(p.niche||'')}" placeholder="e.g. hair products, electronics" class="w-full border border-gray-200 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300">
            </div>
            <div>
              <label class="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Sub-niche</label>
              <input id="p-subNiche" type="text" value="${esc(p.subNiche||'')}" placeholder="e.g. natural hair care" class="w-full border border-gray-200 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300">
            </div>
            <div>
              <label class="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Platform</label>
              <select id="p-platform" class="w-full border border-gray-200 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white">
                ${['shopify','amazon','etsy','woocommerce','multi','other'].map(v=>`<option value="${v}" ${p.platform===v?'selected':''}>${v.charAt(0).toUpperCase()+v.slice(1)}</option>`).join('')}
              </select>
            </div>
            <div>
              <label class="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Team Size</label>
              <select id="p-teamSize" class="w-full border border-gray-200 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white">
                ${['solo','small','medium','large'].map(v=>`<option value="${v}" ${p.teamSize===v?'selected':''}>${v.charAt(0).toUpperCase()+v.slice(1)}</option>`).join('')}
              </select>
            </div>
          </div>

          <div class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 mt-4">Strategy & Preferences</div>
          <div class="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label class="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Pricing Style</label>
              <select id="p-pricingStyle" class="w-full border border-gray-200 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white">
                ${['aggressive','moderate','premium'].map(v=>`<option value="${v}" ${p.pricingStyle===v?'selected':''}>${v.charAt(0).toUpperCase()+v.slice(1)}</option>`).join('')}
              </select>
            </div>
            <div>
              <label class="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Risk Tolerance</label>
              <select id="p-riskTolerance" class="w-full border border-gray-200 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white">
                ${['conservative','balanced','aggressive'].map(v=>`<option value="${v}" ${p.riskTolerance===v?'selected':''}>${v.charAt(0).toUpperCase()+v.slice(1)}</option>`).join('')}
              </select>
            </div>
            <div>
              <label class="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Monthly Revenue ($)</label>
              <input id="p-monthlyRevenue" type="number" value="${p.monthlyRevenue||''}" placeholder="8500" class="w-full border border-gray-200 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300">
            </div>
            <div>
              <label class="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Monthly Budget ($)</label>
              <input id="p-monthlyBudget" type="number" value="${p.monthlyBudget||''}" placeholder="5000" class="w-full border border-gray-200 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300">
            </div>
          </div>

          <div class="mb-4">
            <label class="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Top Products (comma-separated)</label>
            <input id="p-topProducts" type="text" value="${esc((p.topProducts||[]).join(', '))}" placeholder="Shea Moisture Curl Cream, Edge Control, Hair Oil" class="w-full border border-gray-200 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300">
          </div>
          <div class="mb-4">
            <label class="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Focus Categories (comma-separated)</label>
            <input id="p-focusCategories" type="text" value="${esc((p.focusCategories||[]).join(', '))}" placeholder="hair care, beauty accessories, styling tools" class="w-full border border-gray-200 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300">
          </div>

          <div class="flex items-center justify-between p-3 bg-gray-50 rounded-xl mb-4">
            <div>
              <div class="text-sm font-semibold text-gray-700">Auto-reject high-risk intents</div>
              <div class="text-xs text-gray-400">Automatically decline high-risk recommendations</div>
            </div>
            <label class="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" id="p-autoRejectHighRisk" class="sr-only peer" ${p.autoRejectHighRisk?'checked':''}>
              <div class="w-10 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-5 peer-checked:bg-violet-600 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all"></div>
            </label>
          </div>

          <button onclick="saveProfile()" class="w-full bg-violet-600 hover:bg-violet-700 text-white font-bold px-5 py-3 rounded-xl transition-colors text-sm">
            <i class="fas fa-save mr-2"></i>Save Profile — AI agents will use your updated settings
          </button>
        </div>
      </div>

      <!-- Approval Patterns -->
      ${p.approvalPatterns?.length>0 ? `
        <div class="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
          <div class="px-5 py-4 border-b border-gray-50">
            <div class="font-bold text-gray-800">Personalization Patterns</div>
            <div class="text-xs text-gray-400">How AI agents have learned from your decisions</div>
          </div>
          <div class="divide-y divide-gray-50">
            ${p.approvalPatterns.map(ap=>`
              <div class="flex items-center gap-3 p-4">
                <div class="w-8 h-8 rounded-lg ${iBg(ap.intentType)} flex items-center justify-center shrink-0">
                  <i class="fas ${iIcon(ap.intentType)} ${iColor(ap.intentType)} text-xs"></i>
                </div>
                <div class="flex-1 min-w-0">
                  <div class="text-sm font-semibold text-gray-700">${fmtType(ap.intentType)}</div>
                  <div class="text-[10px] text-gray-400">Last: ${ap.lastDecision}</div>
                </div>
                <div class="text-right">
                  <div class="text-sm font-bold text-${ap.approvalRate>=60?'emerald':'amber'}-600">${ap.approvalRate}%</div>
                  <div class="text-[10px] text-gray-400">approval rate</div>
                </div>
                <div class="w-20 bg-gray-100 rounded-full h-1.5 shrink-0">
                  <div class="h-1.5 rounded-full bg-violet-500" style="width:${ap.approvalRate}%"></div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}
    </div>
  `;
}

async function saveProfile() {
  const getValue = id => { const el = document.getElementById(id); return el ? el.value : ''; };
  const getChecked = id => { const el = document.getElementById(id); return el ? el.checked : false; };
  const splitCSV = v => v.split(',').map(s=>s.trim()).filter(Boolean);

  const data = {
    businessName: getValue('p-businessName'),
    ownerName: getValue('p-ownerName'),
    niche: getValue('p-niche'),
    subNiche: getValue('p-subNiche'),
    platform: getValue('p-platform'),
    teamSize: getValue('p-teamSize'),
    pricingStyle: getValue('p-pricingStyle'),
    riskTolerance: getValue('p-riskTolerance'),
    monthlyRevenue: parseFloat(getValue('p-monthlyRevenue'))||undefined,
    monthlyBudget: parseFloat(getValue('p-monthlyBudget'))||undefined,
    topProducts: splitCSV(getValue('p-topProducts')),
    focusCategories: splitCSV(getValue('p-focusCategories')),
    autoRejectHighRisk: getChecked('p-autoRejectHighRisk')
  };

  const r = await api.patch('/business/profile', data);
  if(r.success) { S.profile = r.data; toast('✅ Profile saved — AI agents updated','success'); }
  else toast('Save failed','error');
}
window.saveProfile = saveProfile;

// ================================================================
// AGENT LOGS
// ================================================================
async function renderLogs() {
  const r = await api.get('/business/logs');
  S.logs = r.data||[];

  document.getElementById('content').innerHTML = `
    <div class="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
      <div class="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
        <div>
          <div class="font-bold text-gray-800">Agent Activity Log</div>
          <div class="text-xs text-gray-400">${S.logs.length} recent activities</div>
        </div>
        <div class="flex items-center gap-1.5">
          <div class="w-2 h-2 rounded-full bg-emerald-400 pulse-dot"></div>
          <span class="text-xs text-emerald-600 font-medium">Live</span>
        </div>
      </div>
      ${S.logs.length===0 ? `
        <div class="p-12 text-center">
          <i class="fas fa-terminal text-4xl text-gray-200 mb-3 block"></i>
          <div class="text-gray-400 text-sm">No agent activity yet. Generate your first intent to see logs here.</div>
        </div>
      ` : `
        <div class="divide-y divide-gray-50">
          ${S.logs.map(log=>`
            <div class="flex items-start gap-3 px-5 py-3 hover:bg-gray-50 transition-colors">
              <div class="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 bg-${AGENT_COLORS[log.agentName]||'gray'}-100">
                <i class="fas ${AGENT_ICONS[log.agentName]||'fa-robot'} text-${AGENT_COLORS[log.agentName]||'gray'}-600 text-[10px]"></i>
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="text-xs font-semibold text-gray-700">${esc(log.agentName?.replace('Agent',' Agent'))}</span>
                  <span class="text-[10px] px-1.5 py-0.5 rounded font-mono ${log.status==='success'?'bg-emerald-100 text-emerald-600':log.status==='error'?'bg-red-100 text-red-600':'bg-gray-100 text-gray-500'}">${log.action}</span>
                  <span class="ml-auto text-[10px] text-gray-400">${ago(log.timestamp)}</span>
                </div>
                <div class="text-xs text-gray-500 mt-0.5">${esc(log.message)}</div>
                ${log.intentId ? `<button onclick="openIntent('${log.intentId}')" class="text-[10px] text-violet-500 hover:text-violet-700 mt-0.5 font-medium">View Intent →</button>` : ''}
              </div>
              <div class="w-1.5 h-1.5 rounded-full mt-2 shrink-0 ${log.status==='success'?'bg-emerald-400':log.status==='error'?'bg-red-400':'bg-gray-300'}"></div>
            </div>
          `).join('')}
        </div>
      `}
    </div>
  `;
}

// ================================================================
// ██████╗ ██╗   ██╗██████╗  ██████╗ ██████╗  █████╗ ██████╗ ███████╗
// CONVERSION ENGINE — Upgrade triggers, locked features, value moments
// Architecture: All suggestions are INTENTS. Never auto-upgrades.
// ================================================================

// ── Conversion state ──────────────────────────────────────────────
const CVT = {
  sessionUpgradeMentioned: false,  // Only show upgrade once per chat session
  triggerQueue: [],                 // Pending triggers to show
  lastTriggerShown: 0,              // Timestamp of last trigger shown
  MIN_TRIGGER_GAP_MS: 5 * 60000,   // Min 5 min between any two triggers
  activeTrigger: null,              // Currently showing trigger data
  behaviorBuffer: [],               // Buffered behavior events to batch-send
};

// ── Locked feature config (mirrors backend) ───────────────────────
const LOCKED_FEATURE_CARDS = {
  scheduling: {
    name: 'Automated Scheduling',
    icon: 'fa-calendar-alt',
    color: 'violet',
    description: 'Set AI agents to run on autopilot — daily, weekly, or monthly.',
    benefit: 'Saves 2-3 hours/week. Never miss a market shift or restock alert.',
    requiredPlan: 'starter',
    price: '$10/mo',
    previewText: 'Your agents could be running analysis while you sleep'
  },
  market_research: {
    name: 'Market Research Agent',
    icon: 'fa-chart-line',
    color: 'blue',
    description: 'Deep competitor analysis, trend detection, and opportunity spotting.',
    benefit: 'Pro users average +18% margin improvement from market insights.',
    requiredPlan: 'starter',
    price: '$10/mo',
    previewText: 'Currently tracking pricing opportunities in your niche'
  },
  advanced_agents: {
    name: 'Advanced AI Agents',
    icon: 'fa-robot',
    color: 'purple',
    description: 'Strategy Agent + Ad Optimization + Customer Segmentation.',
    benefit: 'Full 7-agent suite for complete business intelligence.',
    requiredPlan: 'pro',
    price: '$30/mo',
    previewText: 'Your Strategy Agent has 2 high-value insights waiting'
  },
  analytics: {
    name: 'Business Analytics',
    icon: 'fa-chart-bar',
    color: 'emerald',
    description: 'Deep revenue trend analysis, cohort insights, performance tracking.',
    benefit: 'Know exactly what\'s working — with data.',
    requiredPlan: 'starter',
    price: '$10/mo',
    previewText: 'Revenue trend data ready — unlock to view'
  }
};

// Plan features for comparison
const PLAN_DETAILS = {
  free:    { name:'Free',    price:0,   tokens:'10K/mo',   daily:'2K/day',    color:'gray'   },
  starter: { name:'Starter', price:10,  tokens:'1.2M/mo',  daily:'40K/day',   color:'blue'   },
  pro:     { name:'Pro',     price:30,  tokens:'3.6M/mo',  daily:'120K/day',  color:'violet' },
  scale:   { name:'Scale',   price:100, tokens:'12M/mo',   daily:'400K/day',  color:'emerald' }
};

// ================================================================
// TRIGGER CHECK — Called on page load and key actions
// ================================================================
async function checkUpgradeTrigger(hint) {
  // Don't fire if we showed a trigger too recently
  if (Date.now() - CVT.lastTriggerShown < CVT.MIN_TRIGGER_GAP_MS) return;

  try {
    const url = '/upgrade/check' + (hint ? '?context='+hint : '');
    const r = await api.get(url);
    if (r.success && r.data?.shouldShow && r.data?.trigger) {
      scheduleTrigger(r.data.trigger);
    }
  } catch(_) {}
}

function scheduleTrigger(trigger) {
  // Queue it — show after a 2s delay so it doesn't interrupt page load
  setTimeout(() => showUpgradeTrigger(trigger), 2000);
}

// ================================================================
// SHOW UPGRADE TRIGGER — Banner or Modal based on urgency
// ================================================================
function showUpgradeTrigger(trigger) {
  // Don't spam: one at a time
  if (document.getElementById('upgrade-trigger-banner')) return;

  CVT.activeTrigger = trigger;
  CVT.lastTriggerShown = Date.now();

  if (trigger.urgency === 'critical') {
    showUpgradeModal(trigger);
  } else {
    showUpgradeBanner(trigger);
  }
}

function showUpgradeBanner(trigger) {
  // Remove existing
  document.getElementById('upgrade-trigger-banner')?.remove();

  const urgencyStyles = {
    low:    { bg: 'bg-violet-50 border-violet-200', text: 'text-violet-800', btn: 'bg-violet-600 hover:bg-violet-700' },
    medium: { bg: 'bg-amber-50 border-amber-200',   text: 'text-amber-800',  btn: 'bg-amber-600 hover:bg-amber-700' },
    high:   { bg: 'bg-red-50 border-red-200',       text: 'text-red-800',    btn: 'bg-red-600 hover:bg-red-700' }
  };
  const s = urgencyStyles[trigger.urgency] || urgencyStyles.medium;
  const icons = {
    token_50: 'fa-coins', token_80: 'fa-battery-quarter', token_100: 'fa-ban',
    feature_lock: 'fa-lock', value_moment: 'fa-lightbulb',
    frequency: 'fa-bolt', success_based: 'fa-trophy'
  };
  const icon = icons[trigger.type] || 'fa-arrow-circle-up';

  const el = document.createElement('div');
  el.id = 'upgrade-trigger-banner';
  el.className = `${s.bg} border rounded-xl px-4 py-3 mb-4 flex items-center gap-3 shadow-sm animate-slideUp`;
  el.innerHTML = `
    <i class="fas ${icon} ${s.text} shrink-0"></i>
    <div class="flex-1 min-w-0">
      <div class="font-semibold text-sm ${s.text}">${esc(trigger.headline)}</div>
      <div class="text-xs ${s.text} opacity-80 mt-0.5 line-clamp-1">${esc(trigger.body)}</div>
    </div>
    <button onclick="openUpgradeModal('${trigger.id}')"
      class="${s.btn} text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors shrink-0">
      ${esc(trigger.cta)} →
    </button>
    <button onclick="dismissTrigger('${trigger.id}')"
      class="text-gray-400 hover:text-gray-600 ml-1 shrink-0 transition-colors" title="Dismiss">
      <i class="fas fa-times text-xs"></i>
    </button>
  `;

  // Inject at top of content area
  const content = document.getElementById('content');
  if (content && content.firstChild) {
    content.insertBefore(el, content.firstChild);
  }

  // Auto-dismiss after 20s
  setTimeout(() => {
    if (document.getElementById('upgrade-trigger-banner') === el) {
      el.style.opacity = '0';
      el.style.transition = 'opacity 0.5s';
      setTimeout(() => el.remove(), 500);
    }
  }, 20000);
}

function showUpgradeModal(trigger) {
  CVT.activeTrigger = trigger;
  const plan = PLAN_DETAILS[trigger.suggestedPlan] || PLAN_DETAILS.starter;
  openModal(`
    <div class="p-6">
      <!-- Header -->
      <div class="text-center mb-5">
        <div class="w-14 h-14 bg-violet-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
          <i class="fas fa-rocket text-violet-600 text-xl"></i>
        </div>
        <h2 class="text-xl font-bold text-gray-800">${esc(trigger.headline)}</h2>
        <p class="text-sm text-gray-500 mt-1 max-w-sm mx-auto">${esc(trigger.body)}</p>
      </div>

      <!-- Plan highlight -->
      <div class="bg-gradient-to-br from-violet-600 to-purple-700 rounded-2xl p-5 text-white mb-4">
        <div class="flex items-center justify-between mb-3">
          <div>
            <div class="text-lg font-extrabold">${plan.name} Plan</div>
            <div class="text-violet-200 text-sm">${plan.tokens} · ${plan.daily}</div>
          </div>
          <div class="text-right">
            <div class="text-3xl font-extrabold">$${plan.price}</div>
            <div class="text-violet-200 text-xs">/month</div>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-2 text-xs">
          ${(trigger.benefits||[]).slice(0,4).map(b=>`
            <div class="flex items-center gap-1.5">
              <i class="fas fa-check-circle text-emerald-300 text-xs shrink-0"></i>
              <span class="text-white/90">${esc(b)}</span>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- CTA -->
      <button onclick="clickUpgradeCTA('${trigger.id}','${trigger.suggestedPlan}')"
        class="w-full bg-violet-600 hover:bg-violet-700 text-white font-bold py-3 rounded-xl text-sm transition-colors mb-3">
        <i class="fas fa-arrow-circle-up mr-2"></i>${esc(trigger.cta)}
      </button>
      <button onclick="dismissTrigger('${trigger.id}')"
        class="w-full bg-gray-100 hover:bg-gray-200 text-gray-600 font-medium py-2.5 rounded-xl text-sm transition-colors">
        Maybe later
      </button>

      <p class="text-center text-xs text-gray-400 mt-3">
        <i class="fas fa-lock mr-1"></i>Secure billing · Cancel anytime
      </p>
    </div>
  `);
}

function openUpgradeModal(triggerId) {
  if (CVT.activeTrigger) {
    recordTriggerClick(triggerId);
    showUpgradeModal(CVT.activeTrigger);
  }
}
window.openUpgradeModal = openUpgradeModal;

// dismissTrigger, clickTriggerCTA defined below in CONVERSION ENGINE section
// clickUpgradeCTA wraps clickTriggerCTA for backward compatibility
function clickUpgradeCTA(triggerId, plan) {
  api.post('/upgrade/action', { triggerId, action: 'clicked' }).catch(()=>{});
  toast(`Opening ${plan} plan details...`, 'info');
  setTimeout(() => {
    closeModal({target: document.getElementById('modal')});
    nav('usage');
  }, 800);
}
window.clickUpgradeCTA = clickUpgradeCTA;

function recordTriggerClick(triggerId) {
  api.post('/upgrade/action', { triggerId, action: 'clicked' }).catch(()=>{});
}

// ================================================================
// FEATURE LOCK UI — Called when user hits a locked feature
// ================================================================
function renderLockedFeatureCard(featureKey) {
  const f = LOCKED_FEATURE_CARDS[featureKey];
  if (!f) return '';

  // Log the hit
  logBehaviorEvent('feature_locked_hit', { featureKey });
  // Check for trigger (async)
  api.post('/upgrade/feature-lock', {
    featureKey,
    planName: S.tokens?.planName || 'free'
  }).then(r => {
    if (r.success && r.data?.shouldShow && r.data?.trigger) {
      scheduleTrigger(r.data.trigger);
    }
  }).catch(()=>{});

  return `
    <div class="relative overflow-hidden bg-white rounded-2xl border-2 border-dashed border-gray-200 p-6 text-center">
      <!-- Blurred preview overlay -->
      <div class="absolute inset-0 bg-white/70 backdrop-blur-sm z-10 flex flex-col items-center justify-center p-6 rounded-2xl">
        <div class="w-12 h-12 bg-${f.color}-100 rounded-2xl flex items-center justify-center mb-3">
          <i class="fas fa-lock text-${f.color}-500 text-lg"></i>
        </div>
        <h3 class="font-bold text-gray-800 text-base mb-1">${esc(f.name)}</h3>
        <p class="text-sm text-gray-500 mb-1 max-w-xs">${esc(f.description)}</p>
        <p class="text-xs text-${f.color}-600 font-medium mb-4"><i class="fas fa-star mr-1"></i>${esc(f.benefit)}</p>
        <button onclick="triggerFeatureLock('${featureKey}')"
          class="bg-${f.color}-600 hover:bg-${f.color}-700 text-white font-bold px-5 py-2 rounded-xl text-sm transition-colors">
          Unlock for ${f.price} →
        </button>
      </div>
      <!-- Background preview (blurred) -->
      <div class="blur-sm opacity-40 pointer-events-none select-none">
        <div class="text-4xl mb-2"><i class="fas ${f.icon} text-${f.color}-300"></i></div>
        <p class="text-sm text-gray-400">${esc(f.previewText)}</p>
        <div class="mt-3 space-y-1.5">
          ${[1,2,3].map(()=>`<div class="h-3 bg-gray-200 rounded-full w-${Math.floor(Math.random()*4+6)*10}% mx-auto"></div>`).join('')}
        </div>
      </div>
    </div>
  `;
}

// ================================================================
// VALUE MOMENT — After high-value intent generated
// ================================================================
async function checkValueMoment(intentType) {
  const planName = S.tokens?.planName || 'free';
  if (['pro','scale'].includes(planName)) return;  // Don't nudge pro/scale

  try {
    const r = await api.post('/upgrade/intent-value', { intentType, planName });
    if (r.success && r.data?.shouldShow && r.data?.trigger) {
      scheduleTrigger(r.data.trigger);
    }
    // Show value badge on high-value intents
    if (r.data?.isHighValue) {
      toast('💡 High-value insight generated! Review it carefully.', 'info');
    }
  } catch(_) {}
}

// ================================================================
// TOKEN MILESTONE DISPLAY — Progress bar in main content areas
// ================================================================
function renderTokenProgressBar(tokens, options = {}) {
  const t = tokens || S.tokens;
  if (!t) return '';
  const pct = t.percentage || Math.round((t.tokensUsed / t.tokensGranted) * 100) || 0;
  const daily_pct = Math.round(((t.dailyUsed||0) / (t.dailyLimit||2000)) * 100);
  const { compact = false, showDaily = false } = options;

  const barColor = pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : pct >= 50 ? 'bg-yellow-400' : 'bg-emerald-500';
  const textColor = pct >= 100 ? 'text-red-600' : pct >= 80 ? 'text-amber-600' : 'text-emerald-600';

  if (compact) {
    return `
      <div class="flex items-center gap-2">
        <div class="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div class="${barColor} h-full rounded-full transition-all" style="width:${pct}%"></div>
        </div>
        <span class="text-xs ${textColor} font-medium shrink-0">${pct}%</span>
      </div>
    `;
  }

  return `
    <div class="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
      <div class="flex items-center justify-between mb-2">
        <div class="flex items-center gap-1.5">
          <i class="fas fa-coins text-violet-500 text-xs"></i>
          <span class="text-xs font-semibold text-gray-700">AI Tokens — ${(t.displayName||t.planName||'Free').toUpperCase()} Plan</span>
        </div>
        <span class="text-xs ${textColor} font-bold">${(t.tokensRemaining||0).toLocaleString()} left</span>
      </div>
      <div class="h-2 bg-gray-100 rounded-full overflow-hidden mb-1.5">
        <div class="${barColor} h-full rounded-full transition-all duration-700" style="width:${pct}%"></div>
      </div>
      <div class="flex justify-between text-[10px] text-gray-400">
        <span>${(t.tokensUsed||0).toLocaleString()} used of ${(t.tokensGranted||10000).toLocaleString()}</span>
        <span>${pct}% used</span>
      </div>
      ${pct >= 80 ? `
        <div class="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between">
          <span class="text-xs ${textColor} font-medium">
            <i class="fas fa-exclamation-triangle mr-1"></i>
            ${pct >= 100 ? 'Limit reached' : `${pct}% used — consider upgrading`}
          </span>
          <button onclick="nav('usage')" class="text-xs text-violet-600 font-semibold hover:text-violet-800 transition-colors">
            View Plans →
          </button>
        </div>
      ` : ''}
    </div>
  `;
}

// ================================================================
// CONTEXTUAL UPGRADE CTA — shown in context, not spammy
// ================================================================
function renderUpgradeCTA(context = 'general') {
  const t = S.tokens;
  if (!t) return '';
  const planName = t.planName || 'free';
  if (['pro','scale'].includes(planName)) return '';  // Already on good plan

  const nextPlan = planName === 'free' ? 'Starter' : 'Pro';
  const price = planName === 'free' ? '$10/mo' : '$30/mo';
  const pct = t.percentage || 0;

  // Only show if relevant
  const ctaContexts = {
    schedule: { show: !t.hasScheduling, headline: 'Unlock Scheduling', body: `Run agents automatically with ${nextPlan}` },
    analytics: { show: !t.hasAnalytics, headline: 'Unlock Analytics', body: `Deep business insights with ${nextPlan}` },
    token_warning: { show: pct >= 70, headline: 'More AI Power', body: `${pct}% used — upgrade to ${nextPlan} for more` },
    general: { show: planName === 'free', headline: 'Upgrade to Starter', body: 'Unlock scheduling, analytics & 120× more tokens' }
  };

  const cfg = ctaContexts[context] || ctaContexts.general;
  if (!cfg.show) return '';

  return `
    <div class="bg-gradient-to-r from-violet-50 to-purple-50 border border-violet-200 rounded-xl p-3 flex items-center gap-3">
      <div class="w-8 h-8 bg-violet-100 rounded-lg flex items-center justify-center shrink-0">
        <i class="fas fa-rocket text-violet-600 text-xs"></i>
      </div>
      <div class="flex-1 min-w-0">
        <div class="text-xs font-bold text-violet-800">${cfg.headline}</div>
        <div class="text-xs text-violet-600">${cfg.body}</div>
      </div>
      <button onclick="nav('usage')" class="bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors shrink-0">
        ${price} →
      </button>
    </div>
  `;
}

// ================================================================
// BEHAVIOR LOGGING — batched, fire-and-forget
// ================================================================
function logBehaviorEvent(eventType, data = {}) {
  CVT.behaviorBuffer.push({ eventType, data, ts: Date.now() });
  // Debounce: send after 3s idle
  clearTimeout(CVT._behaviorTimer);
  CVT._behaviorTimer = setTimeout(flushBehaviorBuffer, 3000);
}

async function flushBehaviorBuffer() {
  if (!CVT.behaviorBuffer.length) return;
  const events = CVT.behaviorBuffer.splice(0);
  for (const ev of events) {
    api.post('/upgrade/behavior', { eventType: ev.eventType, eventData: ev.data }).catch(()=>{});
  }
}

// ================================================================
// INITIALIZATION
// ================================================================
async function init() {
  // Check AI status
  try {
    const r = await api.get('/health');
    if(r.status==='ok') {
      const pill = document.getElementById('ai-pill');
      if(pill) pill.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block pulse-dot"></span><span class="text-emerald-600 font-medium text-xs">AI Active · Safe Mode</span>`;
    }
  } catch(_) {}

  // Load token status
  await loadTokenStatus();

  // Check onboarding
  const needsOnboarding = await checkOnboarding();
  if(needsOnboarding) {
    showOnboardingModal();
    return;
  }

  // Seed initial intents if empty
  await ensureIntents();

  // Render default page
  await nav('today');

  // Init chat bubble
  initChatBubble();

  // ── Conversion: check for upgrade trigger after 3s (non-blocking) ─
  setTimeout(() => checkUpgradeTrigger('dashboard'), 3000);

  // ── Log daily active behavior ──────────────────────────────────────
  logBehaviorEvent('daily_active', { page: 'today', planName: S.tokens?.planName || 'free' });

  // Poll every 60s for new scheduled intents + token refresh
  setInterval(async () => {
    await refreshStats();
    await loadTokenStatus();
    // Re-check triggers periodically (won't fire if within cooldown)
    checkUpgradeTrigger('poll');
  }, 60000);
}

async function ensureIntents() {
  const r = await api.get('/intents?limit=1');
  if(r.success && (r.data||[]).length===0) {
    // Auto-generate a few seed intents
    const seeds = [
      {agentName:'BusinessHealthAgent',intentType:'business_health'},
      {agentName:'InventoryAgent',intentType:'inventory_restock'},
      {agentName:'MarketResearchAgent',intentType:'market_trend'}
    ];
    for(const s of seeds) {
      try { await api.post('/intents/generate',s); } catch(_){}
    }
  }
}

// ================================================================
// TOKEN ECONOMY UI
// ================================================================
async function loadTokenStatus() {
  try {
    const r = await api.get('/chat/tokens');
    if(r.success && r.data) {
      S.tokens = r.data;
      renderTokenBar();
    }
  } catch(_) {
    S.tokens = {tokensGranted:50000,tokensUsed:0,tokensRemaining:50000,planName:'starter',percentage:0,hasChat:true};
    renderTokenBar();
  }
}

function renderTokenBar() {
  const t = S.tokens;
  if(!t) return;
  const pct = t.percentage || Math.round((t.tokensUsed/t.tokensGranted)*100) || 0;
  const barColor = pct>=90?'bg-red-500':pct>=70?'bg-amber-500':'bg-emerald-500';
  const planColor = t.planName==='pro'?'text-violet-400':t.planName==='starter'?'text-blue-400':'text-gray-400';

  // Insert or update token bar in sidebar
  let tokenEl = document.getElementById('token-bar');
  if(!tokenEl) {
    tokenEl = document.createElement('div');
    tokenEl.id = 'token-bar';
    tokenEl.className = 'mx-3 mb-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10';
    const sidebar = document.querySelector('aside nav');
    if(sidebar) sidebar.insertBefore(tokenEl, sidebar.firstChild);
  }

  tokenEl.innerHTML = `
    <div class="flex items-center justify-between mb-1">
      <span class="text-[10px] text-white/50 font-medium uppercase tracking-wider">AI Tokens</span>
      <span class="text-[10px] ${planColor} font-bold uppercase">${t.displayName||t.planName||'Free'}</span>
    </div>
    <div class="h-1.5 bg-white/10 rounded-full overflow-hidden mb-1">
      <div class="h-full ${barColor} rounded-full transition-all duration-500" style="width:${pct}%"></div>
    </div>
    <div class="flex justify-between">
      <span class="text-[10px] text-white/40">${(t.tokensUsed||0).toLocaleString()} used</span>
      <span class="text-[10px] text-white/60">${(t.tokensRemaining||0).toLocaleString()} left</span>
    </div>
  `;
}

// ================================================================
// ONBOARDING FLOW
// ================================================================
async function checkOnboarding() {
  try {
    const r = await api.get('/onboarding/status');
    if(r.success && r.data) {
      return !r.data.isComplete;
    }
  } catch(_) {}
  return false;
}

let onboardingStep = 0;
const onboardingData = {};

function showOnboardingModal() {
  onboardingStep = 1;
  renderOnboardingStep();
}

function renderOnboardingStep() {
  const steps = [null, renderOnboard1, renderOnboard2, renderOnboard3, renderOnboard4, renderOnboard5];
  const fn = steps[onboardingStep];
  if(fn) openModal(fn());
}
window.renderOnboardingStep = renderOnboardingStep;

function renderOnboard1() {
  return `
    <div class="p-6">
      <div class="text-center mb-6">
        <div class="w-16 h-16 bg-violet-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
          <i class="fas fa-brain text-violet-600 text-2xl"></i>
        </div>
        <h2 class="text-xl font-bold text-gray-800">Welcome to IntentIQ OS</h2>
        <p class="text-sm text-gray-500 mt-1">Your AI-powered business operating system. Let's set up your profile in 2 minutes.</p>
      </div>
      <div class="bg-violet-50 rounded-xl p-4 mb-5 border border-violet-100">
        <div class="flex items-start gap-3">
          <i class="fas fa-shield-alt text-violet-500 mt-0.5"></i>
          <div>
            <div class="font-semibold text-violet-800 text-sm">Safe Mode — Always On</div>
            <div class="text-xs text-violet-600 mt-0.5">IntentIQ generates recommendations only. Nothing is executed without your explicit approval. AI keys are platform-managed — you never need to provide them.</div>
          </div>
        </div>
      </div>
      <div class="space-y-3">
        <div>
          <label class="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Business Name *</label>
          <input id="ob-bname" type="text" placeholder="e.g. Natural Hair Co." value="${onboardingData.businessName||''}" class="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300">
        </div>
        <div>
          <label class="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Your Niche / Industry *</label>
          <input id="ob-niche" type="text" placeholder="e.g. natural hair products, skincare, fitness gear" value="${onboardingData.niche||''}" class="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300">
        </div>
        <div>
          <label class="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Selling Platform</label>
          <select id="ob-platform" class="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white">
            <option value="shopify" ${onboardingData.platform==='shopify'?'selected':''}>Shopify</option>
            <option value="amazon" ${onboardingData.platform==='amazon'?'selected':''}>Amazon</option>
            <option value="etsy" ${onboardingData.platform==='etsy'?'selected':''}>Etsy</option>
            <option value="woocommerce" ${onboardingData.platform==='woocommerce'?'selected':''}>WooCommerce</option>
            <option value="multi" ${onboardingData.platform==='multi'?'selected':''}>Multi-platform</option>
            <option value="other" ${onboardingData.platform==='other'?'selected':''}>Other</option>
          </select>
        </div>
      </div>
      <div class="flex items-center justify-between mt-2">
        <div class="flex gap-1">${[1,2,3,4,5].map(i=>`<div class="w-6 h-1.5 rounded-full ${i===1?'bg-violet-500':'bg-gray-200'}"></div>`).join('')}</div>
        <button onclick="nextOnboard(1)" class="bg-violet-600 hover:bg-violet-700 text-white font-bold px-6 py-2.5 rounded-xl text-sm transition-colors">
          Next <i class="fas fa-arrow-right ml-1"></i>
        </button>
      </div>
    </div>
  `;
}

function renderOnboard2() {
  return `
    <div class="p-6">
      <h3 class="font-bold text-gray-800 text-lg mb-1"><i class="fas fa-dollar-sign text-emerald-500 mr-2"></i>Business Metrics</h3>
      <p class="text-sm text-gray-500 mb-4">Help your AI agents give accurate recommendations.</p>
      <div class="space-y-3">
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Monthly Revenue (approx)</label>
            <select id="ob-revenue" class="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white">
              <option value="0">Just starting</option>
              <option value="1000" ${onboardingData.monthlyRevenue==1000?'selected':''}>Under $1K</option>
              <option value="5000" ${onboardingData.monthlyRevenue==5000?'selected':''}>$1K–$5K</option>
              <option value="10000" ${onboardingData.monthlyRevenue==10000?'selected':''}>$5K–$10K</option>
              <option value="25000" ${onboardingData.monthlyRevenue==25000?'selected':''}>$10K–$25K</option>
              <option value="50000" ${onboardingData.monthlyRevenue==50000?'selected':''}>$25K–$50K</option>
              <option value="100000" ${onboardingData.monthlyRevenue==100000?'selected':''}>$50K+</option>
            </select>
          </div>
          <div>
            <label class="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Team Size</label>
            <select id="ob-team" class="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white">
              <option value="solo" ${onboardingData.teamSize==='solo'?'selected':''}>Solo founder</option>
              <option value="small" ${onboardingData.teamSize==='small'?'selected':''}>Small (2–5)</option>
              <option value="medium" ${onboardingData.teamSize==='medium'?'selected':''}>Medium (6–20)</option>
              <option value="large" ${onboardingData.teamSize==='large'?'selected':''}>Large (20+)</option>
            </select>
          </div>
        </div>
        <div>
          <label class="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Pricing Strategy</label>
          <div class="grid grid-cols-3 gap-2">
            ${['aggressive','moderate','premium'].map(p=>`
              <button onclick="selectStyle('pricing','${p}')" id="ps-${p}" class="p-2.5 rounded-xl border-2 text-xs font-semibold transition-colors ${onboardingData.pricingStyle===p?'border-violet-500 bg-violet-50 text-violet-700':'border-gray-200 text-gray-500 hover:border-violet-300'}">
                ${p==='aggressive'?'🏷️ Aggressive':p==='moderate'?'⚖️ Moderate':'💎 Premium'}
              </button>
            `).join('')}
          </div>
        </div>
        <div>
          <label class="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Risk Tolerance</label>
          <div class="grid grid-cols-3 gap-2">
            ${['conservative','balanced','aggressive'].map(r=>`
              <button onclick="selectStyle('risk','${r}')" id="rt-${r}" class="p-2.5 rounded-xl border-2 text-xs font-semibold transition-colors ${onboardingData.riskTolerance===r?'border-violet-500 bg-violet-50 text-violet-700':'border-gray-200 text-gray-500 hover:border-violet-300'}">
                ${r==='conservative'?'🛡️ Conservative':r==='balanced'?'⚖️ Balanced':'🚀 Aggressive'}
              </button>
            `).join('')}
          </div>
        </div>
      </div>
      <div class="flex items-center justify-between mt-4">
        <button onclick="onboardingStep=1;renderOnboardingStep()" class="text-gray-400 text-sm hover:text-gray-600 flex items-center gap-1"><i class="fas fa-arrow-left"></i> Back</button>
        <div class="flex gap-1">${[1,2,3,4,5].map(i=>`<div class="w-6 h-1.5 rounded-full ${i<=2?'bg-violet-500':'bg-gray-200'}"></div>`).join('')}</div>
        <button onclick="nextOnboard(2)" class="bg-violet-600 hover:bg-violet-700 text-white font-bold px-6 py-2.5 rounded-xl text-sm transition-colors">Next <i class="fas fa-arrow-right ml-1"></i></button>
      </div>
    </div>
  `;
}

function renderOnboard3() {
  const cats = ['Hair Care','Skin Care','Beauty','Fitness','Supplements','Apparel','Tech Accessories','Home Goods','Food & Beverage','Pets','Books','Crafts'];
  const selected = onboardingData.focusCategories || [];
  return `
    <div class="p-6">
      <h3 class="font-bold text-gray-800 text-lg mb-1"><i class="fas fa-th-large text-violet-500 mr-2"></i>Focus Categories</h3>
      <p class="text-sm text-gray-500 mb-4">Select up to 4 categories your business focuses on. Your agents will prioritize these.</p>
      <div class="grid grid-cols-3 gap-2 mb-4">
        ${cats.map(cat=>`
          <button onclick="toggleCategory('${cat}')" id="cat-${cat.replace(/\s+/g,'-')}" class="p-2.5 rounded-xl border-2 text-xs font-medium transition-colors ${selected.includes(cat)?'border-violet-500 bg-violet-50 text-violet-700':'border-gray-200 text-gray-600 hover:border-violet-300'}">
            ${cat}
          </button>
        `).join('')}
      </div>
      <div>
        <label class="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Top Products (comma separated)</label>
        <input id="ob-products" type="text" placeholder="e.g. Shea Moisture Curl Cream, Edge Control, Hair Oil" value="${(onboardingData.topProducts||[]).join(', ')}" class="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300">
      </div>
      <div class="flex items-center justify-between mt-4">
        <button onclick="onboardingStep=2;renderOnboardingStep()" class="text-gray-400 text-sm hover:text-gray-600 flex items-center gap-1"><i class="fas fa-arrow-left"></i> Back</button>
        <div class="flex gap-1">${[1,2,3,4,5].map(i=>`<div class="w-6 h-1.5 rounded-full ${i<=3?'bg-violet-500':'bg-gray-200'}"></div>`).join('')}</div>
        <button onclick="nextOnboard(3)" class="bg-violet-600 hover:bg-violet-700 text-white font-bold px-6 py-2.5 rounded-xl text-sm transition-colors">Next <i class="fas fa-arrow-right ml-1"></i></button>
      </div>
    </div>
  `;
}

function renderOnboard4() {
  const goals = ['Increase Revenue','Improve Inventory Management','Launch New Products','Grow Email List','Optimize Pricing','Reduce Costs','Enter New Markets','Improve Customer Retention'];
  const selected = onboardingData.goals || [];
  return `
    <div class="p-6">
      <h3 class="font-bold text-gray-800 text-lg mb-1"><i class="fas fa-bullseye text-violet-500 mr-2"></i>Business Goals</h3>
      <p class="text-sm text-gray-500 mb-4">What are your top priorities? Select all that apply. Your AI agents will focus on these.</p>
      <div class="grid grid-cols-2 gap-2 mb-4">
        ${goals.map(g=>`
          <button onclick="toggleGoal('${g}')" id="goal-${g.replace(/\s+/g,'-')}" class="p-3 rounded-xl border-2 text-xs font-medium text-left transition-colors ${selected.includes(g)?'border-violet-500 bg-violet-50 text-violet-700':'border-gray-200 text-gray-600 hover:border-violet-300'}">
            ${g}
          </button>
        `).join('')}
      </div>
      <div class="flex items-center justify-between mt-4">
        <button onclick="onboardingStep=3;renderOnboardingStep()" class="text-gray-400 text-sm hover:text-gray-600 flex items-center gap-1"><i class="fas fa-arrow-left"></i> Back</button>
        <div class="flex gap-1">${[1,2,3,4,5].map(i=>`<div class="w-6 h-1.5 rounded-full ${i<=4?'bg-violet-500':'bg-gray-200'}"></div>`).join('')}</div>
        <button onclick="nextOnboard(4)" class="bg-violet-600 hover:bg-violet-700 text-white font-bold px-6 py-2.5 rounded-xl text-sm transition-colors">Next <i class="fas fa-arrow-right ml-1"></i></button>
      </div>
    </div>
  `;
}

function renderOnboard5() {
  return `
    <div class="p-6 text-center">
      <div class="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
        <i class="fas fa-rocket text-emerald-600 text-2xl"></i>
      </div>
      <h3 class="font-bold text-gray-800 text-xl mb-1">You're all set!</h3>
      <p class="text-sm text-gray-500 mb-4">Your AI agents are ready. We'll generate your first business analysis right now.</p>
      <div class="bg-gray-50 rounded-xl p-4 mb-5 text-left space-y-2">
        <div class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Your Setup Summary</div>
        <div class="flex gap-2 text-sm"><span class="text-gray-400 w-28">Business:</span><span class="font-medium text-gray-700">${esc(onboardingData.businessName||'')}</span></div>
        <div class="flex gap-2 text-sm"><span class="text-gray-400 w-28">Niche:</span><span class="font-medium text-gray-700">${esc(onboardingData.niche||'')}</span></div>
        <div class="flex gap-2 text-sm"><span class="text-gray-400 w-28">Platform:</span><span class="font-medium text-gray-700 capitalize">${esc(onboardingData.platform||'')}</span></div>
        <div class="flex gap-2 text-sm"><span class="text-gray-400 w-28">AI Keys:</span><span class="font-medium text-emerald-600"><i class="fas fa-check-circle mr-1"></i>Platform-managed (no setup needed)</span></div>
      </div>
      <button onclick="completeOnboarding()" id="ob-finish-btn" class="w-full bg-violet-600 hover:bg-violet-700 text-white font-bold px-6 py-3 rounded-xl text-sm transition-colors flex items-center justify-center gap-2">
        <i class="fas fa-magic"></i> Launch My AI Team
      </button>
      <div class="flex gap-1 justify-center mt-3">${[1,2,3,4,5].map(i=>`<div class="w-6 h-1.5 rounded-full bg-violet-500"></div>`).join('')}</div>
    </div>
  `;
}

function selectStyle(type, val) {
  if(type==='pricing') {
    onboardingData.pricingStyle = val;
    ['aggressive','moderate','premium'].forEach(p => {
      const el = document.getElementById(`ps-${p}`);
      if(el) { el.className = el.className.replace(/border-violet-500 bg-violet-50 text-violet-700|border-gray-200 text-gray-500/g,''); el.classList.add(p===val?'border-violet-500':'border-gray-200', p===val?'bg-violet-50':'','text-'+(p===val?'violet':'gray')+'-'+(p===val?'700':'500')); }
    });
  } else {
    onboardingData.riskTolerance = val;
    ['conservative','balanced','aggressive'].forEach(r => {
      const el = document.getElementById(`rt-${r}`);
      if(el) { el.className = el.className.replace(/border-violet-500 bg-violet-50 text-violet-700|border-gray-200 text-gray-500/g,''); el.classList.toggle('border-violet-500',r===val); el.classList.toggle('border-gray-200',r!==val); }
    });
  }
}
window.selectStyle = selectStyle;

function toggleCategory(cat) {
  onboardingData.focusCategories = onboardingData.focusCategories || [];
  const idx = onboardingData.focusCategories.indexOf(cat);
  if(idx>=0) { onboardingData.focusCategories.splice(idx,1); } else if(onboardingData.focusCategories.length<4) { onboardingData.focusCategories.push(cat); } else { toast('Max 4 categories','warning'); return; }
  const el = document.getElementById('cat-'+cat.replace(/\s+/g,'-'));
  if(el) { el.classList.toggle('border-violet-500',idx<0); el.classList.toggle('bg-violet-50',idx<0); el.classList.toggle('text-violet-700',idx<0); el.classList.toggle('border-gray-200',idx>=0); el.classList.toggle('text-gray-600',idx>=0); }
}
window.toggleCategory = toggleCategory;

function toggleGoal(g) {
  onboardingData.goals = onboardingData.goals || [];
  const idx = onboardingData.goals.indexOf(g);
  if(idx>=0) { onboardingData.goals.splice(idx,1); } else { onboardingData.goals.push(g); }
  const el = document.getElementById('goal-'+g.replace(/\s+/g,'-'));
  if(el) { el.classList.toggle('border-violet-500',idx<0); el.classList.toggle('bg-violet-50',idx<0); el.classList.toggle('text-violet-700',idx<0); el.classList.toggle('border-gray-200',idx>=0); el.classList.toggle('text-gray-600',idx>=0); }
}
window.toggleGoal = toggleGoal;

function nextOnboard(step) {
  if(step===1) {
    const bname = document.getElementById('ob-bname')?.value?.trim();
    const niche = document.getElementById('ob-niche')?.value?.trim();
    const platform = document.getElementById('ob-platform')?.value;
    if(!bname) { toast('Please enter your business name','warning'); return; }
    if(!niche) { toast('Please enter your niche or industry','warning'); return; }
    onboardingData.businessName = bname;
    onboardingData.niche = niche;
    onboardingData.platform = platform;
    onboardingStep = 2;
  } else if(step===2) {
    onboardingData.monthlyRevenue = parseInt(document.getElementById('ob-revenue')?.value||'0');
    onboardingData.teamSize = document.getElementById('ob-team')?.value||'solo';
    if(!onboardingData.pricingStyle) onboardingData.pricingStyle = 'moderate';
    if(!onboardingData.riskTolerance) onboardingData.riskTolerance = 'balanced';
    onboardingStep = 3;
  } else if(step===3) {
    const prods = document.getElementById('ob-products')?.value?.trim();
    onboardingData.topProducts = prods ? prods.split(',').map(p=>p.trim()).filter(Boolean) : [];
    onboardingStep = 4;
  } else if(step===4) {
    onboardingStep = 5;
  }
  renderOnboardingStep();
}
window.nextOnboard = nextOnboard;

async function completeOnboarding() {
  const btn = document.getElementById('ob-finish-btn');
  if(btn) btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Setting up your AI team...';
  try {
    const r = await api.post('/onboarding/complete', onboardingData);
    if(r.success) {
      toast(`🚀 Welcome to IntentIQ, ${onboardingData.businessName}!`, 'success');
      closeModal();
      // Start the app now
      await ensureIntents();
      await nav('today');
      initChatBubble();
      setInterval(async()=>{ await refreshStats(); await loadTokenStatus(); }, 60000);
    } else {
      toast('Setup failed: '+(r.error||'Unknown error'), 'error');
      if(btn) btn.innerHTML = '<i class="fas fa-magic mr-2"></i>Try Again';
    }
  } catch(err) {
    toast('Connection error. Please try again.', 'error');
    if(btn) btn.innerHTML = '<i class="fas fa-magic mr-2"></i>Try Again';
  }
}
window.completeOnboarding = completeOnboarding;

// ================================================================
// CHAT BUBBLE — Corner AI Assistant
// ================================================================
let chatOpen = false;
let chatHistory = [];
let chatTyping = false;

function initChatBubble() {
  // Remove existing if present
  const existing = document.getElementById('chat-bubble-wrap');
  if(existing) existing.remove();

  const wrap = document.createElement('div');
  wrap.id = 'chat-bubble-wrap';
  wrap.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:200;font-family:Inter,sans-serif;';
  wrap.innerHTML = `
    <!-- Chat Window -->
    <div id="chat-window" style="display:none;width:340px;max-height:480px;background:white;border-radius:20px;box-shadow:0 20px 60px rgba(0,0,0,0.15);border:1px solid #e2e8f0;flex-direction:column;overflow:hidden;" class="flex">
      <!-- Header -->
      <div style="background:linear-gradient(135deg,#1a0f3a,#4c1d95);padding:14px 16px;display:flex;align-items:center;justify-content:space-between;">
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="width:32px;height:32px;background:rgba(167,139,250,0.3);border-radius:10px;display:flex;align-items:center;justify-content:center;">
            <i class="fas fa-brain" style="color:#a78bfa;font-size:14px;"></i>
          </div>
          <div>
            <div style="color:white;font-size:13px;font-weight:700;">IntentIQ Assistant</div>
            <div style="color:rgba(167,139,250,0.8);font-size:10px;">Platform AI · Token-aware</div>
          </div>
        </div>
        <button onclick="toggleChat()" style="background:rgba(255,255,255,0.1);border:none;color:white;width:28px;height:28px;border-radius:8px;cursor:pointer;font-size:12px;" title="Close">✕</button>
      </div>
      <!-- Messages -->
      <div id="chat-msgs" style="flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:8px;min-height:200px;max-height:300px;">
        <div style="background:#f8f4ff;border-radius:12px;padding:10px 12px;font-size:12.5px;color:#4c1d95;border:1px solid #ede9fe;">
          👋 Hi! I'm your IntentIQ Assistant. Ask me anything about your business, AI recommendations, or strategy. What's on your mind?
        </div>
      </div>
      <!-- Token bar -->
      <div id="chat-token-info" style="padding:6px 12px;background:#f8fafc;border-top:1px solid #f1f5f9;display:flex;align-items:center;justify-content:space-between;font-size:10px;color:#94a3b8;">
        <span>AI tokens: platform-managed</span>
        <span id="chat-tokens-left" style="color:#7c3aed;font-weight:600;"></span>
      </div>
      <!-- Input -->
      <div style="padding:10px 12px;border-top:1px solid #f1f5f9;display:flex;gap:8px;">
        <input id="chat-input" type="text" placeholder="Ask anything..." maxlength="500"
          style="flex:1;border:1px solid #e2e8f0;border-radius:12px;padding:8px 12px;font-size:12px;outline:none;font-family:Inter,sans-serif;"
          onkeydown="if(event.key==='Enter')sendChat()"
          onfocus="this.style.borderColor='#7c3aed'" onblur="this.style.borderColor='#e2e8f0'">
        <button onclick="sendChat()" id="chat-send-btn"
          style="background:#7c3aed;color:white;border:none;border-radius:12px;padding:8px 14px;cursor:pointer;font-size:12px;font-weight:600;white-space:nowrap;">
          Send
        </button>
      </div>
    </div>

    <!-- Bubble Button -->
    <button onclick="toggleChat()" id="chat-bubble-btn"
      style="width:52px;height:52px;background:linear-gradient(135deg,#7c3aed,#4c1d95);border:none;border-radius:50%;cursor:pointer;box-shadow:0 4px 20px rgba(124,58,237,0.4);display:flex;align-items:center;justify-content:center;margin-top:10px;margin-left:auto;transition:transform 0.2s;"
      onmouseover="this.style.transform='scale(1.08)'" onmouseout="this.style.transform='scale(1)'">
      <i class="fas fa-comment-dots" style="color:white;font-size:18px;" id="chat-icon"></i>
      <span id="chat-unread" style="display:none;position:absolute;top:0;right:0;background:#ef4444;color:white;border-radius:50%;width:18px;height:18px;font-size:10px;font-weight:700;align-items:center;justify-content:center;">1</span>
    </button>
  `;
  document.body.appendChild(wrap);
  updateChatTokenDisplay();
}

function toggleChat() {
  chatOpen = !chatOpen;
  const win = document.getElementById('chat-window');
  const icon = document.getElementById('chat-icon');
  const unread = document.getElementById('chat-unread');
  if(win) win.style.display = chatOpen ? 'flex' : 'none';
  if(icon) icon.className = chatOpen ? 'fas fa-times' : 'fas fa-comment-dots';
  if(unread) unread.style.display = 'none';
  if(chatOpen) {
    updateChatTokenDisplay();
    setTimeout(()=>document.getElementById('chat-input')?.focus(), 100);
  }
}
window.toggleChat = toggleChat;

function updateChatTokenDisplay() {
  const el = document.getElementById('chat-tokens-left');
  if(el && S.tokens) {
    el.textContent = `${(S.tokens.tokensRemaining||0).toLocaleString()} tokens left`;
  }
}

async function sendChat() {
  if(chatTyping) return;
  const input = document.getElementById('chat-input');
  const msg = input?.value?.trim();
  if(!msg) return;
  input.value = '';

  // Check chat access
  if(S.tokens && !S.tokens.hasChat) {
    addChatMsg('assistant', '💎 The chat assistant is available on Starter plan and above. Upgrade to get full access to conversational AI guidance.');
    return;
  }

  // Check tokens
  if(S.tokens && S.tokens.tokensRemaining <= 0) {
    addChatMsg('assistant', '⚠️ You\'ve used all your monthly AI tokens. Upgrade your plan to continue using the chat assistant.');
    return;
  }

  addChatMsg('user', msg);
  chatHistory.push({role:'user', content:msg});

  // Show typing
  chatTyping = true;
  const typingId = 'typing-'+Date.now();
  addChatMsg('assistant', '<i class="fas fa-circle" style="animation:pulse 0.6s infinite;font-size:6px;"></i> <i class="fas fa-circle" style="animation:pulse 0.6s infinite 0.2s;font-size:6px;"></i> <i class="fas fa-circle" style="animation:pulse 0.6s infinite 0.4s;font-size:6px;"></i>', typingId);

  try {
    const r = await api.post('/chat/message', {message: msg, history: chatHistory.slice(-6)});
    // Remove typing
    document.getElementById(typingId)?.remove();
    chatTyping = false;

    if(r.success && r.data) {
      const reply = r.data.reply || 'Sorry, I couldn\'t process that. Please try again.';
      addChatMsg('assistant', reply);
      chatHistory.push({role:'assistant', content:reply});
      // Update token display
      if(r.data.tokensRemaining !== undefined) {
        if(!S.tokens) S.tokens = {};
        S.tokens.tokensRemaining = r.data.tokensRemaining;
        S.tokens.tokensUsed = (S.tokens.tokensGranted||50000) - r.data.tokensRemaining;
        S.tokens.percentage = Math.round(((S.tokens.tokensUsed)/(S.tokens.tokensGranted||50000))*100);
        updateChatTokenDisplay();
        renderTokenBar();
      }
      if(r.upgradeRequired) {
        addChatMsg('assistant', '💡 <strong>Upgrade tip:</strong> You\'ve reached your token limit. Upgrade to Starter or Pro for more AI capacity.');
      }
    } else if(r.upgradeRequired) {
      document.getElementById(typingId)?.remove();
      addChatMsg('assistant', '⚠️ You\'ve reached your monthly token limit. Upgrade your plan to continue. Visit Business Profile → Subscription.');
    } else {
      addChatMsg('assistant', 'Something went wrong. Please try again in a moment.');
    }
  } catch(err) {
    document.getElementById(typingId)?.remove();
    chatTyping = false;
    addChatMsg('assistant', 'Connection error. Please check your connection and try again.');
  }
}
window.sendChat = sendChat;

function addChatMsg(role, content, id) {
  const msgs = document.getElementById('chat-msgs');
  if(!msgs) return;
  const el = document.createElement('div');
  if(id) el.id = id;
  const isUser = role === 'user';
  el.style.cssText = `border-radius:12px;padding:9px 12px;font-size:12.5px;line-height:1.5;${
    isUser
      ? 'background:linear-gradient(135deg,#7c3aed,#4c1d95);color:white;align-self:flex-end;max-width:85%;margin-left:auto;'
      : 'background:#f8f4ff;color:#374151;border:1px solid #ede9fe;max-width:90%;'
  }`;
  el.innerHTML = content;
  msgs.appendChild(el);
  msgs.scrollTop = msgs.scrollHeight;
}

// ================================================================
// CONVERSION ENGINE — Frontend
// Behavioral trigger detection, upgrade prompts as intents,
// locked feature cards, contextual CTAs, A/B variants.
// Rule: helpful, not pushy. Max 1 trigger per page load.
// ================================================================

// ── Conversion state ──────────────────────────────────────────────
const Conv = {
  lastTrigger: null,        // Most recent trigger object
  triggerShownAt: 0,        // Timestamp of last trigger shown
  triggerCooldownMs: 5 * 60 * 1000,  // 5 min between showing triggers
  sessionUpgradeSeen: false, // Track if upgrade was shown this session
  chatUpgradeMentioned: false // Track if chat mentioned upgrade
};

// ── Trigger urgency → style maps ─────────────────────────────────
const URGENCY_STYLE = {
  low:      { bg:'bg-violet-50',  border:'border-violet-200', icon:'fa-lightbulb',         iconColor:'text-violet-500', ctaBg:'bg-violet-600 hover:bg-violet-700' },
  medium:   { bg:'bg-amber-50',   border:'border-amber-200',  icon:'fa-arrow-circle-up',   iconColor:'text-amber-500',  ctaBg:'bg-amber-500 hover:bg-amber-600' },
  high:     { bg:'bg-orange-50',  border:'border-orange-200', icon:'fa-exclamation-circle', iconColor:'text-orange-500', ctaBg:'bg-orange-500 hover:bg-orange-600' },
  critical: { bg:'bg-red-50',     border:'border-red-200',    icon:'fa-times-circle',      iconColor:'text-red-500',    ctaBg:'bg-red-600 hover:bg-red-700' }
};

// ── Locked feature config (mirrors backend) ───────────────────────
const LOCKED_FEATURES_UI = {
  scheduling:      { name:'Automated Scheduling', icon:'fa-calendar-alt', color:'violet', requiredPlan:'starter', preview:'Set agents to run daily/weekly — no manual triggers needed', benefit:'Saves 2-3 hrs/week' },
  market_research: { name:'Market Research Agent', icon:'fa-chart-line', color:'blue', requiredPlan:'starter', preview:'Competitor pricing, trend signals, opportunity detection', benefit:'Avg +18% margin improvement' },
  advanced_agents: { name:'Advanced AI Agents', icon:'fa-robot', color:'purple', requiredPlan:'pro', preview:'Strategy + Ad Optimization + Customer Segmentation agents', benefit:'Full 7-agent intelligence suite' },
  analytics:       { name:'Business Analytics', icon:'fa-chart-bar', color:'emerald', requiredPlan:'starter', preview:'Revenue trends, cohort insights, performance breakdown', benefit:'See exactly what drives growth' },
  workflows:       { name:'Multi-Step Workflows', icon:'fa-project-diagram', color:'indigo', requiredPlan:'starter', preview:'Chain agents into product launches, marketing sprints, restock cycles', benefit:'End-to-end guided execution' }
};

// ================================================================
// TRIGGER BANNER — Inline, non-modal, dismissible
// ================================================================
function showTriggerBanner(trigger) {
  if (!trigger) return;

  // Anti-spam: don't show if shown recently
  const now = Date.now();
  if (now - Conv.triggerShownAt < Conv.triggerCooldownMs) return;

  // Don't show low urgency on critical pages (already dealing with limit)
  if (trigger.urgency === 'low' && (S.tokens?.percentage ?? 0) >= 95) return;

  Conv.lastTrigger = trigger;
  Conv.triggerShownAt = now;
  Conv.sessionUpgradeSeen = true;

  const style = URGENCY_STYLE[trigger.urgency] || URGENCY_STYLE.medium;

  // Create banner element
  let banner = document.getElementById('upgrade-trigger-banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'upgrade-trigger-banner';
    banner.style.cssText = 'animation:slideUp 0.3s ease;';

    // Insert after page-header if on today page, else top of content
    const content = document.getElementById('content');
    if (content?.firstElementChild) {
      content.insertBefore(banner, content.firstElementChild.nextSibling);
    }
  }

  const priceText = trigger.suggestedPlanPrice > 0
    ? `$${trigger.suggestedPlanPrice}/mo`
    : 'Free';
  const planName = trigger.suggestedPlan
    ? trigger.suggestedPlan.charAt(0).toUpperCase() + trigger.suggestedPlan.slice(1)
    : 'Starter';

  banner.className = `${style.bg} border ${style.border} rounded-2xl p-4 mb-4 flex gap-3 items-start`;
  banner.innerHTML = `
    <div class="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${style.bg}">
      <i class="fas ${style.icon} ${style.iconColor}"></i>
    </div>
    <div class="flex-1 min-w-0">
      <div class="font-semibold text-gray-800 text-sm">${esc(trigger.headline)}</div>
      <div class="text-xs text-gray-600 mt-0.5 leading-relaxed">${esc(trigger.body)}</div>
      ${trigger.benefits?.length > 0 ? `
        <div class="flex flex-wrap gap-1.5 mt-2">
          ${trigger.benefits.slice(0,3).map(b=>`<span class="text-[10px] bg-white border border-gray-200 text-gray-600 px-2 py-0.5 rounded-full">${esc(b)}</span>`).join('')}
        </div>
      ` : ''}
    </div>
    <div class="flex gap-2 items-center shrink-0">
      <button onclick="clickTriggerCTA('${trigger.id}')"
        class="${style.ctaBg} text-white text-xs font-bold px-3 py-2 rounded-xl transition-colors whitespace-nowrap">
        ${esc(trigger.cta)} · ${priceText}
      </button>
      <button onclick="dismissTrigger('${trigger.id}')"
        class="w-6 h-6 rounded-lg bg-white/60 hover:bg-white text-gray-400 hover:text-gray-600 flex items-center justify-center transition-colors text-xs"
        title="Dismiss">
        <i class="fas fa-times"></i>
      </button>
    </div>
  `;
}
window.showTriggerBanner = showTriggerBanner;

function dismissTrigger(triggerId) {
  const banner = document.getElementById('upgrade-trigger-banner');
  if (banner) {
    banner.style.opacity = '0';
    banner.style.transform = 'translateY(-8px)';
    banner.style.transition = 'all 0.25s';
    setTimeout(() => banner.remove(), 250);
  }
  // Log dismissal
  api.post('/upgrade/action', { triggerId, action: 'dismissed' }).catch(() => {});
}
window.dismissTrigger = dismissTrigger;

function clickTriggerCTA(triggerId) {
  // Log the click
  api.post('/upgrade/action', { triggerId, action: 'clicked' }).catch(() => {});
  // Navigate to usage/plans page
  nav('usage');
  dismissTrigger(triggerId);
}
window.clickTriggerCTA = clickTriggerCTA;

// ================================================================
// INLINE USAGE PROGRESS BAR (in dashboard + today views)
// ================================================================
function renderInlineUsageBar(containerId) {
  const t = S.tokens;
  if (!t) return '';
  const pct = t.percentage || Math.round(((t.tokensUsed||0) / (t.tokensGranted||10000)) * 100);
  const dailyPct = t.dailyPercentage || Math.round(((t.dailyUsed||0) / (t.dailyLimit||2000)) * 100);
  const barColor = pct>=90?'bg-red-500':pct>=70?'bg-amber-500':'bg-emerald-500';
  const planName = t.planName || 'free';
  const isFree = planName === 'free';

  return `
    <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-4">
      <div class="flex items-center justify-between mb-2">
        <div class="flex items-center gap-2">
          <i class="fas fa-coins text-violet-400 text-xs"></i>
          <span class="text-xs font-semibold text-gray-700">AI Token Usage</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-[10px] font-bold uppercase ${
            planName==='pro'?'text-violet-600 bg-violet-50':
            planName==='starter'?'text-blue-600 bg-blue-50':
            planName==='scale'?'text-emerald-600 bg-emerald-50':
            'text-gray-500 bg-gray-100'
          } px-2 py-0.5 rounded-full border border-current/20">${t.displayName || planName.charAt(0).toUpperCase()+planName.slice(1)}</span>
          <button onclick="nav('usage')" class="text-[10px] text-violet-500 hover:text-violet-700 font-medium">Details →</button>
        </div>
      </div>
      <div class="h-2 bg-gray-100 rounded-full overflow-hidden mb-1">
        <div class="${barColor} h-full rounded-full transition-all duration-700" style="width:${pct}%"></div>
      </div>
      <div class="flex justify-between text-[10px] text-gray-400">
        <span>${(t.tokensUsed||0).toLocaleString()} used</span>
        <span>${(t.tokensRemaining||0).toLocaleString()} remaining (${100-pct}%)</span>
      </div>
      ${pct >= 80 && isFree ? `
        <div class="mt-2 flex items-center justify-between bg-amber-50 rounded-xl px-3 py-2">
          <span class="text-xs text-amber-700 font-medium">
            <i class="fas fa-exclamation-triangle mr-1"></i>
            ${pct>=100?'Token limit reached':'Running low on tokens'}
          </span>
          <button onclick="nav('usage')" class="text-[10px] font-bold text-amber-700 bg-amber-100 hover:bg-amber-200 px-2.5 py-1 rounded-lg transition-colors">
            Upgrade Plan
          </button>
        </div>
      ` : ''}
    </div>
  `;
}

// ================================================================
// LOCKED FEATURE CARD — Shows blurred preview + benefit + CTA
// ================================================================
function lockedFeatureCard(featureKey, opts = {}) {
  const feat = LOCKED_FEATURES_UI[featureKey];
  if (!feat) return '';

  const planName = S.tokens?.planName || 'free';
  const planHier = ['free','starter','pro','scale'];
  const currentLevel = planHier.indexOf(planName);
  const requiredLevel = planHier.indexOf(feat.requiredPlan);
  if (currentLevel >= requiredLevel) return ''; // Already unlocked

  const planLabel = feat.requiredPlan.charAt(0).toUpperCase() + feat.requiredPlan.slice(1);
  const price = feat.requiredPlan === 'starter' ? '$10/mo' : feat.requiredPlan === 'pro' ? '$30/mo' : '$100/mo';

  return `
    <div class="relative rounded-2xl border-2 border-dashed border-${feat.color}-200 bg-${feat.color}-50/30 overflow-hidden" ${opts.compact ? 'style="min-height:80px"' : 'style="min-height:120px"'}>
      <!-- Blurred preview content -->
      <div class="p-4 filter blur-[2px] pointer-events-none select-none opacity-40">
        <div class="h-3 bg-${feat.color}-200 rounded w-3/4 mb-2"></div>
        <div class="h-2 bg-${feat.color}-100 rounded w-full mb-1.5"></div>
        <div class="h-2 bg-${feat.color}-100 rounded w-5/6"></div>
      </div>
      <!-- Overlay -->
      <div class="absolute inset-0 flex flex-col items-center justify-center p-4 text-center">
        <div class="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center mb-2">
          <i class="fas ${feat.icon} text-${feat.color}-500 text-base"></i>
        </div>
        <div class="font-bold text-gray-800 text-sm mb-0.5">${feat.name}</div>
        <div class="text-xs text-gray-500 mb-1">${feat.preview}</div>
        <div class="text-[10px] text-${feat.color}-600 font-semibold mb-2">✨ ${feat.benefit}</div>
        <button onclick="triggerFeatureLock('${featureKey}')"
          class="bg-white border border-${feat.color}-300 text-${feat.color}-700 text-[11px] font-bold px-3 py-1.5 rounded-xl hover:bg-${feat.color}-50 transition-colors shadow-sm">
          <i class="fas fa-lock-open mr-1"></i>Unlock with ${planLabel} · ${price}
        </button>
      </div>
    </div>
  `;
}
window.lockedFeatureCard = lockedFeatureCard;

async function triggerFeatureLock(featureKey) {
  const planName = S.tokens?.planName || 'free';
  try {
    const r = await api.post('/upgrade/feature-lock', { featureKey, planName });
    if (r.success && r.data?.shouldShow && r.data?.trigger) {
      showFeatureLockModal(r.data.trigger, r.data.featureData);
    } else {
      // Fallback: just go to usage page
      nav('usage');
    }
  } catch(_) {
    nav('usage');
  }
}
window.triggerFeatureLock = triggerFeatureLock;

function showFeatureLockModal(trigger, featureData) {
  if (!trigger) return;
  const style = URGENCY_STYLE[trigger.urgency] || URGENCY_STYLE.medium;
  const planLabel = trigger.suggestedPlan?.charAt(0).toUpperCase() + (trigger.suggestedPlan?.slice(1) ?? '');
  const price = trigger.suggestedPlanPrice > 0 ? `$${trigger.suggestedPlanPrice}/mo` : 'Free';

  openModal(`
    <div class="p-6">
      <div class="text-center mb-5">
        <div class="w-14 h-14 rounded-2xl ${style.bg} flex items-center justify-center mx-auto mb-3">
          <i class="fas ${featureData?.icon || 'fa-lock-open'} ${style.iconColor} text-2xl"></i>
        </div>
        <h2 class="text-lg font-bold text-gray-800">${esc(trigger.headline)}</h2>
        <p class="text-sm text-gray-500 mt-1">${esc(trigger.body)}</p>
      </div>

      <!-- Benefits list -->
      <div class="bg-gray-50 rounded-xl p-4 mb-5">
        <div class="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">What you unlock on ${planLabel}</div>
        <ul class="space-y-1.5">
          ${(trigger.benefits || []).map(b=>`
            <li class="flex items-center gap-2 text-sm text-gray-700">
              <i class="fas fa-check-circle text-emerald-500 text-xs shrink-0"></i>
              ${esc(b)}
            </li>
          `).join('')}
        </ul>
      </div>

      <!-- Preview text -->
      ${featureData?.previewText ? `
        <div class="${style.bg} border ${style.border} rounded-xl p-3 mb-5 text-xs text-gray-600 italic">
          <i class="fas fa-eye mr-1.5 ${style.iconColor}"></i>"${esc(featureData.previewText)}"
        </div>
      ` : ''}

      <div class="flex gap-3">
        <button onclick="clickTriggerCTA('${trigger.id}'); closeModal()"
          class="flex-1 ${style.ctaBg} text-white font-bold py-3 rounded-xl transition-colors text-sm">
          <i class="fas fa-arrow-circle-up mr-1.5"></i>${esc(trigger.cta)} · ${price}
        </button>
        <button onclick="dismissTrigger('${trigger.id}'); closeModal()"
          class="px-4 py-3 rounded-xl bg-gray-100 text-gray-500 text-sm font-medium hover:bg-gray-200 transition-colors">
          Not now
        </button>
      </div>
      <p class="text-[10px] text-gray-400 text-center mt-3">Cancel anytime. No contracts.</p>
    </div>
  `);
}

// ================================================================
// CONTEXTUAL UPGRADE CTA (inline, appears in relevant sections)
// ================================================================
function upgradeCTA(context = 'default') {
  const t = S.tokens;
  const planName = t?.planName || 'free';
  if (['pro','scale'].includes(planName)) return ''; // No CTA for high-tier users
  if (Conv.sessionUpgradeSeen && context === 'soft') return ''; // Don't repeat soft CTAs

  const ctaConfig = {
    schedules: { icon:'fa-calendar-alt', text:'Automate this with Starter', sub:'Set recurring AI analysis — hands-free', plan:'Starter', price:'$10' },
    agents:    { icon:'fa-robot',       text:'Unlock all 7 agents with Pro',  sub:'Strategy, Ad Optimization + more', plan:'Pro', price:'$30' },
    dashboard: { icon:'fa-arrow-up',    text:'Upgrade for more AI power',    sub:'1.2M tokens/mo on Starter', plan:'Starter', price:'$10' },
    default:   { icon:'fa-arrow-circle-up', text:'Upgrade your plan',        sub:'More tokens, more agents, automation', plan:'Starter', price:'$10' }
  };
  const cfg = ctaConfig[context] || ctaConfig.default;

  return `
    <div class="border border-violet-200 bg-violet-50 rounded-xl p-3 flex items-center gap-3">
      <div class="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center shrink-0">
        <i class="fas ${cfg.icon} text-violet-600 text-sm"></i>
      </div>
      <div class="flex-1 min-w-0">
        <div class="text-xs font-semibold text-violet-800">${cfg.text}</div>
        <div class="text-[10px] text-violet-600">${cfg.sub}</div>
      </div>
      <button onclick="nav('usage')" class="bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap">
        ${cfg.plan} · ${cfg.price}/mo
      </button>
    </div>
  `;
}

// ================================================================
// TRIGGER CHECKER — Run after page loads (non-blocking)
// ================================================================
async function checkUpgradeTriggers() {
  try {
    const r = await api.get('/upgrade/check');
    if (r.success && r.data?.shouldShow && r.data?.trigger) {
      showTriggerBanner(r.data.trigger);
    }
  } catch(_) {} // Never block the UI
}


// ================================================================
// MY USAGE DASHBOARD
// ================================================================
async function renderUsage() {
  let tokenData = S.tokens || {};
  try {
    const r = await api.get('/chat/tokens');
    if(r.success && r.data) { tokenData = r.data; S.tokens = r.data; }
  } catch(_) {}

  const t = tokenData;
  const pct = Math.min(100, Math.round(((t.tokensUsed||0) / (t.tokensGranted||10000)) * 100));
  const dailyPct = Math.min(100, Math.round(((t.dailyUsed||0) / (t.dailyLimit||2000)) * 100));
  const planColors = { free:'gray', starter:'blue', pro:'violet', scale:'emerald' };
  const pc = planColors[t.planName] || 'gray';
  const barColor = pct>=80?'bg-red-500':pct>=60?'bg-amber-500':'bg-emerald-500';
  const dailyBarColor = dailyPct>=80?'bg-red-500':dailyPct>=60?'bg-amber-500':'bg-violet-500';

  const PLAN_FEATURES = {
    free:    { name:'Free', price:0, tokens:'10K/mo', daily:'2K/day', agents:2, schedules:0, chat:true, scheduling:false, advanced:false },
    starter: { name:'Starter', price:10, tokens:'1.2M/mo', daily:'40K/day', agents:5, schedules:5, chat:true, scheduling:true, advanced:false },
    pro:     { name:'Pro', price:30, tokens:'3.6M/mo', daily:'120K/day', agents:7, schedules:20, chat:true, scheduling:true, advanced:true },
    scale:   { name:'Scale', price:100, tokens:'12M/mo', daily:'400K/day', agents:7, schedules:100, chat:true, scheduling:true, advanced:true }
  };
  const plans = Object.entries(PLAN_FEATURES);
  const current = t.planName || 'free';

  document.getElementById('content').innerHTML = `
    <div class="max-w-4xl mx-auto space-y-5">

      <!-- Token Usage Card -->
      <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div class="flex items-center justify-between mb-4">
          <div>
            <h3 class="font-bold text-gray-800 text-base">AI Token Usage</h3>
            <p class="text-xs text-gray-500">Billing period: ${t.periodStart || 'This month'}</p>
          </div>
          <span class="text-xs font-bold px-3 py-1 rounded-full bg-${pc}-100 text-${pc}-700 border border-${pc}-200 uppercase">${t.displayName || (t.planName||'free').toUpperCase()}</span>
        </div>

        <!-- Monthly usage -->
        <div class="mb-4">
          <div class="flex justify-between text-xs font-medium mb-1.5">
            <span class="text-gray-600">Monthly Tokens</span>
            <span class="text-gray-800">${(t.tokensUsed||0).toLocaleString()} / ${(t.tokensGranted||10000).toLocaleString()}</span>
          </div>
          <div class="h-3 bg-gray-100 rounded-full overflow-hidden">
            <div class="${barColor} h-full rounded-full transition-all duration-700" style="width:${pct}%"></div>
          </div>
          <div class="flex justify-between text-xs text-gray-400 mt-1">
            <span>${pct}% used</span>
            <span>${(t.tokensRemaining||0).toLocaleString()} remaining</span>
          </div>
        </div>

        <!-- Daily usage -->
        <div class="mb-4">
          <div class="flex justify-between text-xs font-medium mb-1.5">
            <span class="text-gray-600">Today's Usage</span>
            <span class="text-gray-800">${(t.dailyUsed||0).toLocaleString()} / ${(t.dailyLimit||2000).toLocaleString()}</span>
          </div>
          <div class="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div class="${dailyBarColor} h-full rounded-full transition-all" style="width:${dailyPct}%"></div>
          </div>
          <div class="text-xs text-gray-400 mt-1">Resets midnight UTC · ${t.requestsToday||0} requests today</div>
        </div>

        <!-- Stats row -->
        <div class="grid grid-cols-4 gap-3">
          ${[
            ['Tokens Used', (t.tokensUsed||0).toLocaleString(), 'fa-coins', 'violet'],
            ['Tokens Left', (t.tokensRemaining||0).toLocaleString(), 'fa-battery-three-quarters', 'emerald'],
            ['Daily Left', (t.dailyRemaining||0).toLocaleString(), 'fa-clock', 'amber'],
            ['Requests', (t.requestsToday||0)+' today', 'fa-paper-plane', 'blue']
          ].map(([label,val,icon,color])=>`
            <div class="bg-gray-50 rounded-xl p-3 text-center">
              <i class="fas ${icon} text-${color}-500 text-sm mb-1"></i>
              <div class="font-bold text-gray-800 text-sm">${val}</div>
              <div class="text-xs text-gray-400">${label}</div>
            </div>
          `).join('')}
        </div>

        ${pct>=80 ? `
          <div class="mt-4 bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-3">
            <i class="fas fa-exclamation-triangle text-red-500"></i>
            <div class="flex-1 text-xs text-red-700">
              <strong>⚠️ ${pct>=100?'Token limit reached':'High token usage'}</strong> —
              ${pct>=100 ? 'You\'ve used all your monthly tokens. Upgrade to continue.' : `You've used ${pct}% of your monthly tokens. Consider upgrading.`}
            </div>
            <button onclick="nav('profile')" class="bg-red-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-red-600 transition-colors">Upgrade</button>
          </div>
        ` : ''}
      </div>

      <!-- Features & Plan -->
      <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h3 class="font-bold text-gray-800 mb-4">Plan Features</h3>
        <div class="grid grid-cols-2 gap-3 mb-5">
          ${[
            ['Chat Assistant', t.hasChat, 'fa-comments'],
            ['Analytics', t.hasAnalytics, 'fa-chart-bar'],
            ['Scheduling', t.hasScheduling, 'fa-calendar-alt'],
            ['Advanced Agents', t.hasAdvancedAgents, 'fa-robot']
          ].map(([label,enabled,icon])=>`
            <div class="flex items-center gap-2.5 p-3 rounded-xl ${enabled?'bg-emerald-50 border border-emerald-100':'bg-gray-50 border border-gray-100'}">
              <i class="fas ${icon} ${enabled?'text-emerald-500':'text-gray-300'} text-sm"></i>
              <span class="text-xs font-medium ${enabled?'text-emerald-700':'text-gray-400'}">${label}</span>
              <i class="fas ${enabled?'fa-check-circle text-emerald-500':'fa-lock text-gray-300'} ml-auto text-xs"></i>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Plan Comparison -->
      <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h3 class="font-bold text-gray-800 mb-4">Plans</h3>
        <div class="grid grid-cols-2 gap-3">
          ${plans.map(([key, p])=>`
            <div class="rounded-xl border-2 p-4 relative ${current===key?'border-violet-500 bg-violet-50':'border-gray-100 hover:border-gray-200'}">
              ${current===key ? '<span class="absolute top-3 right-3 text-[10px] bg-violet-500 text-white px-2 py-0.5 rounded-full font-bold">Current</span>' : ''}
              <div class="font-bold text-gray-800 mb-0.5">${p.name}</div>
              <div class="text-lg font-extrabold text-gray-900 mb-3">${p.price===0?'Free':'$'+p.price}<span class="text-xs font-normal text-gray-400">/mo</span></div>
              <ul class="space-y-1.5 text-xs text-gray-600">
                <li><i class="fas fa-coins text-violet-400 w-4"></i> ${p.tokens} tokens</li>
                <li><i class="fas fa-clock text-amber-400 w-4"></i> ${p.daily}</li>
                <li><i class="fas fa-robot text-blue-400 w-4"></i> ${p.agents} agents</li>
                <li><i class="fas fa-calendar text-emerald-400 w-4"></i> ${p.schedules===0?'No':'Up to '+p.schedules} schedules</li>
                <li><i class="fas ${p.scheduling?'fa-check text-emerald-400':'fa-times text-gray-300'} w-4"></i> Scheduling</li>
                <li><i class="fas ${p.advanced?'fa-check text-emerald-400':'fa-times text-gray-300'} w-4"></i> Advanced agents</li>
              </ul>
              ${current!==key ? `
                <button onclick="toast('Contact support to upgrade to ${p.name}','info')" class="mt-3 w-full text-xs font-semibold py-1.5 rounded-lg ${p.price>0?'bg-violet-600 text-white hover:bg-violet-700':'bg-gray-100 text-gray-500'} transition-colors">
                  ${p.price===0?'Downgrade':'Upgrade to '+p.name}
                </button>
              ` : ''}
            </div>
          `).join('')}
        </div>
        <p class="text-xs text-gray-400 mt-4 text-center">To change plans, contact support or configure via Stripe billing.</p>
      </div>

      <!-- Cost Transparency -->
      <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h3 class="font-bold text-gray-800 mb-3">How Tokens Work</h3>
        <div class="grid grid-cols-2 gap-3 text-xs">
          ${[
            ['Intent Generation','2,000 tokens','fa-brain','violet'],
            ['Chat Message','500 tokens','fa-comments','blue'],
            ['Analysis','1,500 tokens','fa-chart-line','amber'],
            ['Schedule Run','2,000 tokens','fa-calendar','emerald']
          ].map(([action,cost,icon,color])=>`
            <div class="flex items-center gap-2.5 bg-gray-50 rounded-xl p-3">
              <i class="fas ${icon} text-${color}-500"></i>
              <div>
                <div class="font-semibold text-gray-700">${action}</div>
                <div class="text-gray-400">${cost} per request</div>
              </div>
            </div>
          `).join('')}
        </div>
        <div class="mt-3 bg-violet-50 rounded-xl p-3 text-xs text-violet-700">
          <i class="fas fa-info-circle mr-1.5"></i>
          <strong>Platform-managed AI:</strong> IntentIQ handles all AI infrastructure. You never need to provide API keys. Costs are pooled and allocated per your subscription tier.
        </div>
      </div>
    </div>
  `;
}

// ================================================================
// ADMIN PANEL — Profit Dashboard + Abuse Monitoring
// ================================================================
async function renderAdmin() {
  let profitData = null, statsData = null, abuseData = [];
  try {
    const [pRes, sRes, aRes] = await Promise.all([
      api.get('/admin/profit'),
      api.get('/admin/stats'),
      api.get('/admin/abuse')
    ]);
    if(pRes.success) profitData = pRes.data;
    if(sRes.success) statsData = sRes.data;
    if(aRes.success) abuseData = aRes.data || [];
  } catch(e) {
    document.getElementById('content').innerHTML = `<div class="p-8 text-center"><i class="fas fa-lock text-4xl text-gray-300 mb-3"></i><p class="text-gray-500">Admin access required. Set ADMIN_SECRET to enable.</p></div>`;
    return;
  }

  const s = profitData?.summary || {};
  const stats = statsData || {};
  const profitMargin = s.profitMargin || 0;
  const marginColor = profitMargin>=70?'text-emerald-600':profitMargin>=40?'text-amber-600':'text-red-600';
  const marginBg = profitMargin>=70?'bg-emerald-50 border-emerald-200':profitMargin>=40?'bg-amber-50 border-amber-200':'bg-red-50 border-red-200';

  document.getElementById('content').innerHTML = `
    <div class="max-w-5xl mx-auto space-y-5">

      <!-- Profit Summary Cards -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        ${[
          ['Total Revenue', '$'+(s.totalRevenue||0).toFixed(2), 'fa-dollar-sign', 'emerald', 'This billing period'],
          ['Total AI Cost', '$'+(s.totalCost||0).toFixed(4), 'fa-microchip', 'red', 'Actual AI spend'],
          ['Gross Profit', '$'+(s.totalProfit||0).toFixed(2), 'fa-chart-line', 'violet', 'Revenue − cost'],
          ['Profit Margin', (s.profitMargin||0)+'%', 'fa-percent', profitMargin>=70?'emerald':profitMargin>=40?'amber':'red', 'Platform health']
        ].map(([label,val,icon,color,sub])=>`
          <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 stat-card">
            <div class="flex items-center gap-2 mb-2">
              <div class="w-8 h-8 rounded-xl bg-${color}-100 flex items-center justify-center">
                <i class="fas ${icon} text-${color}-600 text-sm"></i>
              </div>
              <span class="text-xs text-gray-500 font-medium">${label}</span>
            </div>
            <div class="text-2xl font-extrabold text-gray-800">${val}</div>
            <div class="text-xs text-gray-400 mt-0.5">${sub}</div>
          </div>
        `).join('')}
      </div>

      <!-- Platform Stats Row -->
      <div class="grid grid-cols-3 gap-4">
        <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <div class="text-xs text-gray-500 font-medium mb-2"><i class="fas fa-users text-blue-400 mr-1"></i>Users</div>
          <div class="text-2xl font-bold text-gray-800">${stats.users?.total||0}</div>
          <div class="text-xs text-gray-400">+${stats.users?.new7d||0} last 7 days</div>
        </div>
        <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <div class="text-xs text-gray-500 font-medium mb-2"><i class="fas fa-coins text-violet-400 mr-1"></i>Tokens Used (Period)</div>
          <div class="text-2xl font-bold text-gray-800">${((stats.tokens?.totalUsed||0)/1000).toFixed(1)}K</div>
          <div class="text-xs text-gray-400">${stats.tokens?.totalRequests||0} requests</div>
        </div>
        <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <div class="text-xs text-gray-500 font-medium mb-2"><i class="fas fa-database text-emerald-400 mr-1"></i>Cache Performance</div>
          <div class="text-2xl font-bold text-gray-800">${stats.cache?.total_hits||0}</div>
          <div class="text-xs text-gray-400">${stats.cache?.active_entries||0} active entries</div>
        </div>
      </div>

      <!-- Subscriptions Breakdown -->
      ${(stats.subscriptions||[]).length > 0 ? `
      <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h3 class="font-bold text-gray-800 mb-4"><i class="fas fa-credit-card text-violet-500 mr-2"></i>Active Subscriptions</h3>
        <div class="grid grid-cols-4 gap-3">
          ${(stats.subscriptions||[]).map(sub=>`
            <div class="bg-gray-50 rounded-xl p-3 text-center">
              <div class="text-2xl font-bold text-gray-800">${sub.count||0}</div>
              <div class="text-xs font-semibold text-gray-600 capitalize">${sub.name}</div>
              <div class="text-xs text-emerald-600 font-bold">$${(sub.mrr||0).toFixed(0)} MRR</div>
            </div>
          `).join('')}
        </div>
      </div>
      ` : ''}

      <!-- Per-User Profitability -->
      ${(profitData?.perUser||[]).length > 0 ? `
      <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h3 class="font-bold text-gray-800 mb-4"><i class="fas fa-users text-blue-500 mr-2"></i>User Profitability</h3>
        <div class="overflow-x-auto">
          <table class="w-full text-xs">
            <thead>
              <tr class="text-gray-400 border-b border-gray-100">
                <th class="text-left pb-2">User</th>
                <th class="text-center pb-2">Plan</th>
                <th class="text-right pb-2">Revenue</th>
                <th class="text-right pb-2">AI Cost</th>
                <th class="text-right pb-2">Profit</th>
                <th class="text-center pb-2">Status</th>
              </tr>
            </thead>
            <tbody>
              ${(profitData.perUser||[]).map(u=>`
                <tr class="border-b border-gray-50 hover:bg-gray-50">
                  <td class="py-2 font-medium text-gray-700">${esc(u.email||'')}</td>
                  <td class="py-2 text-center capitalize">${u.plan_name||'free'}</td>
                  <td class="py-2 text-right text-emerald-600">$${(u.price_monthly||0).toFixed(2)}</td>
                  <td class="py-2 text-right text-red-500">$${(u.cost_usd||0).toFixed(4)}</td>
                  <td class="py-2 text-right font-bold ${u.is_profitable?'text-emerald-600':'text-red-600'}">$${(u.profit||0).toFixed(4)}</td>
                  <td class="py-2 text-center">
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${u.is_profitable?'bg-emerald-100 text-emerald-700':'bg-red-100 text-red-700'}">
                      ${u.is_profitable?'Profitable':'Loss'}
                    </span>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
      ` : `
      <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h3 class="font-bold text-gray-800 mb-3">User Profitability</h3>
        <div class="bg-gray-50 rounded-xl p-8 text-center text-gray-400">
          <i class="fas fa-chart-bar text-3xl mb-3 block text-gray-200"></i>
          No revenue data yet. Data populates when users have active paid subscriptions.
        </div>
      </div>
      `}

      <!-- High-Cost Alerts -->
      ${(profitData?.highCostAlerts||[]).length > 0 ? `
      <div class="bg-red-50 border border-red-200 rounded-2xl p-5">
        <h3 class="font-bold text-red-800 mb-4"><i class="fas fa-exclamation-triangle text-red-500 mr-2"></i>High-Cost User Alerts</h3>
        ${(profitData.highCostAlerts||[]).map(u=>`
          <div class="flex items-center justify-between bg-white rounded-xl p-3 mb-2 border border-red-100">
            <div>
              <div class="font-medium text-gray-800 text-sm">${esc(u.email||'')}</div>
              <div class="text-xs text-gray-500">${u.plan_name} · ${(u.tokens_used||0).toLocaleString()} tokens</div>
            </div>
            <div class="text-right">
              <div class="text-red-600 font-bold text-sm">Loss: $${(u.loss||0).toFixed(4)}</div>
              <div class="text-xs text-gray-400">Cost: $${(u.cost_usd||0).toFixed(4)}</div>
            </div>
          </div>
        `).join('')}
      </div>
      ` : ''}

      <!-- Abuse Flags -->
      <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div class="flex items-center justify-between mb-4">
          <h3 class="font-bold text-gray-800"><i class="fas fa-shield-alt text-amber-500 mr-2"></i>Abuse Monitoring</h3>
          <span class="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full font-bold">${abuseData.length} Active Flags</span>
        </div>
        ${abuseData.length===0 ? `
          <div class="bg-emerald-50 rounded-xl p-6 text-center text-emerald-600">
            <i class="fas fa-check-shield text-2xl mb-2 block"></i>
            <div class="font-semibold">No active abuse flags</div>
            <div class="text-xs text-emerald-500 mt-1">System is clean</div>
          </div>
        ` : `
          <div class="space-y-2">
            ${abuseData.slice(0,10).map(f=>`
              <div class="flex items-center gap-3 p-3 rounded-xl border ${f.severity==='banned'?'bg-red-50 border-red-200':f.severity==='throttled'?'bg-amber-50 border-amber-200':'bg-gray-50 border-gray-100'}">
                <i class="fas fa-flag ${f.severity==='banned'?'text-red-500':f.severity==='throttled'?'text-amber-500':'text-gray-400'} text-xs"></i>
                <div class="flex-1 min-w-0">
                  <div class="text-xs font-medium text-gray-700">${esc(f.email||f.user_id||'')}</div>
                  <div class="text-xs text-gray-500 truncate">${esc(f.flag_type||'')} · ${esc(f.details||'')}</div>
                </div>
                <div class="flex gap-1">
                  <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${f.severity==='banned'?'bg-red-100 text-red-700':f.severity==='throttled'?'bg-amber-100 text-amber-700':'bg-gray-100 text-gray-600'}">${f.severity}</span>
                  <button onclick="resolveFlag('${f.id}')" class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition-colors">Resolve</button>
                </div>
              </div>
            `).join('')}
          </div>
        `}
      </div>

      <!-- Feature Cost Breakdown -->
      ${(profitData?.featureBreakdown||[]).length > 0 ? `
      <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h3 class="font-bold text-gray-800 mb-4"><i class="fas fa-microchip text-violet-500 mr-2"></i>AI Cost by Feature</h3>
        <div class="space-y-2">
          ${(profitData.featureBreakdown||[]).map(f=>`
            <div class="flex items-center gap-3 p-2.5 bg-gray-50 rounded-xl">
              <div class="flex-1">
                <div class="text-xs font-medium text-gray-700 capitalize">${(f.request_type||'').replace(/_/g,' ')} <span class="text-gray-400">· ${f.model_used}</span></div>
              </div>
              <div class="text-xs text-gray-500">${(f.requests||0).toLocaleString()} reqs</div>
              <div class="text-xs text-violet-600 font-medium">${((f.tokens||0)/1000).toFixed(1)}K tokens</div>
              <div class="text-xs font-bold text-red-600">$${(f.cost||0).toFixed(6)}</div>
            </div>
          `).join('')}
        </div>
      </div>
      ` : ''}

      <!-- Cache Actions -->
      <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h3 class="font-bold text-gray-800 mb-3"><i class="fas fa-database text-emerald-500 mr-2"></i>Cache Management</h3>
        <div class="flex gap-3">
          <button onclick="clearExpiredCache()" class="bg-gray-100 text-gray-700 text-xs font-semibold px-4 py-2 rounded-xl hover:bg-gray-200 transition-colors">
            <i class="fas fa-broom mr-1.5"></i>Clear Expired Cache
          </button>
          <button onclick="renderAdmin()" class="bg-violet-100 text-violet-700 text-xs font-semibold px-4 py-2 rounded-xl hover:bg-violet-200 transition-colors">
            <i class="fas fa-sync-alt mr-1.5"></i>Refresh Data
          </button>
        </div>
      </div>

    </div>
  `;
}

async function resolveFlag(id) {
  try {
    const r = await api.post('/admin/abuse/'+id+'/resolve', {});
    if(r.success) { toast('Flag resolved','success'); renderAdmin(); }
    else toast('Error resolving flag','error');
  } catch(_) { toast('Error','error'); }
}
window.resolveFlag = resolveFlag;

async function clearExpiredCache() {
  try {
    const r = await fetch('/api/admin/cache', {method:'DELETE'});
    const d = await r.json();
    if(d.success) toast(d.message,'success');
    else toast('Cache clear failed','error');
  } catch(_) { toast('Error','error'); }
}
window.clearExpiredCache = clearExpiredCache;

// Start
init();
