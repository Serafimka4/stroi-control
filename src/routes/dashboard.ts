import { Hono } from 'hono'

type Bindings = { DB: D1Database }

export const dashboard = new Hono<{ Bindings: Bindings }>()

dashboard.get('/login', (c) => {
  return c.html(LOGIN_PAGE)
})

dashboard.get('/', (c) => {
  return c.html(MAIN_PAGE)
})

// ===============================================================
// LOGIN PAGE
// ===============================================================
const LOGIN_PAGE = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>СтройКонтроль | Вход</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    body { font-family: 'Inter', sans-serif; background: #0f172a; }
  </style>
</head>
<body class="min-h-screen flex items-center justify-center text-slate-200">
  <div class="w-full max-w-sm px-6">
    <div class="text-center mb-8">
      <div class="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center mx-auto mb-4">
        <i class="fas fa-hard-hat text-white text-xl"></i>
      </div>
      <h1 class="text-2xl font-bold text-white">СтройКонтроль</h1>
      <p class="text-slate-400 text-sm mt-1">Панель управления</p>
    </div>
    <form id="loginForm" class="space-y-4">
      <div>
        <label class="block text-xs font-medium text-slate-400 mb-1.5">Логин</label>
        <input type="text" id="login" required autofocus
          class="w-full px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-sm"
          placeholder="admin">
      </div>
      <div>
        <label class="block text-xs font-medium text-slate-400 mb-1.5">Пароль</label>
        <input type="password" id="password" required
          class="w-full px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-sm"
          placeholder="123456">
      </div>
      <div id="loginError" class="hidden text-sm text-red-400 bg-red-900/20 rounded-lg px-3 py-2"></div>
      <button type="submit"
        class="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition">
        Войти
      </button>
    </form>
    <div class="mt-6 text-center text-xs text-slate-600">
      Тестовые аккаунты:<br>
      <span class="text-slate-500">admin / kozlov / petrova / sidorov</span><br>
      <span class="text-slate-500">Пароль: 123456</span>
    </div>
  </div>
  <script>
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const err = document.getElementById('loginError');
      err.classList.add('hidden');
      try {
        const resp = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            login: document.getElementById('login').value,
            password: document.getElementById('password').value
          })
        });
        const data = await resp.json();
        if (data.ok) {
          localStorage.setItem('sk_token', data.token);
          localStorage.setItem('sk_user', JSON.stringify(data.user));
          window.location.href = '/';
        } else {
          err.textContent = data.error || 'Ошибка входа';
          err.classList.remove('hidden');
        }
      } catch(e) {
        err.textContent = 'Ошибка сети';
        err.classList.remove('hidden');
      }
    });
  </script>
