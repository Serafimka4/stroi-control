-- ============================================
-- СТРОЙКОНТРОЛЬ: Схема базы данных
-- ============================================

-- Инженеры компании
CREATE TABLE IF NOT EXISTS engineers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  specialization TEXT NOT NULL, -- 'лаборатория' | 'строительный_контроль' | 'экспертиза'
  max_objects INTEGER DEFAULT 5,
  active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Подрядчики
CREATE TABLE IF NOT EXISTS contractors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  inn TEXT,
  contact_person TEXT,
  phone TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Объекты строительства
CREATE TABLE IF NOT EXISTS objects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  address TEXT,
  contractor_id INTEGER,
  engineer_id INTEGER,
  status TEXT NOT NULL DEFAULT 'active', -- 'active' | 'paused' | 'completed'
  start_date DATE,
  planned_end_date DATE,
  actual_end_date DATE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (contractor_id) REFERENCES contractors(id),
  FOREIGN KEY (engineer_id) REFERENCES engineers(id)
);

-- Замечания (несоответствия)
CREATE TABLE IF NOT EXISTS defects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  object_id INTEGER NOT NULL,
  contractor_id INTEGER,
  engineer_id INTEGER,
  category TEXT NOT NULL, -- 'критическое' | 'значительное' | 'незначительное'
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open', -- 'open' | 'in_progress' | 'closed' | 'reopened'
  is_repeat INTEGER DEFAULT 0, -- повторное несоответствие
  parent_defect_id INTEGER, -- ссылка на первоначальное замечание
  opened_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  deadline DATE,
  closed_at DATETIME,
  FOREIGN KEY (object_id) REFERENCES objects(id),
  FOREIGN KEY (contractor_id) REFERENCES contractors(id),
  FOREIGN KEY (engineer_id) REFERENCES engineers(id),
  FOREIGN KEY (parent_defect_id) REFERENCES defects(id)
);

-- Испытания (лабораторные)
CREATE TABLE IF NOT EXISTS tests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  object_id INTEGER NOT NULL,
  engineer_id INTEGER,
  material_type TEXT NOT NULL, -- 'бетон' | 'арматура' | 'грунт' | 'асфальт' | 'раствор'
  test_type TEXT NOT NULL, -- 'прочность' | 'морозостойкость' | 'водонепроницаемость' etc.
  status TEXT NOT NULL DEFAULT 'queued', -- 'queued' | 'in_progress' | 'completed' | 'failed'
  queued_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  started_at DATETIME,
  completed_at DATETIME,
  result TEXT, -- 'соответствует' | 'не_соответствует'
  protocol_number TEXT,
  FOREIGN KEY (object_id) REFERENCES objects(id),
  FOREIGN KEY (engineer_id) REFERENCES engineers(id)
);

-- Протоколы (документы)
CREATE TABLE IF NOT EXISTS protocols (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  object_id INTEGER NOT NULL,
  test_id INTEGER,
  engineer_id INTEGER,
  protocol_number TEXT NOT NULL,
  protocol_type TEXT NOT NULL, -- 'испытание' | 'акт_осмотра' | 'заключение' | 'предписание'
  status TEXT NOT NULL DEFAULT 'draft', -- 'draft' | 'review' | 'issued' | 'overdue'
  due_date DATE,
  issued_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (object_id) REFERENCES objects(id),
  FOREIGN KEY (test_id) REFERENCES tests(id),
  FOREIGN KEY (engineer_id) REFERENCES engineers(id)
);

-- Заявки (лиды -> договоры)
CREATE TABLE IF NOT EXISTS leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_name TEXT NOT NULL,
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  service_type TEXT NOT NULL, -- 'строительный_контроль' | 'экспертиза' | 'лаборатория' | 'комплекс'
  estimated_value REAL,
  status TEXT NOT NULL DEFAULT 'new', -- 'new' | 'in_progress' | 'proposal_sent' | 'won' | 'lost'
  source TEXT, -- 'сайт' | 'рекомендация' | 'тендер' | 'повторный_клиент'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  converted_at DATETIME,
  lost_reason TEXT
);

-- Индексы
CREATE INDEX IF NOT EXISTS idx_objects_status ON objects(status);
CREATE INDEX IF NOT EXISTS idx_objects_engineer ON objects(engineer_id);
CREATE INDEX IF NOT EXISTS idx_defects_status ON defects(status);
CREATE INDEX IF NOT EXISTS idx_defects_object ON defects(object_id);
CREATE INDEX IF NOT EXISTS idx_defects_contractor ON defects(contractor_id);
CREATE INDEX IF NOT EXISTS idx_tests_status ON tests(status);
CREATE INDEX IF NOT EXISTS idx_protocols_status ON protocols(status);
CREATE INDEX IF NOT EXISTS idx_protocols_due ON protocols(due_date);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
