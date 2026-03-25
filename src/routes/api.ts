import { Hono } from 'hono'

type Bindings = { DB: D1Database }

export const api = new Hono<{ Bindings: Bindings }>()

// ============================================
// СВОДКА ВСЕХ KPI ОДНИМ ЗАПРОСОМ
// ============================================
api.get('/kpi/summary', async (c) => {
  const db = c.env.DB

  // 1. Объекты в работе
  const objectsResult = await db.prepare(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status='active' THEN 1 ELSE 0 END) as active,
      SUM(CASE WHEN status='paused' THEN 1 ELSE 0 END) as paused,
      SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) as completed
    FROM objects
  `).first()

  // 2. Замечания открыто/закрыто
  const defectsResult = await db.prepare(`
    SELECT 
      SUM(CASE WHEN status IN ('open','in_progress','reopened') THEN 1 ELSE 0 END) as open_count,
      SUM(CASE WHEN status='closed' THEN 1 ELSE 0 END) as closed_count,
      COUNT(*) as total
    FROM defects
  `).first()

  // 3. Средний срок закрытия замечаний (дни)
  const avgCloseResult = await db.prepare(`
    SELECT 
      ROUND(AVG(julianday(closed_at) - julianday(opened_at)), 1) as avg_days
    FROM defects 
    WHERE status='closed' AND closed_at IS NOT NULL
  `).first()

  // 4. Испытания в очереди
  const testsQueueResult = await db.prepare(`
    SELECT 
      SUM(CASE WHEN status='queued' THEN 1 ELSE 0 END) as queued,
      SUM(CASE WHEN status='in_progress' THEN 1 ELSE 0 END) as in_progress,
      SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) as completed,
      SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) as failed,
      COUNT(*) as total
    FROM tests
  `).first()

  // 5. Просроченные протоколы
  const protocolsResult = await db.prepare(`
    SELECT 
      SUM(CASE WHEN status='overdue' THEN 1 ELSE 0 END) as overdue,
      SUM(CASE WHEN status='draft' THEN 1 ELSE 0 END) as draft,
      SUM(CASE WHEN status='review' THEN 1 ELSE 0 END) as review,
      SUM(CASE WHEN status='issued' THEN 1 ELSE 0 END) as issued,
      COUNT(*) as total
    FROM protocols
  `).first()

  // 6. Загрузка инженеров
  const engineerLoadResult = await db.prepare(`
    SELECT 
      e.id, e.name, e.specialization, e.max_objects,
      COUNT(o.id) as current_objects,
      ROUND(COUNT(o.id) * 100.0 / e.max_objects, 0) as load_percent
    FROM engineers e
    LEFT JOIN objects o ON o.engineer_id = e.id AND o.status = 'active'
    WHERE e.active = 1
    GROUP BY e.id
    ORDER BY load_percent DESC
  `).all()

  const avgLoad = engineerLoadResult.results.length > 0
    ? Math.round(
        engineerLoadResult.results.reduce((sum: number, e: any) => sum + (e.load_percent || 0), 0) 
        / engineerLoadResult.results.length
      )
    : 0

  // 7. Повторные несоответствия по подрядчикам
  const repeatResult = await db.prepare(`
    SELECT 
      c.name as contractor_name,
      COUNT(*) as repeat_count,
      SUM(CASE WHEN d.category='критическое' THEN 1 ELSE 0 END) as critical_repeats
    FROM defects d
    JOIN contractors c ON c.id = d.contractor_id
    WHERE d.is_repeat = 1
    GROUP BY d.contractor_id
    ORDER BY repeat_count DESC
  `).all()

  const totalRepeats = repeatResult.results.reduce((s: number, r: any) => s + r.repeat_count, 0)

  // 8. Конверсия заявок в договоры
  const leadsResult = await db.prepare(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status='new' THEN 1 ELSE 0 END) as new_count,
      SUM(CASE WHEN status='in_progress' THEN 1 ELSE 0 END) as in_progress,
      SUM(CASE WHEN status='proposal_sent' THEN 1 ELSE 0 END) as proposal_sent,
      SUM(CASE WHEN status='won' THEN 1 ELSE 0 END) as won,
      SUM(CASE WHEN status='lost' THEN 1 ELSE 0 END) as lost,
      SUM(CASE WHEN status='won' THEN estimated_value ELSE 0 END) as won_value,
      SUM(CASE WHEN status IN ('won','lost') THEN 1 ELSE 0 END) as decided
    FROM leads
  `).first()

  const conversionRate = leadsResult && (leadsResult as any).decided > 0
    ? Math.round(((leadsResult as any).won / (leadsResult as any).decided) * 100)
    : 0

  // Критические замечания с просрочкой
  const criticalOverdue = await db.prepare(`
    SELECT COUNT(*) as count FROM defects 
    WHERE status IN ('open','reopened') 
    AND category='критическое' 
    AND deadline < date('now')
  `).first()

  return c.json({
    timestamp: new Date().toISOString(),
    kpi: {
      objects: {
        active: (objectsResult as any)?.active || 0,
        paused: (objectsResult as any)?.paused || 0,
        completed: (objectsResult as any)?.completed || 0,
        total: (objectsResult as any)?.total || 0,
      },
      defects: {
        open: (defectsResult as any)?.open_count || 0,
        closed: (defectsResult as any)?.closed_count || 0,
        total: (defectsResult as any)?.total || 0,
        avg_close_days: (avgCloseResult as any)?.avg_days || 0,
        critical_overdue: (criticalOverdue as any)?.count || 0,
      },
      tests: {
        queued: (testsQueueResult as any)?.queued || 0,
        in_progress: (testsQueueResult as any)?.in_progress || 0,
        completed: (testsQueueResult as any)?.completed || 0,
        failed: (testsQueueResult as any)?.failed || 0,
        total: (testsQueueResult as any)?.total || 0,
      },
      protocols: {
        overdue: (protocolsResult as any)?.overdue || 0,
        draft: (protocolsResult as any)?.draft || 0,
        review: (protocolsResult as any)?.review || 0,
        issued: (protocolsResult as any)?.issued || 0,
        total: (protocolsResult as any)?.total || 0,
      },
      engineers: {
        avg_load_percent: avgLoad,
        details: engineerLoadResult.results,
      },
      repeats: {
        total: totalRepeats,
        by_contractor: repeatResult.results,
      },
      leads: {
        total: (leadsResult as any)?.total || 0,
        new_count: (leadsResult as any)?.new_count || 0,
        in_progress: (leadsResult as any)?.in_progress || 0,
        proposal_sent: (leadsResult as any)?.proposal_sent || 0,
        won: (leadsResult as any)?.won || 0,
        lost: (leadsResult as any)?.lost || 0,
        won_value: (leadsResult as any)?.won_value || 0,
        conversion_rate: conversionRate,
      },
    }
  })
})

