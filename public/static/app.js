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
  const RUB = '\u20BD';
  const cards = [
    { icon:'fa-building', color:'blue', title:'Объекты в работе', value:kpi.objects.active, sub:'из '+kpi.objects.total+' всего, '+kpi.objects.paused+' приостановлено', glow:'' },
    { icon:'fa-exclamation-circle', color:'red', title:'Замечания открыто', value:kpi.defects.open, sub:fmt(kpi.defects.closed)+' закрыто, '+fmt(kpi.defects.total)+' всего', glow:kpi.defects.critical_overdue > 0 ? 'glow-red' : '' },
    { icon:'fa-clock', color:'amber', title:'Ср. срок закрытия', value:kpi.defects.avg_close_days+' дн', sub:kpi.defects.critical_overdue+' критич. просрочено', glow:kpi.defects.avg_close_days > 14 ? 'glow-red' : '' },
    { icon:'fa-flask', color:'cyan', title:'Испытания в очереди', value:kpi.tests.queued, sub:kpi.tests.in_progress+' в процессе, '+kpi.tests.completed+' завершено', glow:kpi.tests.queued > 10 ? 'glow-red' : '' },
    { icon:'fa-file-alt', color:'rose', title:'Протоколы просрочены', value:kpi.protocols.overdue, sub:kpi.protocols.review+' на проверке, '+kpi.protocols.draft+' черновиков', glow:kpi.protocols.overdue > 3 ? 'glow-red' : '' },
    { icon:'fa-users', color:'violet', title:'Загрузка инженеров', value:kpi.engineers.avg_load_percent+'%', sub:kpi.engineers.details.length+' инженеров активно', glow:kpi.engineers.avg_load_percent > 85 ? 'glow-red' : (kpi.engineers.avg_load_percent > 70 ? '' : 'glow-green') },
    { icon:'fa-redo', color:'orange', title:'Повторные несоотв.', value:kpi.repeats.total, sub:kpi.repeats.by_contractor.length+' подрядчиков с повторами', glow:kpi.repeats.total > 5 ? 'glow-red' : '' },
    { icon:'fa-handshake', color:'emerald', title:'Конверсия заявок', value:kpi.leads.conversion_rate+'%', sub:kpi.leads.won+' из '+kpi.leads.total+', '+fmtMoney(kpi.leads.won_value)+' '+RUB, glow:kpi.leads.conversion_rate >= 30 ? 'glow-green' : '' },
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

// ====== ACTION BUTTONS (using data attributes to avoid quoting issues) ======
function actionBtns(tab, row) {
  if (!canEditTab(tab)) return '';
  let html = '<div class="flex gap-1 flex-nowrap">';

  const statusActions = {
    objects: { active: [{s:'paused',i:'fa-pause',t:'Приостановить'},{s:'completed',i:'fa-check',t:'Завершить'}], paused: [{s:'active',i:'fa-play',t:'Возобновить'}] },
    defects: { open: [{s:'in_progress',i:'fa-wrench',t:'В работу'},{s:'closed',i:'fa-check',t:'Закрыть'}], in_progress: [{s:'closed',i:'fa-check',t:'Закрыть'}], closed: [{s:'reopened',i:'fa-redo',t:'Переоткрыть'}], reopened: [{s:'in_progress',i:'fa-wrench',t:'В работу'},{s:'closed',i:'fa-check',t:'Закрыть'}] },
    tests: { queued: [{s:'in_progress',i:'fa-play',t:'Начать'}], in_progress: [{s:'completed',i:'fa-check',t:'Результат'}] },
    protocols: { draft: [{s:'review',i:'fa-paper-plane',t:'На проверку'}], review: [{s:'issued',i:'fa-check',t:'Выдать'}] },
    leads: { new:[{s:'in_progress',i:'fa-arrow-right',t:'В работу'}], in_progress:[{s:'proposal_sent',i:'fa-paper-plane',t:'Отпр. КП'}], proposal_sent:[{s:'won',i:'fa-trophy',t:'Выиграна'},{s:'lost',i:'fa-times',t:'Проиграна'}] },
  };

  const actions = statusActions[tab] && statusActions[tab][row.status] || [];
  actions.forEach(function(a) {
    if (tab === 'tests' && a.s === 'completed') {
      html += '<span class="action-btn text-green-400" title="'+a.t+'" data-action="test-complete" data-id="'+row.id+'"><i class="fas '+a.i+'"></i></span>';
    } else if (tab === 'leads' && a.s === 'lost') {
      html += '<span class="action-btn text-red-400" title="'+a.t+'" data-action="lost-reason" data-id="'+row.id+'"><i class="fas '+a.i+'"></i></span>';
    } else {
      html += '<span class="action-btn text-blue-400" title="'+a.t+'" data-action="status" data-tab="'+tab+'" data-id="'+row.id+'" data-status="'+a.s+'"><i class="fas '+a.i+'"></i></span>';
    }
  });

  if (['objects','defects'].includes(tab) && row.status !== 'closed') {
    html += '<span class="action-btn text-slate-400" title="Редактировать" data-action="edit" data-tab="'+tab+'" data-id="'+row.id+'"><i class="fas fa-pen"></i></span>';
  }

  if (isAdmin()) {
    html += '<span class="action-btn text-red-400/50 hover:text-red-400" title="Удалить" data-action="delete" data-tab="'+tab+'" data-id="'+row.id+'"><i class="fas fa-trash"></i></span>';
  }

  html += '</div>';
  return html;
}

// ====== EVENT DELEGATION for action buttons ======
document.addEventListener('click', function(e) {
  var btn = e.target.closest('[data-action]');
  if (!btn) return;
  var action = btn.dataset.action;
  var id = Number(btn.dataset.id);
  var tab = btn.dataset.tab;
  var status = btn.dataset.status;

  if (action === 'status') changeStatus(tab, id, status);
  else if (action === 'edit') openEditModal(tab, id);
  else if (action === 'delete') deleteItem(tab, id);
  else if (action === 'test-complete') openTestCompleteModal(id);
  else if (action === 'lost-reason') openLostReasonModal(id);
});

function renderTable(tab, data) {
  if (!data || data.length === 0) return '<div class="text-center py-8 text-slate-500">Нет данных</div>';

  var RUB = '\u20BD';
  var tables = {
    objects: { cols: ['Объект','Адрес','Подрядчик','Инженер','Откр. замеч.','Срок',''], row: function(r) { return [
      r.name, '<span class="text-slate-500">'+(r.address||'')+'</span>', r.contractor_name||'\u2014', r.engineer_name||'\u2014',
      r.open_defects > 0 ? '<span class="text-red-400 font-semibold">'+r.open_defects+'</span>' : '<span class="text-green-400">0</span>',
      r.planned_end_date||'\u2014', actionBtns('objects', r)
    ]}},
    defects: { cols: ['Описание','Объект','Подрядчик','Кат.','Статус','Дедлайн',''], row: function(r) { return [
      '<div class="max-w-[200px] truncate">'+r.description+'</div>',
      '<span class="text-slate-400">'+(r.object_name||'')+'</span>', r.contractor_name||'\u2014',
      categoryBadge(r.category), statusBadge(r.status),
      r.deadline ? (new Date(r.deadline)<new Date() && r.status!=='closed' ? '<span class="text-red-400 font-semibold">'+r.deadline+'</span>' : r.deadline) : '\u2014',
      actionBtns('defects', r)
    ]}},
    tests: { cols: ['Материал','Вид','Объект','Инженер','Статус','Результат',''], row: function(r) { return [
      r.material_type, r.test_type, '<span class="text-slate-400">'+(r.object_name||'')+'</span>',
      r.engineer_name||'\u2014', statusBadge(r.status),
      r.result ? (r.result==='соответствует' ? '<span class="text-green-400">'+r.result+'</span>' : '<span class="text-red-400">'+r.result+'</span>') : '\u2014',
      actionBtns('tests', r)
    ]}},
    protocols: { cols: ['Номер','Тип','Объект','Инженер','Статус','Срок',''], row: function(r) { return [
      '<span class="font-mono text-xs">'+r.protocol_number+'</span>', r.protocol_type,
      '<span class="text-slate-400">'+(r.object_name||'')+'</span>', r.engineer_name||'\u2014',
      statusBadge(r.status),
      r.due_date ? (r.status==='overdue' ? '<span class="text-red-400 font-semibold">'+r.due_date+'</span>' : r.due_date) : '\u2014',
      actionBtns('protocols', r)
    ]}},
    repeats: { cols: ['Описание','Объект','Подрядчик','Кат.','Исходное','Дедлайн'], row: function(r) { return [
      '<div class="max-w-[180px] truncate">'+r.description+'</div>',
      '<span class="text-slate-400">'+(r.object_name||'')+'</span>',
      '<span class="text-orange-400">'+(r.contractor_name||'')+'</span>',
      categoryBadge(r.category),
      '<div class="max-w-[120px] truncate text-slate-500 text-xs">'+(r.original_description||'\u2014')+'</div>',
      r.deadline||'\u2014'
    ]}},
    leads: { cols: ['Компания','Услуга','Сумма','Источник','Статус','Дата',''], row: function(r) { return [
      '<div><div class="font-medium">'+r.company_name+'</div><div class="text-xs text-slate-500">'+(r.contact_person||'')+'</div></div>',
      r.service_type, '<span class="font-semibold">'+fmtMoney(r.estimated_value)+' '+RUB+'</span>',
      r.source||'\u2014', statusBadge(r.status), r.created_at ? r.created_at.split('T')[0] : '\u2014',
      actionBtns('leads', r)
    ]}},
  };

  var t = tables[tab];
  var html = '<div class="overflow-x-auto"><table class="w-full text-sm"><thead><tr class="border-b border-slate-700/30">';
  t.cols.forEach(function(c) { html += '<th class="text-left py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">'+c+'</th>'; });
  html += '</tr></thead><tbody>';
  data.forEach(function(r) { var cells = t.row(r); html += '<tr class="table-row border-b border-slate-800/30">'; cells.forEach(function(c) { html += '<td class="py-2.5 px-3">'+c+'</td>'; }); html += '</tr>'; });
  html += '</tbody></table></div>';
  html += '<div class="mt-3 text-xs text-slate-600 text-right">Всего: '+data.length+'</div>';
  return html;
}

// ====== STATUS CHANGES ======
async function changeStatus(tab, id, status) {
  var urlMap = {
    objects: '/api/crud/objects/'+id+'/status',
    defects: '/api/crud/defects/'+id+'/status',
    tests: '/api/crud/tests/'+id+'/status',
    protocols: '/api/crud/protocols/'+id+'/status',
    leads: '/api/crud/leads/'+id+'/status'
  };
  await apiCall('PATCH', urlMap[tab], { status: status });
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
  var html = '<div class="mb-3"><label class="block text-xs font-medium text-slate-400 mb-1">'+label+'</label>';
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
  var obj = {};
  document.querySelectorAll('#modalBody .input-field').forEach(function(el) {
    var val = el.value;
    if (el.type === 'number' && val) val = Number(val);
    if (val === '') val = null;
    obj[el.name] = val;
  });
  return obj;
}

// ====== CREATE MODALS ======
function openCreateModal() {
  var forms = {
    objects: function() {
      var html = fieldHtml('Название *','name','text','') +
        fieldHtml('Адрес','address','text','') +
        fieldHtml('Подрядчик','contractor_id','select','',selectOptions(refs.contractors,'id','name','')) +
        fieldHtml('Инженер','engineer_id','select','',selectOptions(refs.engineers,'id','name','')) +
        fieldHtml('Дата начала','start_date','date','') +
        fieldHtml('Плановое окончание','planned_end_date','date','');
      openModal('Новый объект', html, async function() {
        var d = getFormData();
        if (!d.name) { toast('Название обязательно','error'); return; }
        await apiCall('POST', '/api/crud/objects', d);
        toast('Объект создан','ok'); closeModal(); loadTabData(currentTab); loadData(); loadRefs();
      });
    },
    defects: function() {
      var html = fieldHtml('Объект *','object_id','select','',selectOptions(refs.objects,'id','name','')) +
        fieldHtml('Подрядчик','contractor_id','select','',selectOptions(refs.contractors,'id','name','')) +
        fieldHtml('Категория *','category','select','','<option value="критическое">Критическое</option><option value="значительное" selected>Значительное</option><option value="незначительное">Незначительное</option>') +
        fieldHtml('Описание *','description','textarea','') +
        fieldHtml('Дедлайн','deadline','date','');
      openModal('Новое замечание', html, async function() {
        var d = getFormData();
        if (!d.object_id || !d.category || !d.description) { toast('Заполните обязательные поля','error'); return; }
        await apiCall('POST', '/api/crud/defects', d);
        toast('Замечание создано','ok'); closeModal(); loadTabData(currentTab); loadData();
      });
    },
    tests: function() {
      var html = fieldHtml('Объект *','object_id','select','',selectOptions(refs.objects,'id','name','')) +
        fieldHtml('Тип материала *','material_type','select','','<option value="бетон">Бетон</option><option value="арматура">Арматура</option><option value="грунт">Грунт</option><option value="асфальт">Асфальт</option><option value="раствор">Раствор</option>') +
        fieldHtml('Вид испытания *','test_type','select','','<option value="прочность">Прочность</option><option value="морозостойкость">Морозостойкость</option><option value="водонепроницаемость">Водонепроницаемость</option>');
      openModal('Новое испытание', html, async function() {
        var d = getFormData();
        if (!d.object_id || !d.material_type || !d.test_type) { toast('Заполните все поля','error'); return; }
        await apiCall('POST', '/api/crud/tests', d);
        toast('Испытание поставлено в очередь','ok'); closeModal(); loadTabData(currentTab); loadData();
      });
    },
    protocols: function() {
      var html = fieldHtml('Объект *','object_id','select','',selectOptions(refs.objects,'id','name','')) +
        fieldHtml('Номер протокола *','protocol_number','text','') +
        fieldHtml('Тип *','protocol_type','select','','<option value="испытание">Испытание</option><option value="акт_осмотра">Акт осмотра</option><option value="заключение">Заключение</option><option value="предписание">Предписание</option>') +
        fieldHtml('Срок выдачи','due_date','date','');
      openModal('Новый протокол', html, async function() {
        var d = getFormData();
        if (!d.object_id || !d.protocol_number || !d.protocol_type) { toast('Заполните обязательные поля','error'); return; }
        await apiCall('POST', '/api/crud/protocols', d);
        toast('Протокол создан','ok'); closeModal(); loadTabData(currentTab); loadData();
      });
    },
    leads: function() {
      var html = fieldHtml('Компания *','company_name','text','') +
        fieldHtml('Контактное лицо','contact_person','text','') +
        fieldHtml('Телефон','phone','text','') +
        fieldHtml('Email','email','text','') +
        fieldHtml('Тип услуги *','service_type','select','','<option value="строительный_контроль">Строительный контроль</option><option value="экспертиза">Экспертиза</option><option value="лаборатория">Лаборатория</option><option value="комплекс">Комплекс</option>') +
        fieldHtml('Сумма (оценка)','estimated_value','number','') +
        fieldHtml('Источник','source','select','','<option value="сайт">Сайт</option><option value="рекомендация">Рекомендация</option><option value="тендер">Тендер</option><option value="повторный_клиент">Повторный клиент</option>');
      openModal('Новая заявка', html, async function() {
        var d = getFormData();
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
  var url;
  if (tab === 'objects') url = '/api/objects?status=active';
  else if (tab === 'defects') url = '/api/defects?status=open';
  else return;
  var data = await (await fetch(url)).json();
  var item = data.find(function(r) { return r.id === id; });
  if (!item) { toast('Запись не найдена','error'); return; }

  if (tab === 'objects') {
    var html = fieldHtml('Название *','name','text',item.name) +
      fieldHtml('Адрес','address','text',item.address||'') +
      fieldHtml('Подрядчик','contractor_id','select','',selectOptions(refs.contractors,'id','name',item.contractor_id)) +
      fieldHtml('Инженер','engineer_id','select','',selectOptions(refs.engineers,'id','name',item.engineer_id)) +
      fieldHtml('Дата начала','start_date','date',item.start_date||'') +
      fieldHtml('Плановое окончание','planned_end_date','date',item.planned_end_date||'');
    openModal('Редактирование объекта', html, async function() {
      var d = getFormData();
      if (!d.name) { toast('Название обязательно','error'); return; }
      await apiCall('PUT', '/api/crud/objects/'+id, d);
      toast('Объект обновлён','ok'); closeModal(); loadTabData(currentTab); loadRefs();
    });
  }

  if (tab === 'defects') {
    var catOpts = '<option value="критическое" '+(item.category==='критическое'?'selected':'')+'>Критическое</option>' +
      '<option value="значительное" '+(item.category==='значительное'?'selected':'')+'>Значительное</option>' +
      '<option value="незначительное" '+(item.category==='незначительное'?'selected':'')+'>Незначительное</option>';
    var html2 = fieldHtml('Категория','category','select','',catOpts) +
      fieldHtml('Описание','description','textarea',item.description||'') +
      fieldHtml('Подрядчик','contractor_id','select','',selectOptions(refs.contractors,'id','name',item.contractor_id)) +
      fieldHtml('Дедлайн','deadline','date',item.deadline||'');
    openModal('Редактирование замечания', html2, async function() {
      var d = getFormData();
      await apiCall('PUT', '/api/crud/defects/'+id, d);
      toast('Замечание обновлено','ok'); closeModal(); loadTabData(currentTab);
    });
  }
}

// ====== SPECIAL MODALS ======
function openTestCompleteModal(id) {
  var html = fieldHtml('Результат *','result','select','','<option value="соответствует">Соответствует</option><option value="не_соответствует">Не соответствует</option>') +
    fieldHtml('Номер протокола','protocol_number','text','');
  openModal('Результат испытания', html, async function() {
    var d = getFormData();
    if (!d.result) { toast('Укажите результат','error'); return; }
    d.status = 'completed';
    await apiCall('PATCH', '/api/crud/tests/'+id+'/status', d);
    toast('Испытание завершено','ok'); closeModal(); loadTabData(currentTab); loadData();
  });
}

function openLostReasonModal(id) {
  var html = fieldHtml('Причина проигрыша','lost_reason','select','','<option value="цена">Цена</option><option value="выбрали_другого">Выбрали другого</option><option value="бюджет">Бюджет отменён</option><option value="другое">Другое</option>');
  openModal('Причина проигрыша', html, async function() {
    var d = getFormData();
    d.status = 'lost';
    await apiCall('PATCH', '/api/crud/leads/'+id+'/status', d);
    toast('Статус обновлён','ok'); closeModal(); loadTabData(currentTab); loadData();
  });
}

// ====== DATA LOADING ======
async function loadData() {
  try {
    var resp = await fetch('/api/kpi/summary');
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
