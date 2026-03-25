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
    document.getElementById('loginForm').addEventListener('submit', async function(e) {
      e.preventDefault();
      var err = document.getElementById('loginError');
      err.classList.add('hidden');
      try {
        var resp = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            login: document.getElementById('login').value,
            password: document.getElementById('password').value
          })
        });
        var data = await resp.json();
        if (data.ok) {
          localStorage.setItem('sk_token', data.token);
          localStorage.setItem('sk_user', JSON.stringify(data.user));
          window.location.href = '/';
        } else {
          err.textContent = data.error || 'Неверный логин или пароль';
          err.classList.remove('hidden');
        }
      } catch(ex) {
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
    .btn-ghost { background: rgba(148,163,184,0.1); color: #94a3b8; }
    .btn-ghost:hover { background: rgba(148,163,184,0.2); }
    .btn-sm { padding: 3px 10px; font-size: 0.7rem; border-radius: 8px; }
    .action-btn { cursor: pointer; padding: 2px 6px; border-radius: 6px; transition: all 0.15s; display: inline-block; }
    .action-btn:hover { background: rgba(59,130,246,0.15); }
    ::-webkit-scrollbar { width: 6px; }
    ::-webkit-scrollbar-track { background: rgba(15,23,42,0.5); }
    ::-webkit-scrollbar-thumb { background: rgba(148,163,184,0.3); border-radius: 3px; }
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
    <div id="alertBar" class="hidden mb-6 p-3 rounded-xl bg-red-900/20 border border-red-800/30 flex items-center gap-3">
      <div class="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
        <i class="fas fa-exclamation-triangle text-red-400 text-sm"></i>
      </div>
      <span id="alertText" class="text-sm text-red-300"></span>
    </div>

    <div class="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6" id="kpiGrid"></div>

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

  <script src="/static/app.js"></script>
</body>
</html>`