// ============================================
// ДЕТАЛИЗАЦИЯ: Объекты
// ============================================
api.get('/objects', async (c) => {
  const db = c.env.DB
  const status = c.req.query('status') || 'active'
  
  const result = await db.prepare(`
    SELECT o.*, c.name as contractor_name, e.name as engineer_name,
      (SELECT COUNT(*) FROM defects d WHERE d.object_id=o.id AND d.status IN ('open','in_progress','reopened')) as open_defects
    FROM objects o
    LEFT JOIN contractors c ON c.id = o.contractor_id
    LEFT JOIN engineers e ON e.id = o.engineer_id
    WHERE o.status = ?
    ORDER BY o.start_date DESC
  `).bind(status).all()
  
  return c.json(result.results)
})

// ============================================
// ДЕТАЛИЗАЦИЯ: Замечания
// ============================================
api.get('/defects', async (c) => {
  const db = c.env.DB
  const status = c.req.query('status') // 'open' | 'closed' | 'all'
  
  let where = ''
  if (status === 'open') where = "WHERE d.status IN ('open','in_progress','reopened')"
  else if (status === 'closed') where = "WHERE d.status = 'closed'"
  
  const result = await db.prepare(`
    SELECT d.*, o.name as object_name, c.name as contractor_name, e.name as engineer_name
    FROM defects d
    LEFT JOIN objects o ON o.id = d.object_id
    LEFT JOIN contractors c ON c.id = d.contractor_id
    LEFT JOIN engineers e ON e.id = d.engineer_id
    ${where}
    ORDER BY d.opened_at DESC
  `).all()
  
  return c.json(result.results)
})

// ============================================
// ДЕТАЛИЗАЦИЯ: Испытания
// ============================================
api.get('/tests', async (c) => {
  const db = c.env.DB
  
  const result = await db.prepare(`
    SELECT t.*, o.name as object_name, e.name as engineer_name
    FROM tests t
    LEFT JOIN objects o ON o.id = t.object_id
    LEFT JOIN engineers e ON e.id = t.engineer_id
    ORDER BY 
      CASE t.status 
        WHEN 'queued' THEN 1 
        WHEN 'in_progress' THEN 2 
        WHEN 'completed' THEN 3 
        WHEN 'failed' THEN 4 
      END,
      t.queued_at DESC
  `).all()
  
  return c.json(result.results)
})

// ============================================
// ДЕТАЛИЗАЦИЯ: Протоколы
// ============================================
api.get('/protocols', async (c) => {
  const db = c.env.DB
  
  const result = await db.prepare(`
    SELECT p.*, o.name as object_name, e.name as engineer_name
    FROM protocols p
    LEFT JOIN objects o ON o.id = p.object_id
    LEFT JOIN engineers e ON e.id = p.engineer_id
    ORDER BY 
      CASE p.status 
        WHEN 'overdue' THEN 1 
        WHEN 'review' THEN 2 
        WHEN 'draft' THEN 3 
        WHEN 'issued' THEN 4 
      END,
      p.due_date ASC
  `).all()
  
  return c.json(result.results)
})

// ============================================
// ДЕТАЛИЗАЦИЯ: Заявки
// ============================================
api.get('/leads', async (c) => {
  const db = c.env.DB
  
  const result = await db.prepare(`
    SELECT * FROM leads
    ORDER BY 
      CASE status 
        WHEN 'new' THEN 1 
        WHEN 'in_progress' THEN 2 
        WHEN 'proposal_sent' THEN 3 
        WHEN 'won' THEN 4 
        WHEN 'lost' THEN 5 
      END,
      created_at DESC
  `).all()
  
  return c.json(result.results)
})

// ============================================
// ДЕТАЛИЗАЦИЯ: Повторные несоответствия
// ============================================
api.get('/repeats', async (c) => {
  const db = c.env.DB
  
  const result = await db.prepare(`
    SELECT d.*, o.name as object_name, c.name as contractor_name, e.name as engineer_name,
      pd.description as original_description
    FROM defects d
    LEFT JOIN objects o ON o.id = d.object_id
    LEFT JOIN contractors c ON c.id = d.contractor_id
    LEFT JOIN engineers e ON e.id = d.engineer_id
    LEFT JOIN defects pd ON pd.id = d.parent_defect_id
    WHERE d.is_repeat = 1
    ORDER BY d.opened_at DESC
  `).all()
  
  return c.json(result.results)
})
