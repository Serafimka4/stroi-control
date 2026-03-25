import { Hono } from 'hono'
import { authMiddleware, requireRole } from './auth'

type Bindings = { DB: D1Database }
type Variables = { user: any }
type Env = { Bindings: Bindings; Variables: Variables }

export const crud = new Hono<Env>()

// All CRUD routes require authentication
crud.use('*', authMiddleware)

// ============================================
// СПРАВОЧНИКИ (для выпадающих списков)
// ============================================
crud.get('/ref/engineers', async (c) => {
  const r = await c.env.DB.prepare('SELECT id, name, specialization FROM engineers WHERE active=1 ORDER BY name').all()
  return c.json(r.results)
})

crud.get('/ref/contractors', async (c) => {
  const r = await c.env.DB.prepare('SELECT id, name FROM contractors ORDER BY name').all()
  return c.json(r.results)
})

crud.get('/ref/objects-list', async (c) => {
  const r = await c.env.DB.prepare("SELECT id, name FROM objects WHERE status IN ('active','paused') ORDER BY name").all()
  return c.json(r.results)
})

// ============================================
// CRUD: ОБЪЕКТЫ
// ============================================

// Создать объект — admin, engineer
crud.post('/objects', requireRole('admin', 'engineer'), async (c) => {
  const db = c.env.DB
  const body = await c.req.json()
  const { name, address, contractor_id, engineer_id, start_date, planned_end_date } = body

  if (!name) return c.json({ error: 'Название обязательно' }, 400)

  const r = await db.prepare(`
    INSERT INTO objects (name, address, contractor_id, engineer_id, status, start_date, planned_end_date)
    VALUES (?, ?, ?, ?, 'active', ?, ?)
  `).bind(name, address || null, contractor_id || null, engineer_id || null, start_date || null, planned_end_date || null).run()

  return c.json({ ok: true, id: r.meta.last_row_id })
})

// Обновить объект
crud.put('/objects/:id', requireRole('admin', 'engineer'), async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  const body = await c.req.json()
  const { name, address, contractor_id, engineer_id, start_date, planned_end_date } = body

  await db.prepare(`
    UPDATE objects SET name=?, address=?, contractor_id=?, engineer_id=?, start_date=?, planned_end_date=?
    WHERE id=?
  `).bind(name, address || null, contractor_id || null, engineer_id || null, start_date || null, planned_end_date || null, id).run()

  return c.json({ ok: true })
})

// Сменить статус объекта
crud.patch('/objects/:id/status', requireRole('admin', 'engineer'), async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  const { status } = await c.req.json()
  
  if (!['active', 'paused', 'completed'].includes(status)) {
    return c.json({ error: 'Invalid status' }, 400)
  }

  const updates = status === 'completed' 
    ? `status=?, actual_end_date=datetime('now')` 
    : `status=?`
  
  await db.prepare(`UPDATE objects SET ${updates} WHERE id=?`).bind(status, id).run()
  return c.json({ ok: true })
})

// Удалить объект — только admin
crud.delete('/objects/:id', requireRole('admin'), async (c) => {
  const id = c.req.param('id')
  await c.env.DB.prepare('DELETE FROM objects WHERE id=?').bind(id).run()
  return c.json({ ok: true })
})

// ============================================
// CRUD: ЗАМЕЧАНИЯ
// ============================================

// Создать замечание
crud.post('/defects', requireRole('admin', 'engineer'), async (c) => {
  const db = c.env.DB
  const user = c.get('user')
  const body = await c.req.json()
  const { object_id, contractor_id, category, description, deadline, is_repeat, parent_defect_id } = body

  if (!object_id || !category || !description) {
    return c.json({ error: 'object_id, category, description обязательны' }, 400)
  }

  const engineer_id = user.engineer_id || body.engineer_id

  const r = await db.prepare(`
    INSERT INTO defects (object_id, contractor_id, engineer_id, category, description, status, is_repeat, parent_defect_id, deadline)
    VALUES (?, ?, ?, ?, ?, 'open', ?, ?, ?)
  `).bind(
    object_id, contractor_id || null, engineer_id || null,
    category, description, is_repeat ? 1 : 0, parent_defect_id || null, deadline || null
  ).run()

  return c.json({ ok: true, id: r.meta.last_row_id })
})

