import { Hono } from 'hono'

type Bindings = { DB: D1Database }

export const dashboard = new Hono<{ Bindings: Bindings }>()

dashboard.get('/', (c) => {
  return c.html(`<!DOCTYPE html>
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
    .kpi-card { 
      background: linear-gradient(135deg, rgba(30,41,59,0.9), rgba(15,23,42,0.95));
      border: 1px solid rgba(148,163,184,0.1);
      backdrop-filter: blur(10px);
      transition: all 0.3s ease;
    }
    .kpi-card:hover { 
      border-color: rgba(59,130,246,0.4); 
      transform: translateY(-2px);
      box-shadow: 0 8px 25px rgba(0,0,0,0.3);
    }
    .kpi-value { font-variant-numeric: tabular-nums; }
    .status-pulse { animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
    .detail-panel {
      background: linear-gradient(135deg, rgba(30,41,59,0.95), rgba(15,23,42,0.98));
      border: 1px solid rgba(148,163,184,0.1);
    }
    .badge { padding: 2px 8px; border-radius: 9999px; font-size: 0.7rem; font-weight: 600; }
    .badge-red { background: rgba(239,68,68,0.15); color: #f87171; }
    .badge-orange { background: rgba(249,115,22,0.15); color: #fb923c; }
    .badge-yellow { background: rgba(234,179,8,0.15); color: #facc15; }
    .badge-green { background: rgba(34,197,94,0.15); color: #4ade80; }
    .badge-blue { background: rgba(59,130,246,0.15); color: #60a5fa; }
    .badge-gray { background: rgba(148,163,184,0.15); color: #94a3b8; }
    .progress-bar { height: 6px; border-radius: 3px; background: rgba(148,163,184,0.15); overflow: hidden; }
    .progress-fill { height: 100%; border-radius: 3px; transition: width 1s ease; }
    .tab-btn { transition: all 0.2s ease; }
    .tab-btn.active { background: rgba(59,130,246,0.2); color: #60a5fa; border-color: rgba(59,130,246,0.5); }
    .glow-red { box-shadow: 0 0 15px rgba(239,68,68,0.2); border-color: rgba(239,68,68,0.4) !important; }
    .glow-green { box-shadow: 0 0 15px rgba(34,197,94,0.15); border-color: rgba(34,197,94,0.3) !important; }
    .table-row:hover { background: rgba(59,130,246,0.05); }
    ::-webkit-scrollbar { width: 6px; }
    ::-webkit-scrollbar-track { background: rgba(15,23,42,0.5); }
    ::-webkit-scrollbar-thumb { background: rgba(148,163,184,0.3); border-radius: 3px; }
  </style>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            slate: { 850: '#172033', 950: '#0b1120' }
          }
        }
      }
    }
  </script>
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
      <div class="flex items-center gap-4">
        <div id="lastUpdate" class="text-xs text-slate-500"></div>
        <button onclick="loadData()" class="px-3 py-1.5 bg-slate-700/50 hover:bg-slate-600/50 rounded-lg text-xs text-slate-300 transition">
          <i class="fas fa-sync-alt mr-1"></i> Обновить
        </button>
      </div>
    </div>
  </header>

  <main class="max-w-[1600px] mx-auto px-4 sm:px-6 py-6">
    <!-- Alert bar for critical issues -->
    <div id="alertBar" class="hidden mb-6 p-3 rounded-xl bg-red-900/20 border border-red-800/30 flex items-center gap-3">
      <div class="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
        <i class="fas fa-exclamation-triangle text-red-400 text-sm"></i>
      </div>
      <span id="alertText" class="text-sm text-red-300"></span>
    </div>

    <!-- KPI Cards Grid -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6" id="kpiGrid">
      <!-- Cards will be injected here -->
    </div>

    <!-- Charts Row -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
      <div class="kpi-card rounded-2xl p-5">
        <h3 class="text-sm font-semibold text-slate-400 mb-4"><i class="fas fa-chart-pie mr-2 text-blue-400"></i>Замечания по категориям</h3>
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
      <div class="flex gap-1 p-2 border-b border-slate-700/30 overflow-x-auto">
        <button onclick="showTab('objects')" class="tab-btn active px-4 py-2 rounded-lg text-xs font-medium border border-transparent whitespace-nowrap" data-tab="objects">
          <i class="fas fa-building mr-1"></i> Объекты
        </button>
        <button onclick="showTab('defects')" class="tab-btn px-4 py-2 rounded-lg text-xs font-medium border border-transparent text-slate-400 whitespace-nowrap" data-tab="defects">
          <i class="fas fa-exclamation-circle mr-1"></i> Замечания
        </button>
        <button onclick="showTab('tests')" class="tab-btn px-4 py-2 rounded-lg text-xs font-medium border border-transparent text-slate-400 whitespace-nowrap" data-tab="tests">
          <i class="fas fa-flask mr-1"></i> Испытания
        </button>
        <button onclick="showTab('protocols')" class="tab-btn px-4 py-2 rounded-lg text-xs font-medium border border-transparent text-slate-400 whitespace-nowrap" data-tab="protocols">
          <i class="fas fa-file-alt mr-1"></i> Протоколы
        </button>
        <button onclick="showTab('repeats')" class="tab-btn px-4 py-2 rounded-lg text-xs font-medium border border-transparent text-slate-400 whitespace-nowrap" data-tab="repeats">
          <i class="fas fa-redo mr-1"></i> Повторные
        </button>
        <button onclick="showTab('leads')" class="tab-btn px-4 py-2 rounded-lg text-xs font-medium border border-transparent text-slate-400 whitespace-nowrap" data-tab="leads">
          <i class="fas fa-handshake mr-1"></i> Заявки
        </button>
      </div>
      <div id="tabContent" class="p-4 max-h-[500px] overflow-auto"></div>
    </div>
  </main>

  <script>
    // ====== STATE ======
    let kpiData = null;
    let charts = {};
    let currentTab = 'objects';

    // ====== UTILS ======
    const fmt = (n) => n != null ? Number(n).toLocaleString('ru-RU') : '0';
    const fmtMoney = (n) => {
      if (!n) return '0';
      if (n >= 1e6) return (n/1e6).toFixed(1).replace('.0','') + ' млн';
      if (n >= 1e3) return (n/1e3).toFixed(0) + ' тыс';
      return fmt(n);
    };

    function statusBadge(status) {
      const map = {
        'open': ['Открыто', 'badge-red'],
        'in_progress': ['В работе', 'badge-yellow'],
        'closed': ['Закрыто', 'badge-green'],
        'reopened': ['Повторно', 'badge-orange'],
        'queued': ['В очереди', 'badge-blue'],
        'completed': ['Завершено', 'badge-green'],
        'failed': ['Брак', 'badge-red'],
        'overdue': ['Просрочен', 'badge-red'],
        'draft': ['Черновик', 'badge-gray'],
        'review': ['На проверке', 'badge-blue'],
        'issued': ['Выдан', 'badge-green'],
        'active': ['Активный', 'badge-green'],
        'paused': ['Приостановлен', 'badge-yellow'],
        'new': ['Новая', 'badge-blue'],
        'proposal_sent': ['КП отправлено', 'badge-yellow'],
        'won': ['Выиграна', 'badge-green'],
        'lost': ['Проиграна', 'badge-red'],
      };
      const [label, cls] = map[status] || [status, 'badge-gray'];
      return '<span class="badge ' + cls + '">' + label + '</span>';
    }

    function categoryBadge(cat) {
      const map = {
        'критическое': 'badge-red',
        'значительное': 'badge-orange',
        'незначительное': 'badge-yellow',
      };
      return '<span class="badge ' + (map[cat]||'badge-gray') + '">' + cat + '</span>';
    }

    // ====== KPI CARDS ======
    function renderKPI(kpi) {
      const cards = [
        {
          icon: 'fa-building', color: 'blue',
          title: 'Объекты в работе',
          value: kpi.objects.active,
          sub: 'из ' + kpi.objects.total + ' всего, ' + kpi.objects.paused + ' приостановлено',
          glow: ''
        },
        {
          icon: 'fa-exclamation-circle', color: 'red',
          title: 'Замечания открыто',
          value: kpi.defects.open,
          sub: fmt(kpi.defects.closed) + ' закрыто, ' + fmt(kpi.defects.total) + ' всего',
          glow: kpi.defects.critical_overdue > 0 ? 'glow-red' : ''
        },
        {
          icon: 'fa-clock', color: 'amber',
          title: 'Ср. срок закрытия',
          value: kpi.defects.avg_close_days + ' дн',
          sub: kpi.defects.critical_overdue + ' критич. просрочено',
          glow: kpi.defects.avg_close_days > 14 ? 'glow-red' : ''
        },
        {
          icon: 'fa-flask', color: 'cyan',
          title: 'Испытания в очереди',
          value: kpi.tests.queued,
          sub: kpi.tests.in_progress + ' в процессе, ' + kpi.tests.completed + ' завершено',
          glow: kpi.tests.queued > 10 ? 'glow-red' : ''
        },
        {
          icon: 'fa-file-exclamation fa-file-alt', color: 'rose',
          title: 'Протоколы просрочены',
          value: kpi.protocols.overdue,
          sub: kpi.protocols.review + ' на проверке, ' + kpi.protocols.draft + ' черновиков',
          glow: kpi.protocols.overdue > 3 ? 'glow-red' : ''
        },
        {
          icon: 'fa-users', color: 'violet',
          title: 'Загрузка инженеров',
          value: kpi.engineers.avg_load_percent + '%',
          sub: kpi.engineers.details.length + ' инженеров активно',
          glow: kpi.engineers.avg_load_percent > 85 ? 'glow-red' : (kpi.engineers.avg_load_percent > 70 ? '' : 'glow-green')
        },
        {
          icon: 'fa-redo', color: 'orange',
          title: 'Повторные несоотв.',
          value: kpi.repeats.total,
          sub: kpi.repeats.by_contractor.length + ' подрядчиков с повторами',
          glow: kpi.repeats.total > 5 ? 'glow-red' : ''
        },
        {
          icon: 'fa-handshake', color: 'emerald',
          title: 'Конверсия заявок',
          value: kpi.leads.conversion_rate + '%',
          sub: kpi.leads.won + ' из ' + kpi.leads.total + ', ' + fmtMoney(kpi.leads.won_value) + ' \u20BD',
          glow: kpi.leads.conversion_rate >= 30 ? 'glow-green' : ''
        },
      ];

      const colorMap = {
        blue: 'text-blue-400', red: 'text-red-400', amber: 'text-amber-400',
        cyan: 'text-cyan-400', rose: 'text-rose-400', violet: 'text-violet-400',
        orange: 'text-orange-400', emerald: 'text-emerald-400'
      };
      const bgMap = {
        blue: 'bg-blue-500/10', red: 'bg-red-500/10', amber: 'bg-amber-500/10',
        cyan: 'bg-cyan-500/10', rose: 'bg-rose-500/10', violet: 'bg-violet-500/10',
        orange: 'bg-orange-500/10', emerald: 'bg-emerald-500/10'
      };

      document.getElementById('kpiGrid').innerHTML = cards.map(c => 
        '<div class="kpi-card rounded-2xl p-4 sm:p-5 ' + c.glow + '">' +
          '<div class="flex items-center gap-3 mb-3">' +
            '<div class="w-9 h-9 rounded-xl ' + bgMap[c.color] + ' flex items-center justify-center">' +
              '<i class="fas ' + c.icon.split(' ')[0] + ' ' + colorMap[c.color] + ' text-sm"></i>' +
            '</div>' +
            '<span class="text-xs font-medium text-slate-400">' + c.title + '</span>' +
          '</div>' +
          '<div class="kpi-value text-2xl sm:text-3xl font-bold text-white mb-1">' + c.value + '</div>' +
          '<div class="text-xs text-slate-500">' + c.sub + '</div>' +
        '</div>'
      ).join('');

      // Alert bar
      const alerts = [];
      if (kpi.defects.critical_overdue > 0) 
        alerts.push(kpi.defects.critical_overdue + ' критических замечаний просрочено!');
      if (kpi.protocols.overdue > 3) 
        alerts.push(kpi.protocols.overdue + ' протоколов просрочено');

      const bar = document.getElementById('alertBar');
      if (alerts.length > 0) {
        bar.classList.remove('hidden');
        document.getElementById('alertText').textContent = alerts.join(' | ');
      } else {
        bar.classList.add('hidden');
      }
    }

    // ====== CHARTS ======
    function renderCharts(kpi) {
      // Destroy existing charts
      Object.values(charts).forEach(c => c.destroy());
      charts = {};

      const chartDefaults = {
        color: '#94a3b8',
        font: { family: 'Inter' }
      };
      Chart.defaults.color = '#94a3b8';
      Chart.defaults.font.family = 'Inter';

      // 1. Defects Doughnut
      const defCtx = document.getElementById('defectsChart').getContext('2d');
      charts.defects = new Chart(defCtx, {
        type: 'doughnut',
        data: {
          labels: ['Открыто', 'В работе', 'Повторно', 'Закрыто'],
          datasets: [{
            data: [
              kpi.defects.open - kpiData.kpi.repeats.total,
              3, // in_progress approximate
              kpiData.kpi.repeats.total,
              kpi.defects.closed
            ],
            backgroundColor: ['#f87171', '#facc15', '#fb923c', '#4ade80'],
            borderWidth: 0,
            hoverOffset: 8
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          cutout: '65%',
          plugins: { 
            legend: { position: 'bottom', labels: { padding: 12, usePointStyle: true, pointStyle: 'circle', font: { size: 11 } } }
          }
        }
      });

      // 2. Engineers Bar
      const engCtx = document.getElementById('engineersChart').getContext('2d');
      const engData = kpi.engineers.details;
      charts.engineers = new Chart(engCtx, {
        type: 'bar',
        data: {
          labels: engData.map(e => e.name.split(' ')[0]),
          datasets: [{
            label: 'Загрузка %',
            data: engData.map(e => e.load_percent),
            backgroundColor: engData.map(e => 
              e.load_percent > 85 ? '#f87171' : e.load_percent > 60 ? '#facc15' : '#4ade80'
            ),
            borderRadius: 6,
            barThickness: 28
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          indexAxis: 'y',
          scales: {
            x: { max: 120, grid: { color: 'rgba(148,163,184,0.08)' }, ticks: { callback: v => v + '%' } },
            y: { grid: { display: false } }
          },
          plugins: { legend: { display: false } }
        }
      });

      // 3. Leads Funnel (horizontal bar)
      const ldCtx = document.getElementById('leadsChart').getContext('2d');
      charts.leads = new Chart(ldCtx, {
        type: 'bar',
        data: {
          labels: ['Новые', 'В работе', 'КП отпр.', 'Выиграны', 'Проиграны'],
          datasets: [{
            data: [kpi.leads.new_count, kpi.leads.in_progress, kpi.leads.proposal_sent, kpi.leads.won, kpi.leads.lost],
            backgroundColor: ['#60a5fa', '#a78bfa', '#facc15', '#4ade80', '#f87171'],
            borderRadius: 6,
            barThickness: 28
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          indexAxis: 'y',
          scales: {
            x: { grid: { color: 'rgba(148,163,184,0.08)' } },
            y: { grid: { display: false } }
          },
          plugins: { legend: { display: false } }
        }
      });
    }

    // ====== DETAIL TABS ======
    function showTab(tab) {
      currentTab = tab;
      document.querySelectorAll('.tab-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.tab === tab);
        if (b.dataset.tab !== tab) b.classList.add('text-slate-400');
        else b.classList.remove('text-slate-400');
      });
      loadTabData(tab);
    }

    async function loadTabData(tab) {
      const content = document.getElementById('tabContent');
      content.innerHTML = '<div class="text-center py-8 text-slate-500"><i class="fas fa-spinner fa-spin mr-2"></i>Загрузка...</div>';

      try {
        let url, data;
        switch(tab) {
          case 'objects': url = '/api/objects?status=active'; break;
          case 'defects': url = '/api/defects?status=open'; break;
          case 'tests': url = '/api/tests'; break;
          case 'protocols': url = '/api/protocols'; break;
          case 'repeats': url = '/api/repeats'; break;
          case 'leads': url = '/api/leads'; break;
        }
        const resp = await fetch(url);
        data = await resp.json();
        content.innerHTML = renderTable(tab, data);
      } catch(err) {
        content.innerHTML = '<div class="text-center py-8 text-red-400"><i class="fas fa-exclamation-triangle mr-2"></i>Ошибка загрузки</div>';
      }
    }

    function renderTable(tab, data) {
      if (!data || data.length === 0) return '<div class="text-center py-8 text-slate-500">Нет данных</div>';

      const tables = {
        objects: {
          cols: ['Объект', 'Адрес', 'Подрядчик', 'Инженер', 'Откр. замеч.', 'Срок'],
          row: r => [
            r.name,
            '<span class="text-slate-500">' + (r.address||'') + '</span>',
            r.contractor_name || '—',
            r.engineer_name || '—',
            r.open_defects > 0 ? '<span class="text-red-400 font-semibold">' + r.open_defects + '</span>' : '<span class="text-green-400">0</span>',
            r.planned_end_date || '—'
          ]
        },
        defects: {
          cols: ['Описание', 'Объект', 'Подрядчик', 'Категория', 'Статус', 'Дедлайн'],
          row: r => [
            '<div class="max-w-xs truncate">' + r.description + '</div>',
            '<span class="text-slate-400">' + (r.object_name||'') + '</span>',
            r.contractor_name || '—',
            categoryBadge(r.category),
            statusBadge(r.status),
            r.deadline ? (new Date(r.deadline) < new Date() && r.status !== 'closed' ? '<span class="text-red-400 font-semibold">' + r.deadline + '</span>' : r.deadline) : '—'
          ]
        },
        tests: {
          cols: ['Материал', 'Вид испытания', 'Объект', 'Инженер', 'Статус', 'Дата постановки'],
          row: r => [
            r.material_type,
            r.test_type,
            '<span class="text-slate-400">' + (r.object_name||'') + '</span>',
            r.engineer_name || '—',
            statusBadge(r.status),
            r.queued_at ? r.queued_at.split('T')[0] : '—'
          ]
        },
        protocols: {
          cols: ['Номер', 'Тип', 'Объект', 'Инженер', 'Статус', 'Срок выдачи'],
          row: r => [
            '<span class="font-mono text-xs">' + r.protocol_number + '</span>',
            r.protocol_type,
            '<span class="text-slate-400">' + (r.object_name||'') + '</span>',
            r.engineer_name || '—',
            statusBadge(r.status),
            r.due_date ? (r.status === 'overdue' ? '<span class="text-red-400 font-semibold">' + r.due_date + '</span>' : r.due_date) : '—'
          ]
        },
        repeats: {
          cols: ['Описание', 'Объект', 'Подрядчик', 'Категория', 'Исх. замечание', 'Дедлайн'],
          row: r => [
            '<div class="max-w-xs truncate">' + r.description + '</div>',
            '<span class="text-slate-400">' + (r.object_name||'') + '</span>',
            '<span class="text-orange-400">' + (r.contractor_name||'') + '</span>',
            categoryBadge(r.category),
            '<div class="max-w-[120px] truncate text-slate-500 text-xs">' + (r.original_description||'—') + '</div>',
            r.deadline || '—'
          ]
        },
        leads: {
          cols: ['Компания', 'Услуга', 'Сумма', 'Источник', 'Статус', 'Дата'],
          row: r => [
            '<div><div class="font-medium">' + r.company_name + '</div><div class="text-xs text-slate-500">' + (r.contact_person||'') + '</div></div>',
            r.service_type,
            '<span class="font-semibold">' + fmtMoney(r.estimated_value) + ' \u20BD</span>',
            r.source || '—',
            statusBadge(r.status),
            r.created_at ? r.created_at.split('T')[0] : '—'
          ]
        },
      };

      const t = tables[tab];
      let html = '<div class="overflow-x-auto"><table class="w-full text-sm">';
      html += '<thead><tr class="border-b border-slate-700/30">';
      t.cols.forEach(c => html += '<th class="text-left py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">' + c + '</th>');
      html += '</tr></thead><tbody>';
      data.forEach(r => {
        const cells = t.row(r);
        html += '<tr class="table-row border-b border-slate-800/30">';
        cells.forEach(c => html += '<td class="py-2.5 px-3">' + c + '</td>');
        html += '</tr>';
      });
      html += '</tbody></table></div>';
      html += '<div class="mt-3 text-xs text-slate-600 text-right">Всего записей: ' + data.length + '</div>';
      return html;
    }

    // ====== DATA LOADING ======
    async function loadData() {
      try {
        const resp = await fetch('/api/kpi/summary');
        kpiData = await resp.json();
        renderKPI(kpiData.kpi);
        renderCharts(kpiData.kpi);
        loadTabData(currentTab);
        document.getElementById('lastUpdate').textContent = 
          'Обновлено: ' + new Date().toLocaleTimeString('ru-RU');
      } catch(err) {
        console.error('Failed to load KPI:', err);
      }
    }

    // Init
    loadData();
    // Auto-refresh every 5 minutes
    setInterval(loadData, 300000);
  </script>
</body>
</html>`)
})