</body>
</html>`

// ===============================================================
// MAIN DASHBOARD PAGE
// ===============================================================
const MAIN_PAGE = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>СтройКонтроль | Панель руководителя</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
  <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
    body { font-family: 'Inter', sans-serif; background: #0f172a; }
    .kpi-card { background: linear-gradient(135deg, rgba(30,41,59,0.9), rgba(15,23,42,0.95)); border: 1px solid rgba(148,163,184,0.1); backdrop-filter: blur(10px); transition: all 0.3s ease; }
    .kpi-card:hover { border-color: rgba(59,130,246,0.4); transform: translateY(-2px); box-shadow: 0 8px 25px rgba(0,0,0,0.3); }
    .kpi-value { font-variant-numeric: tabular-nums; }
    .detail-panel { background: linear-gradient(135deg, rgba(30,41,59,0.95), rgba(15,23,42,0.98)); border: 1px solid rgba(148,163,184,0.1); }
    .badge { padding: 2px 8px; border-radius: 9999px; font-size: 0.7rem; font-weight: 600; display: inline-block; }
    .badge-red { background: rgba(239,68,68,0.15); color: #f87171; }
    .badge-orange { background: rgba(249,115,22,0.15); color: #fb923c; }
    .badge-yellow { background: rgba(234,179,8,0.15); color: #facc15; }
    .badge-green { background: rgba(34,197,94,0.15); color: #4ade80; }
    .badge-blue { background: rgba(59,130,246,0.15); color: #60a5fa; }
    .badge-gray { background: rgba(148,163,184,0.15); color: #94a3b8; }
    .tab-btn { transition: all 0.2s ease; }
    .tab-btn.active { background: rgba(59,130,246,0.2); color: #60a5fa; border-color: rgba(59,130,246,0.5); }
    .glow-red { box-shadow: 0 0 15px rgba(239,68,68,0.2); border-color: rgba(239,68,68,0.4) !important; }
    .glow-green { box-shadow: 0 0 15px rgba(34,197,94,0.15); border-color: rgba(34,197,94,0.3) !important; }
    .table-row:hover { background: rgba(59,130,246,0.05); }
    .modal-overlay { background: rgba(0,0,0,0.6); backdrop-filter: blur(4px); }
    .modal-box { background: #1e293b; border: 1px solid rgba(148,163,184,0.15); }
    .input-field { width: 100%; padding: 8px 12px; border-radius: 10px; background: #0f172a; border: 1px solid rgba(148,163,184,0.2); color: #e2e8f0; font-size: 0.875rem; outline: none; }
    .input-field:focus { border-color: #3b82f6; box-shadow: 0 0 0 2px rgba(59,130,246,0.2); }
    select.input-field { appearance: none; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='%2394a3b8' viewBox='0 0 16 16'%3E%3Cpath d='M8 11L3 6h10l-5 5z'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 12px center; padding-right: 32px; }
    .btn { padding: 6px 16px; border-radius: 10px; font-size: 0.8rem; font-weight: 600; transition: all 0.2s; cursor: pointer; }
    .btn-primary { background: #3b82f6; color: white; }
    .btn-primary:hover { background: #2563eb; }
    .btn-danger { background: rgba(239,68,68,0.15); color: #f87171; }
    .btn-danger:hover { background: rgba(239,68,68,0.25); }
    .btn-ghost { background: rgba(148,163,184,0.1); color: #94a3b8; }
    .btn-ghost:hover { background: rgba(148,163,184,0.2); }
    .btn-sm { padding: 3px 10px; font-size: 0.7rem; border-radius: 8px; }
    .action-btn { cursor: pointer; padding: 2px 6px; border-radius: 6px; transition: all 0.15s; }
    .action-btn:hover { background: rgba(59,130,246,0.15); }
    ::-webkit-scrollbar { width: 6px; }
    ::-webkit-scrollbar-track { background: rgba(15,23,42,0.5); }
    ::-webkit-scrollbar-thumb { background: rgba(148,163,184,0.3); border-radius: 3px; }
    .role-admin { color: #f87171; }
    .role-engineer { color: #60a5fa; }
    .role-lab { color: #a78bfa; }
  </style>
</head>
<body class="text-slate-200 min-h-screen">

  <!-- Header -->
  <header class="border-b border-slate-700/50 bg-slate-900/80 backdrop-blur-sm sticky top-0 z-50">
    <div class="max-w-[1600px] mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div class="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center">
          <i class="fas fa-hard-hat text-white text-sm"></i>
        </div>
        <div>
          <h1 class="text-lg font-bold text-white leading-tight">СтройКонтроль</h1>
          <p class="text-[10px] text-slate-400 uppercase tracking-widest">Панель руководителя</p>
        </div>
      </div>
      <div class="flex items-center gap-3">
        <div id="lastUpdate" class="text-xs text-slate-500 hidden sm:block"></div>
        <button onclick="loadData()" class="btn btn-ghost btn-sm"><i class="fas fa-sync-alt mr-1"></i> Обновить</button>
        <div class="flex items-center gap-2 pl-3 border-l border-slate-700/50">
          <span id="userName" class="text-xs font-medium"></span>
          <span id="userRole" class="badge text-[10px]"></span>
          <button onclick="logout()" class="action-btn text-slate-500 hover:text-red-400" title="Выйти"><i class="fas fa-sign-out-alt"></i></button>
        </div>
      </div>
    </div>
  </header>

  <main class="max-w-[1600px] mx-auto px-4 sm:px-6 py-6">
    <!-- Alert bar -->
    <div id="alertBar" class="hidden mb-6 p-3 rounded-xl bg-red-900/20 border border-red-800/30 flex items-center gap-3">
      <div class="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
        <i class="fas fa-exclamation-triangle text-red-400 text-sm"></i>
      </div>
      <span id="alertText" class="text-sm text-red-300"></span>
    </div>

    <!-- KPI Cards Grid -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6" id="kpiGrid"></div>

    <!-- Charts Row -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
      <div class="kpi-card rounded-2xl p-5">
        <h3 class="text-sm font-semibold text-slate-400 mb-4"><i class="fas fa-chart-pie mr-2 text-blue-400"></i>Замечания по статусам</h3>
        <div class="h-48"><canvas id="defectsChart"></canvas></div>
      </div>
      <div class="kpi-card rounded-2xl p-5">
        <h3 class="text-sm font-semibold text-slate-400 mb-4"><i class="fas fa-chart-bar mr-2 text-emerald-400"></i>Загрузка инженеров</h3>
        <div class="h-48"><canvas id="engineersChart"></canvas></div>
      </div>
      <div class="kpi-card rounded-2xl p-5">
        <h3 class="text-sm font-semibold text-slate-400 mb-4"><i class="fas fa-funnel-dollar mr-2 text-amber-400"></i>Воронка заявок</h3>
        <div class="h-48"><canvas id="leadsChart"></canvas></div>
      </div>
    </div>

    <!-- Detail Tabs -->
    <div class="detail-panel rounded-2xl overflow-hidden">
      <div class="flex items-center gap-1 p-2 border-b border-slate-700/30 overflow-x-auto">
        <button onclick="showTab('objects')" class="tab-btn active px-4 py-2 rounded-lg text-xs font-medium border border-transparent whitespace-nowrap" data-tab="objects"><i class="fas fa-building mr-1"></i> Объекты</button>
        <button onclick="showTab('defects')" class="tab-btn px-4 py-2 rounded-lg text-xs font-medium border border-transparent text-slate-400 whitespace-nowrap" data-tab="defects"><i class="fas fa-exclamation-circle mr-1"></i> Замечания</button>
        <button onclick="showTab('tests')" class="tab-btn px-4 py-2 rounded-lg text-xs font-medium border border-transparent text-slate-400 whitespace-nowrap" data-tab="tests"><i class="fas fa-flask mr-1"></i> Испытания</button>
        <button onclick="showTab('protocols')" class="tab-btn px-4 py-2 rounded-lg text-xs font-medium border border-transparent text-slate-400 whitespace-nowrap" data-tab="protocols"><i class="fas fa-file-alt mr-1"></i> Протоколы</button>
        <button onclick="showTab('repeats')" class="tab-btn px-4 py-2 rounded-lg text-xs font-medium border border-transparent text-slate-400 whitespace-nowrap" data-tab="repeats"><i class="fas fa-redo mr-1"></i> Повторные</button>
        <button onclick="showTab('leads')" class="tab-btn px-4 py-2 rounded-lg text-xs font-medium border border-transparent text-slate-400 whitespace-nowrap" data-tab="leads"><i class="fas fa-handshake mr-1"></i> Заявки</button>
        <div class="flex-1"></div>
        <button id="addBtn" onclick="openCreateModal()" class="btn btn-primary btn-sm"><i class="fas fa-plus mr-1"></i> Добавить</button>
      </div>
      <div id="tabContent" class="p-4 max-h-[500px] overflow-auto"></div>
    </div>
  </main>

  <!-- MODAL -->
  <div id="modal" class="fixed inset-0 z-[100] hidden">
    <div class="modal-overlay absolute inset-0" onclick="closeModal()"></div>
    <div class="absolute inset-0 flex items-center justify-center p-4 pointer-events-none">
      <div class="modal-box rounded-2xl w-full max-w-lg max-h-[85vh] overflow-auto pointer-events-auto">
        <div class="flex items-center justify-between p-5 border-b border-slate-700/30">
          <h3 id="modalTitle" class="text-lg font-bold text-white"></h3>
          <button onclick="closeModal()" class="text-slate-500 hover:text-white transition"><i class="fas fa-times"></i></button>
        </div>
        <div id="modalBody" class="p-5"></div>
        <div id="modalFooter" class="flex items-center justify-end gap-2 p-5 border-t border-slate-700/30">
          <button onclick="closeModal()" class="btn btn-ghost">Отмена</button>
          <button id="modalSubmit" onclick="submitModal()" class="btn btn-primary">Сохранить</button>
        </div>
      </div>
    </div>
  </div>

  <!-- TOAST -->
  <div id="toast" class="fixed bottom-6 right-6 z-[200] hidden">
    <div class="rounded-xl px-4 py-3 text-sm font-medium shadow-lg" id="toastInner"></div>
  </div>

<script>
// ====== STATE ======
let kpiData = null;
let charts = {};
let currentTab = 'objects';
let currentUser = null;
let refs = { engineers: [], contractors: [], objects: [] };
let modalContext = {};

// ====== AUTH ======
async function checkAuth() {
  const token = localStorage.getItem('sk_token');
  if (!token) { window.location.href = '/login'; return; }
  try {
    const resp = await fetch('/api/auth/me', { headers: { 'Authorization': 'Bearer ' + token } });
    if (!resp.ok) throw new Error();
    const data = await resp.json();
    currentUser = data.user;
    renderUserInfo();
  } catch(e) {
    localStorage.removeItem('sk_token');
    localStorage.removeItem('sk_user');
    window.location.href = '/login';
  }
}

function renderUserInfo() {
  if (!currentUser) return;
  document.getElementById('userName').textContent = currentUser.name;
  const roleMap = { admin: ['Админ', 'badge-red'], engineer: ['Инженер', 'badge-blue'], lab: ['Лаборант', 'badge-blue'] };
  const [rl, rc] = roleMap[currentUser.role] || ['—', 'badge-gray'];
  const el = document.getElementById('userRole');
  el.textContent = rl;
  el.className = 'badge text-[10px] ' + rc;
}

async function logout() {
  await fetch('/api/auth/logout', { method: 'POST', headers: authHeaders() });
  localStorage.removeItem('sk_token');
  localStorage.removeItem('sk_user');
  window.location.href = '/login';
}

function authHeaders() {
  return { 'Authorization': 'Bearer ' + localStorage.getItem('sk_token'), 'Content-Type': 'application/json' };
}

function canEdit() { return currentUser && ['admin','engineer'].includes(currentUser.role); }
function isAdmin() { return currentUser && currentUser.role === 'admin'; }
function canEditTab(tab) {
  if (isAdmin()) return true;
  if (currentUser.role === 'engineer' && ['objects','defects','tests','protocols'].includes(tab)) return true;
  if (currentUser.role === 'lab' && ['tests','protocols'].includes(tab)) return true;
  return false;
}

// ====== UTILS ======
const fmt = (n) => n != null ? Number(n).toLocaleString('ru-RU') : '0';
const fmtMoney = (n) => { if(!n) return '0'; if(n>=1e6) return (n/1e6).toFixed(1).replace('.0','') + ' млн'; if(n>=1e3) return (n/1e3).toFixed(0) + ' тыс'; return fmt(n); };

function statusBadge(status) {
  const map = { 'open':['Открыто','badge-red'],'in_progress':['В работе','badge-yellow'],'closed':['Закрыто','badge-green'],'reopened':['Повторно','badge-orange'],'queued':['В очереди','badge-blue'],'completed':['Завершено','badge-green'],'failed':['Брак','badge-red'],'overdue':['Просрочен','badge-red'],'draft':['Черновик','badge-gray'],'review':['На проверке','badge-blue'],'issued':['Выдан','badge-green'],'active':['Активный','badge-green'],'paused':['Приостановлен','badge-yellow'],'new':['Новая','badge-blue'],'proposal_sent':['КП отправлено','badge-yellow'],'won':['Выиграна','badge-green'],'lost':['Проиграна','badge-red'] };
  const [label, cls] = map[status] || [status, 'badge-gray'];
  return '<span class="badge '+cls+'">'+label+'</span>';
}

function categoryBadge(cat) {
  const map = { 'критическое':'badge-red','значительное':'badge-orange','незначительное':'badge-yellow' };
  return '<span class="badge '+(map[cat]||'badge-gray')+'">'+cat+'</span>';
}

function toast(msg, type) {
  const t = document.getElementById('toast');
  const inner = document.getElementById('toastInner');
  inner.className = 'rounded-xl px-4 py-3 text-sm font-medium shadow-lg ' + (type === 'error' ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white');
  inner.textContent = msg;
  t.classList.remove('hidden');
  setTimeout(() => t.classList.add('hidden'), 3000);
}

async function apiCall(method, url, body) {
  try {
    const opts = { method, headers: authHeaders() };
    if (body) opts.body = JSON.stringify(body);
    const resp = await fetch(url, opts);
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || 'Ошибка');
    return data;
  } catch(e) {
    toast(e.message, 'error');
    throw e;
  }
}

// ====== LOAD REFS ======
async function loadRefs() {
  try {
    const [e, c, o] = await Promise.all([
      fetch('/api/crud/ref/engineers', { headers: authHeaders() }).then(r => r.json()),
      fetch('/api/crud/ref/contractors', { headers: authHeaders() }).then(r => r.json()),
      fetch('/api/crud/ref/objects-list', { headers: authHeaders() }).then(r => r.json()),
    ]);
    refs = { engineers: e, contractors: c, objects: o };
  } catch(e) { console.error('Failed to load refs', e); }
}

function selectOptions(list, valueField, labelField, selected) {
  return '<option value="">—</option>' + list.map(i =>
    '<option value="'+i[valueField]+'" '+(String(i[valueField])===String(selected)?'selected':'')+'>'+i[labelField]+'</option>'
  ).join('');
}

// ====== KPI CARDS ======
function renderKPI(kpi) {
  const cards = [
    { icon:'fa-building', color:'blue', title:'Объекты в работе', value:kpi.objects.active, sub:'из '+kpi.objects.total+' всего, '+kpi.objects.paused+' приостановлено', glow:'' },
    { icon:'fa-exclamation-circle', color:'red', title:'Замечания открыто', value:kpi.defects.open, sub:fmt(kpi.defects.closed)+' закрыто, '+fmt(kpi.defects.total)+' всего', glow:kpi.defects.critical_overdue > 0 ? 'glow-red' : '' },
    { icon:'fa-clock', color:'amber', title:'Ср. срок закрытия', value:kpi.defects.avg_close_days+' дн', sub:kpi.defects.critical_overdue+' критич. просрочено', glow:kpi.defects.avg_close_days > 14 ? 'glow-red' : '' },
    { icon:'fa-flask', color:'cyan', title:'Испытания в очереди', value:kpi.tests.queued, sub:kpi.tests.in_progress+' в процессе, '+kpi.tests.completed+' завершено', glow:kpi.tests.queued > 10 ? 'glow-red' : '' },
    { icon:'fa-file-alt', color:'rose', title:'Протоколы просрочены', value:kpi.protocols.overdue, sub:kpi.protocols.review+' на проверке, '+kpi.protocols.draft+' черновиков', glow:kpi.protocols.overdue > 3 ? 'glow-red' : '' },
    { icon:'fa-users', color:'violet', title:'Загрузка инженеров', value:kpi.engineers.avg_load_percent+'%', sub:kpi.engineers.details.length+' инженеров активно', glow:kpi.engineers.avg_load_percent > 85 ? 'glow-red' : (kpi.engineers.avg_load_percent > 70 ? '' : 'glow-green') },
    { icon:'fa-redo', color:'orange', title:'Повторные несоотв.', value:kpi.repeats.total, sub:kpi.repeats.by_contractor.length+' подрядчиков с повторами', glow:kpi.repeats.total > 5 ? 'glow-red' : '' },
    { icon:'fa-handshake', color:'emerald', title:'Конверсия заявок', value:kpi.leads.conversion_rate+'%', sub:kpi.leads.won+' из '+kpi.leads.total+', '+fmtMoney(kpi.leads.won_value)+' \\u20BD', glow:kpi.leads.conversion_rate >= 30 ? 'glow-green' : '' },
  ];
  const colorMap = { blue:'text-blue-400', red:'text-red-400', amber:'text-amber-400', cyan:'text-cyan-400', rose:'text-rose-400', violet:'text-violet-400', orange:'text-orange-400', emerald:'text-emerald-400' };
  const bgMap = { blue:'bg-blue-500/10', red:'bg-red-500/10', amber:'bg-amber-500/10', cyan:'bg-cyan-500/10', rose:'bg-rose-500/10', violet:'bg-violet-500/10', orange:'bg-orange-500/10', emerald:'bg-emerald-500/10' };
  document.getElementById('kpiGrid').innerHTML = cards.map(c =>
    '<div class="kpi-card rounded-2xl p-4 sm:p-5 '+c.glow+'">' +
      '<div class="flex items-center gap-3 mb-3"><div class="w-9 h-9 rounded-xl '+bgMap[c.color]+' flex items-center justify-center"><i class="fas '+c.icon+' '+colorMap[c.color]+' text-sm"></i></div><span class="text-xs font-medium text-slate-400">'+c.title+'</span></div>' +
      '<div class="kpi-value text-2xl sm:text-3xl font-bold text-white mb-1">'+c.value+'</div>' +
      '<div class="text-xs text-slate-500">'+c.sub+'</div></div>'
  ).join('');

  const alerts = [];
  if (kpi.defects.critical_overdue > 0) alerts.push(kpi.defects.critical_overdue + ' критических замечаний просрочено!');
  if (kpi.protocols.overdue > 3) alerts.push(kpi.protocols.overdue + ' протоколов просрочено');
  const bar = document.getElementById('alertBar');
  if (alerts.length > 0) { bar.classList.remove('hidden'); document.getElementById('alertText').textContent = alerts.join(' | '); }
  else { bar.classList.add('hidden'); }
}

// ====== CHARTS ======
function renderCharts(kpi) {
  Object.values(charts).forEach(c => c.destroy());
  charts = {};
  Chart.defaults.color = '#94a3b8';
  Chart.defaults.font.family = 'Inter';

  charts.defects = new Chart(document.getElementById('defectsChart').getContext('2d'), {
    type: 'doughnut',
    data: { labels: ['Открыто','В работе','Повторно','Закрыто'], datasets: [{ data: [kpi.defects.open - kpi.repeats.total, 3, kpi.repeats.total, kpi.defects.closed], backgroundColor: ['#f87171','#facc15','#fb923c','#4ade80'], borderWidth: 0, hoverOffset: 8 }] },
    options: { responsive: true, maintainAspectRatio: false, cutout: '65%', plugins: { legend: { position: 'bottom', labels: { padding: 12, usePointStyle: true, pointStyle: 'circle', font: { size: 11 } } } } }
  });

  const engData = kpi.engineers.details;
  charts.engineers = new Chart(document.getElementById('engineersChart').getContext('2d'), {
    type: 'bar',
    data: { labels: engData.map(e => e.name.split(' ')[0]), datasets: [{ label:'%', data: engData.map(e => e.load_percent), backgroundColor: engData.map(e => e.load_percent > 85 ? '#f87171' : e.load_percent > 60 ? '#facc15' : '#4ade80'), borderRadius: 6, barThickness: 28 }] },
    options: { responsive: true, maintainAspectRatio: false, indexAxis: 'y', scales: { x: { max: 120, grid: { color: 'rgba(148,163,184,0.08)' }, ticks: { callback: v => v+'%' } }, y: { grid: { display: false } } }, plugins: { legend: { display: false } } }
  });

  charts.leads = new Chart(document.getElementById('leadsChart').getContext('2d'), {
    type: 'bar',
    data: { labels: ['Новые','В работе','КП отпр.','Выиграны','Проиграны'], datasets: [{ data: [kpi.leads.new_count, kpi.leads.in_progress, kpi.leads.proposal_sent, kpi.leads.won, kpi.leads.lost], backgroundColor: ['#60a5fa','#a78bfa','#facc15','#4ade80','#f87171'], borderRadius: 6, barThickness: 28 }] },
    options: { responsive: true, maintainAspectRatio: false, indexAxis: 'y', scales: { x: { grid: { color: 'rgba(148,163,184,0.08)' } }, y: { grid: { display: false } } }, plugins: { legend: { display: false } } }
  });
}

// ====== TABS & TABLES ======
function showTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.tab-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === tab);
    if (b.dataset.tab !== tab) b.classList.add('text-slate-400'); else b.classList.remove('text-slate-400');
  });
  document.getElementById('addBtn').style.display = canEditTab(tab) ? '' : 'none';
  loadTabData(tab);
}

async function loadTabData(tab) {
  const content = document.getElementById('tabContent');
  content.innerHTML = '<div class="text-center py-8 text-slate-500"><i class="fas fa-spinner fa-spin mr-2"></i>Загрузка...</div>';
  try {
    let url;
    switch(tab) {
      case 'objects': url = '/api/objects?status=active'; break;
      case 'defects': url = '/api/defects?status=open'; break;
      case 'tests': url = '/api/tests'; break;
      case 'protocols': url = '/api/protocols'; break;
      case 'repeats': url = '/api/repeats'; break;
      case 'leads': url = '/api/leads'; break;
    }
    const data = await (await fetch(url)).json();
    content.innerHTML = renderTable(tab, data);
  } catch(err) {
    content.innerHTML = '<div class="text-center py-8 text-red-400"><i class="fas fa-exclamation-triangle mr-2"></i>Ошибка загрузки</div>';
  }
}

function actionBtns(tab, row) {
  if (!canEditTab(tab)) return '';
  let html = '<div class="flex gap-1 flex-nowrap">';

  // Status changes
  const statusActions = {
    objects: { active: [{s:'paused',i:'fa-pause',t:'Приостановить'},{s:'completed',i:'fa-check',t:'Завершить'}], paused: [{s:'active',i:'fa-play',t:'Возобновить'}] },
    defects: { open: [{s:'in_progress',i:'fa-wrench',t:'В работу'},{s:'closed',i:'fa-check',t:'Закрыть'}], in_progress: [{s:'closed',i:'fa-check',t:'Закрыть'}], closed: [{s:'reopened',i:'fa-redo',t:'Переоткрыть'}], reopened: [{s:'in_progress',i:'fa-wrench',t:'В работу'},{s:'closed',i:'fa-check',t:'Закрыть'}] },
    tests: { queued: [{s:'in_progress',i:'fa-play',t:'Начать'}], in_progress: [{s:'completed',i:'fa-check',t:'Результат'}] },
    protocols: { draft: [{s:'review',i:'fa-paper-plane',t:'На проверку'}], review: [{s:'issued',i:'fa-check',t:'Выдать'}] },
    leads: { new:[{s:'in_progress',i:'fa-arrow-right',t:'В работу'}], in_progress:[{s:'proposal_sent',i:'fa-paper-plane',t:'Отпр. КП'}], proposal_sent:[{s:'won',i:'fa-trophy',t:'Выиграна'},{s:'lost',i:'fa-times',t:'Проиграна'}] },
  };

  const actions = statusActions[tab]?.[row.status] || [];
  actions.forEach(a => {
    if (tab === 'tests' && a.s === 'completed') {
      html += '<span class="action-btn text-green-400" title="'+a.t+'" onclick="openTestCompleteModal('+row.id+')"><i class="fas '+a.i+'"></i></span>';
    } else if (tab === 'leads' && a.s === 'lost') {
      html += '<span class="action-btn text-red-400" title="'+a.t+'" onclick="openLostReasonModal('+row.id+')"><i class="fas '+a.i+'"></i></span>';
    } else {
      html += '<span class="action-btn text-blue-400" title="'+a.t+'" onclick="changeStatus(\''+tab+'\','+row.id+',\''+a.s+'\')"><i class="fas '+a.i+'"></i></span>';
    }
  });

  // Edit (for objects, defects)
  if (['objects','defects'].includes(tab) && row.status !== 'closed') {
    html += '<span class="action-btn text-slate-400" title="Редактировать" onclick="openEditModal(\''+tab+'\','+row.id+')"><i class="fas fa-pen"></i></span>';
  }

  // Delete (admin only)
  if (isAdmin()) {
    html += '<span class="action-btn text-red-400/50 hover:text-red-400" title="Удалить" onclick="deleteItem(\''+tab+'\','+row.id+')"><i class="fas fa-trash"></i></span>';
  }

  html += '</div>';
  return html;
}

function renderTable(tab, data) {
  if (!data || data.length === 0) return '<div class="text-center py-8 text-slate-500">Нет данных</div>';

  const tables = {
    objects: { cols: ['Объект','Адрес','Подрядчик','Инженер','Откр. замеч.','Срок',''], row: r => [
      r.name, '<span class="text-slate-500">'+(r.address||'')+'</span>', r.contractor_name||'—', r.engineer_name||'—',
      r.open_defects > 0 ? '<span class="text-red-400 font-semibold">'+r.open_defects+'</span>' : '<span class="text-green-400">0</span>',
      r.planned_end_date||'—', actionBtns('objects', r)
    ]},
    defects: { cols: ['Описание','Объект','Подрядчик','Кат.','Статус','Дедлайн',''], row: r => [
      '<div class="max-w-[200px] truncate">'+r.description+'</div>',
      '<span class="text-slate-400">'+(r.object_name||'')+'</span>', r.contractor_name||'—',
      categoryBadge(r.category), statusBadge(r.status),
      r.deadline ? (new Date(r.deadline)<new Date() && r.status!=='closed' ? '<span class="text-red-400 font-semibold">'+r.deadline+'</span>' : r.deadline) : '—',
      actionBtns('defects', r)
    ]},
    tests: { cols: ['Материал','Вид','Объект','Инженер','Статус','Результат',''], row: r => [
      r.material_type, r.test_type, '<span class="text-slate-400">'+(r.object_name||'')+'</span>',
      r.engineer_name||'—', statusBadge(r.status),
      r.result ? (r.result==='соответствует' ? '<span class="text-green-400">'+r.result+'</span>' : '<span class="text-red-400">'+r.result+'</span>') : '—',
      actionBtns('tests', r)
    ]},
    protocols: { cols: ['Номер','Тип','Объект','Инженер','Статус','Срок',''], row: r => [
      '<span class="font-mono text-xs">'+r.protocol_number+'</span>', r.protocol_type,
      '<span class="text-slate-400">'+(r.object_name||'')+'</span>', r.engineer_name||'—',
      statusBadge(r.status),
      r.due_date ? (r.status==='overdue' ? '<span class="text-red-400 font-semibold">'+r.due_date+'</span>' : r.due_date) : '—',
      actionBtns('protocols', r)
    ]},
    repeats: { cols: ['Описание','Объект','Подрядчик','Кат.','Исходное','Дедлайн'], row: r => [
      '<div class="max-w-[180px] truncate">'+r.description+'</div>',
      '<span class="text-slate-400">'+(r.object_name||'')+'</span>',
      '<span class="text-orange-400">'+(r.contractor_name||'')+'</span>',
      categoryBadge(r.category),
      '<div class="max-w-[120px] truncate text-slate-500 text-xs">'+(r.original_description||'—')+'</div>',
      r.deadline||'—'
    ]},
    leads: { cols: ['Компания','Услуга','Сумма','Источник','Статус','Дата',''], row: r => [
      '<div><div class="font-medium">'+r.company_name+'</div><div class="text-xs text-slate-500">'+(r.contact_person||'')+'</div></div>',
      r.service_type, '<span class="font-semibold">'+fmtMoney(r.estimated_value)+' \\u20BD</span>',
      r.source||'—', statusBadge(r.status), r.created_at ? r.created_at.split('T')[0] : '—',
      actionBtns('leads', r)
    ]},
  };

  const t = tables[tab];
  let html = '<div class="overflow-x-auto"><table class="w-full text-sm"><thead><tr class="border-b border-slate-700/30">';
  t.cols.forEach(c => html += '<th class="text-left py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">'+c+'</th>');
  html += '</tr></thead><tbody>';
  data.forEach(r => { const cells = t.row(r); html += '<tr class="table-row border-b border-slate-800/30">'; cells.forEach(c => html += '<td class="py-2.5 px-3">'+c+'</td>'); html += '</tr>'; });
  html += '</tbody></table></div>';
  html += '<div class="mt-3 text-xs text-slate-600 text-right">Всего: '+data.length+'</div>';
  return html;
}

// ====== STATUS CHANGES ======
async function changeStatus(tab, id, status) {
  const urlMap = { objects: '/api/crud/objects/'+id+'/status', defects: '/api/crud/defects/'+id+'/status', tests: '/api/crud/tests/'+id+'/status', protocols: '/api/crud/protocols/'+id+'/status', leads: '/api/crud/leads/'+id+'/status' };
  await apiCall('PATCH', urlMap[tab], { status });
  toast('Статус обновлён', 'ok');
  loadTabData(currentTab);
  loadData();
}

async function deleteItem(tab, id) {
  if (!confirm('Удалить запись #'+id+'?')) return;
  await apiCall('DELETE', '/api/crud/'+tab+'/'+id);
  toast('Удалено', 'ok');
  loadTabData(currentTab);
  loadData();
}

// ====== MODALS ======
function openModal(title, bodyHtml, onSubmit) {
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalBody').innerHTML = bodyHtml;
  modalContext.onSubmit = onSubmit;
  document.getElementById('modal').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('modal').classList.add('hidden');
  modalContext = {};
}

async function submitModal() {
  if (modalContext.onSubmit) await modalContext.onSubmit();
}

function fieldHtml(label, name, type, value, options) {
  let html = '<div class="mb-3"><label class="block text-xs font-medium text-slate-400 mb-1">'+label+'</label>';
  if (type === 'select') {
    html += '<select class="input-field" name="'+name+'">'+options+'</select>';
  } else if (type === 'textarea') {
    html += '<textarea class="input-field" name="'+name+'" rows="3">'+(value||'')+'</textarea>';
  } else {
    html += '<input type="'+type+'" class="input-field" name="'+name+'" value="'+(value||'')+'">';
  }
  html += '</div>';
  return html;
}

function getFormData() {
  const obj = {};
  document.querySelectorAll('#modalBody .input-field').forEach(el => {
    let val = el.value;
    if (el.type === 'number' && val) val = Number(val);
    if (val === '') val = null;
    obj[el.name] = val;
  });
  return obj;
}

// ====== CREATE MODALS ======
function openCreateModal() {
  const forms = {
    objects: () => {
      const html = fieldHtml('Название *','name','text','') +
        fieldHtml('Адрес','address','text','') +
        fieldHtml('Подрядчик','contractor_id','select','',selectOptions(refs.contractors,'id','name','')) +
        fieldHtml('Инженер','engineer_id','select','',selectOptions(refs.engineers,'id','name','')) +
        fieldHtml('Дата начала','start_date','date','') +
        fieldHtml('Плановое окончание','planned_end_date','date','');
      openModal('Новый объект', html, async () => {
        const d = getFormData();
        if (!d.name) { toast('Название обязательно','error'); return; }
        await apiCall('POST', '/api/crud/objects', d);
        toast('Объект создан','ok'); closeModal(); loadTabData(currentTab); loadData(); loadRefs();
      });
    },
    defects: () => {
      const html = fieldHtml('Объект *','object_id','select','',selectOptions(refs.objects,'id','name','')) +
        fieldHtml('Подрядчик','contractor_id','select','',selectOptions(refs.contractors,'id','name','')) +
        fieldHtml('Категория *','category','select','','<option value="критическое">Критическое</option><option value="значительное" selected>Значительное</option><option value="незначительное">Незначительное</option>') +
        fieldHtml('Описание *','description','textarea','') +
        fieldHtml('Дедлайн','deadline','date','');
      openModal('Новое замечание', html, async () => {
        const d = getFormData();
        if (!d.object_id || !d.category || !d.description) { toast('Заполните обязательные поля','error'); return; }
        await apiCall('POST', '/api/crud/defects', d);
        toast('Замечание создано','ok'); closeModal(); loadTabData(currentTab); loadData();
      });
    },
    tests: () => {
      const html = fieldHtml('Объект *','object_id','select','',selectOptions(refs.objects,'id','name','')) +
        fieldHtml('Тип материала *','material_type','select','','<option value="бетон">Бетон</option><option value="арматура">Арматура</option><option value="грунт">Грунт</option><option value="асфальт">Асфальт</option><option value="раствор">Раствор</option>') +
        fieldHtml('Вид испытания *','test_type','select','','<option value="прочность">Прочность</option><option value="морозостойкость">Морозостойкость</option><option value="водонепроницаемость">Водонепроницаемость</option>');
      openModal('Новое испытание', html, async () => {
        const d = getFormData();
        if (!d.object_id || !d.material_type || !d.test_type) { toast('Заполните все поля','error'); return; }
        await apiCall('POST', '/api/crud/tests', d);
        toast('Испытание поставлено в очередь','ok'); closeModal(); loadTabData(currentTab); loadData();
      });
    },
    protocols: () => {
      const html = fieldHtml('Объект *','object_id','select','',selectOptions(refs.objects,'id','name','')) +
        fieldHtml('Номер протокола *','protocol_number','text','') +
        fieldHtml('Тип *','protocol_type','select','','<option value="испытание">Испытание</option><option value="акт_осмотра">Акт осмотра</option><option value="заключение">Заключение</option><option value="предписание">Предписание</option>') +
        fieldHtml('Срок выдачи','due_date','date','');
      openModal('Новый протокол', html, async () => {
        const d = getFormData();
        if (!d.object_id || !d.protocol_number || !d.protocol_type) { toast('Заполните обязательные поля','error'); return; }
        await apiCall('POST', '/api/crud/protocols', d);
        toast('Протокол создан','ok'); closeModal(); loadTabData(currentTab); loadData();
      });
    },
    leads: () => {
      const html = fieldHtml('Компания *','company_name','text','') +
        fieldHtml('Контактное лицо','contact_person','text','') +
        fieldHtml('Телефон','phone','text','') +
        fieldHtml('Email','email','text','') +
        fieldHtml('Тип услуги *','service_type','select','','<option value="строительный_контроль">Строительный контроль</option><option value="экспертиза">Экспертиза</option><option value="лаборатория">Лаборатория</option><option value="комплекс">Комплекс</option>') +
        fieldHtml('Сумма (оценка)','estimated_value','number','') +
        fieldHtml('Источник','source','select','','<option value="сайт">Сайт</option><option value="рекомендация">Рекомендация</option><option value="тендер">Тендер</option><option value="повторный_клиент">Повторный клиент</option>');
      openModal('Новая заявка', html, async () => {
        const d = getFormData();
        if (!d.company_name || !d.service_type) { toast('Заполните обязательные поля','error'); return; }
        await apiCall('POST', '/api/crud/leads', d);
        toast('Заявка создана','ok'); closeModal(); loadTabData(currentTab); loadData();
      });
    },
  };

  if (forms[currentTab]) forms[currentTab]();
  else toast('Добавление недоступно для этой вкладки','error');
}

// ====== EDIT MODALS ======
async function openEditModal(tab, id) {
  // Fetch current data
  let url;
  if (tab === 'objects') url = '/api/objects?status=active';
  else if (tab === 'defects') url = '/api/defects?status=open';
  const data = await (await fetch(url)).json();
  const item = data.find(r => r.id === id);
  if (!item) { toast('Запись не найдена','error'); return; }

  if (tab === 'objects') {
    const html = fieldHtml('Название *','name','text',item.name) +
      fieldHtml('Адрес','address','text',item.address||'') +
      fieldHtml('Подрядчик','contractor_id','select','',selectOptions(refs.contractors,'id','name',item.contractor_id)) +
      fieldHtml('Инженер','engineer_id','select','',selectOptions(refs.engineers,'id','name',item.engineer_id)) +
      fieldHtml('Дата начала','start_date','date',item.start_date||'') +
      fieldHtml('Плановое окончание','planned_end_date','date',item.planned_end_date||'');
    openModal('Редактирование объекта', html, async () => {
      const d = getFormData();
      if (!d.name) { toast('Название обязательно','error'); return; }
      await apiCall('PUT', '/api/crud/objects/'+id, d);
      toast('Объект обновлён','ok'); closeModal(); loadTabData(currentTab); loadRefs();
    });
  }

  if (tab === 'defects') {
    const html = fieldHtml('Категория','category','select','','<option value="критическое" '+(item.category==='критическое'?'selected':'')+'>Критическое</option><option value="значительное" '+(item.category==='значительное'?'selected':'')+'>Значительное</option><option value="незначительное" '+(item.category==='незначительное'?'selected':'')+'>Незначительное</option>') +
      fieldHtml('Описание','description','textarea',item.description||'') +
      fieldHtml('Подрядчик','contractor_id','select','',selectOptions(refs.contractors,'id','name',item.contractor_id)) +
      fieldHtml('Дедлайн','deadline','date',item.deadline||'');
    openModal('Редактирование замечания', html, async () => {
      const d = getFormData();
      await apiCall('PUT', '/api/crud/defects/'+id, d);
      toast('Замечание обновлено','ok'); closeModal(); loadTabData(currentTab);
    });
  }
}

// ====== SPECIAL MODALS ======
function openTestCompleteModal(id) {
  const html = fieldHtml('Результат *','result','select','','<option value="соответствует">Соответствует</option><option value="не_соответствует">Не соответствует</option>') +
    fieldHtml('Номер протокола','protocol_number','text','');
  openModal('Результат испытания', html, async () => {
    const d = getFormData();
    if (!d.result) { toast('Укажите результат','error'); return; }
    await apiCall('PATCH', '/api/crud/tests/'+id+'/status', { status: 'completed', ...d });
    toast('Испытание завершено','ok'); closeModal(); loadTabData(currentTab); loadData();
  });
}

function openLostReasonModal(id) {
  const html = fieldHtml('Причина проигрыша','lost_reason','select','','<option value="цена">Цена</option><option value="выбрали_другого">Выбрали другого</option><option value="бюджет">Бюджет отменён</option><option value="другое">Другое</option>');
  openModal('Причина проигрыша', html, async () => {
    const d = getFormData();
    await apiCall('PATCH', '/api/crud/leads/'+id+'/status', { status: 'lost', ...d });
    toast('Статус обновлён','ok'); closeModal(); loadTabData(currentTab); loadData();
  });
}

// ====== DATA LOADING ======
async function loadData() {
  try {
    const resp = await fetch('/api/kpi/summary');
    kpiData = await resp.json();
    renderKPI(kpiData.kpi);
    renderCharts(kpiData.kpi);
    loadTabData(currentTab);
    document.getElementById('lastUpdate').textContent = 'Обновлено: ' + new Date().toLocaleTimeString('ru-RU');
  } catch(err) { console.error('Failed to load KPI:', err); }
}

// ====== INIT ======
async function init() {
  await checkAuth();
  await loadRefs();
  await loadData();
  document.getElementById('addBtn').style.display = canEditTab(currentTab) ? '' : 'none';
}
init();
setInterval(loadData, 300000);
</script>
</body>
</html>`