// Обновить замечание
crud.put('/defects/:id', requireRole('admin', 'engineer'), async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  const body = await c.req.json()
  const { category, description, deadline, contractor_id } = body

  await db.prepare(`
    UPDATE defects SET category=COALESCE(?,category), description=COALESCE(?,description), 
    deadline=COALESCE(?,deadline), contractor_id=COALESCE(?,contractor_id) WHERE id=?
  `).bind(category||null, description||null, deadline||null, contractor_id||null, id).run()

  return c.json({ ok: true })
})

// Сменить статус замечания
crud.patch('/defects/:id/status', requireRole('admin', 'engineer'), async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  const { status } = await c.req.json()

  if (!['open', 'in_progress', 'closed', 'reopened'].includes(status)) {
    return c.json({ error: 'Invalid status' }, 400)
  }

  let sql = 'UPDATE defects SET status=?'
  if (status === 'closed') sql += ", closed_at=datetime('now')"
  if (status === 'reopened') sql += ', is_repeat=1, closed_at=NULL'
  sql += ' WHERE id=?'
  
  await db.prepare(sql).bind(status, id).run()
  return c.json({ ok: true })
})

crud.delete('/defects/:id', requireRole('admin'), async (c) => {
  await c.env.DB.prepare('DELETE FROM defects WHERE id=?').bind(c.req.param('id')).run()
  return c.json({ ok: true })
})

// ============================================
// CRUD: ИСПЫТАНИЯ
// ============================================

// Создать испытание (поставить в очередь)
crud.post('/tests', requireRole('admin', 'engineer', 'lab'), async (c) => {
  const db = c.env.DB
  const user = c.get('user')
  const body = await c.req.json()
  const { object_id, material_type, test_type } = body

  if (!object_id || !material_type || !test_type) {
    return c.json({ error: 'object_id, material_type, test_type обязательны' }, 400)
  }

  const engineer_id = user.engineer_id || body.engineer_id

  const r = await db.prepare(`
    INSERT INTO tests (object_id, engineer_id, material_type, test_type, status)
    VALUES (?, ?, ?, ?, 'queued')
  `).bind(object_id, engineer_id || null, material_type, test_type).run()

  return c.json({ ok: true, id: r.meta.last_row_id })
})

// Сменить статус испытания
crud.patch('/tests/:id/status', requireRole('admin', 'lab'), async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  const { status, result, protocol_number } = await c.req.json()

  if (!['queued', 'in_progress', 'completed', 'failed'].includes(status)) {
    return c.json({ error: 'Invalid status' }, 400)
  }

  let sql = 'UPDATE tests SET status=?'
  const binds: any[] = [status]

  if (status === 'in_progress') { sql += ", started_at=datetime('now')"; }
  if (status === 'completed' || status === 'failed') {
    sql += ", completed_at=datetime('now')"
    if (result) { sql += ', result=?'; binds.push(result) }
    if (protocol_number) { sql += ', protocol_number=?'; binds.push(protocol_number) }
  }
  sql += ' WHERE id=?'
  binds.push(id)

  await db.prepare(sql).bind(...binds).run()
  return c.json({ ok: true })
})

crud.delete('/tests/:id', requireRole('admin'), async (c) => {
  await c.env.DB.prepare('DELETE FROM tests WHERE id=?').bind(c.req.param('id')).run()
  return c.json({ ok: true })
})

// ============================================
// CRUD: ПРОТОКОЛЫ
// ============================================

crud.post('/protocols', requireRole('admin', 'engineer', 'lab'), async (c) => {
  const db = c.env.DB
  const user = c.get('user')
  const body = await c.req.json()
  const { object_id, test_id, protocol_number, protocol_type, due_date } = body

  if (!object_id || !protocol_number || !protocol_type) {
    return c.json({ error: 'object_id, protocol_number, protocol_type обязательны' }, 400)
  }

  const engineer_id = user.engineer_id || body.engineer_id

  const r = await db.prepare(`
    INSERT INTO protocols (object_id, test_id, engineer_id, protocol_number, protocol_type, status, due_date)
    VALUES (?, ?, ?, ?, ?, 'draft', ?)
  `).bind(object_id, test_id || null, engineer_id || null, protocol_number, protocol_type, due_date || null).run()

  return c.json({ ok: true, id: r.meta.last_row_id })
})

// Сменить статус протокола
crud.patch('/protocols/:id/status', requireRole('admin', 'engineer', 'lab'), async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  const { status } = await c.req.json()

  if (!['draft', 'review', 'issued', 'overdue'].includes(status)) {
    return c.json({ error: 'Invalid status' }, 400)
  }

  let sql = 'UPDATE protocols SET status=?'
  if (status === 'issued') sql += ", issued_at=datetime('now')"
  sql += ' WHERE id=?'

  await db.prepare(sql).bind(status, id).run()
  return c.json({ ok: true })
})

crud.delete('/protocols/:id', requireRole('admin'), async (c) => {
  await c.env.DB.prepare('DELETE FROM protocols WHERE id=?').bind(c.req.param('id')).run()
  return c.json({ ok: true })
})

// ============================================
// CRUD: ЗАЯВКИ (LEADS)
// ============================================

crud.post('/leads', requireRole('admin'), async (c) => {
  const db = c.env.DB
  const body = await c.req.json()
  const { company_name, contact_person, phone, email, service_type, estimated_value, source } = body

  if (!company_name || !service_type) {
    return c.json({ error: 'company_name, service_type обязательны' }, 400)
  }

  const r = await db.prepare(`
    INSERT INTO leads (company_name, contact_person, phone, email, service_type, estimated_value, status, source)
    VALUES (?, ?, ?, ?, ?, ?, 'new', ?)
  `).bind(company_name, contact_person||null, phone||null, email||null, service_type, estimated_value||null, source||null).run()

  return c.json({ ok: true, id: r.meta.last_row_id })
})

// Сменить статус заявки
crud.patch('/leads/:id/status', requireRole('admin'), async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  const { status, lost_reason } = await c.req.json()

  if (!['new', 'in_progress', 'proposal_sent', 'won', 'lost'].includes(status)) {
    return c.json({ error: 'Invalid status' }, 400)
  }

  let sql = 'UPDATE leads SET status=?'
  const binds: any[] = [status]
  if (status === 'won') { sql += ", converted_at=datetime('now')"; }
  if (status === 'lost' && lost_reason) { sql += ', lost_reason=?'; binds.push(lost_reason) }
  sql += ' WHERE id=?'
  binds.push(id)

  await db.prepare(sql).bind(...binds).run()
  return c.json({ ok: true })
})

crud.delete('/leads/:id', requireRole('admin'), async (c) => {
  await c.env.DB.prepare('DELETE FROM leads WHERE id=?').bind(c.req.param('id')).run()
  return c.json({ ok: true })
})

// ============================================
// CRUD: ПОДРЯДЧИКИ
// ============================================

crud.post('/contractors', requireRole('admin'), async (c) => {
  const db = c.env.DB
  const { name, inn, contact_person, phone } = await c.req.json()
  if (!name) return c.json({ error: 'Название обязательно' }, 400)
  const r = await db.prepare('INSERT INTO contractors (name, inn, contact_person, phone) VALUES (?,?,?,?)')
    .bind(name, inn||null, contact_person||null, phone||null).run()
  return c.json({ ok: true, id: r.meta.last_row_id })
})

crud.put('/contractors/:id', requireRole('admin'), async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  const { name, inn, contact_person, phone } = await c.req.json()
  await db.prepare('UPDATE contractors SET name=?, inn=?, contact_person=?, phone=? WHERE id=?')
    .bind(name, inn||null, contact_person||null, phone||null, id).run()
  return c.json({ ok: true })
})

crud.delete('/contractors/:id', requireRole('admin'), async (c) => {
  await c.env.DB.prepare('DELETE FROM contractors WHERE id=?').bind(c.req.param('id')).run()
  return c.json({ ok: true })
})
