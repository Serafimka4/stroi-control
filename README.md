# СтройКонтроль — Панель руководителя

Дашборд ключевых показателей для руководителя компании строительной экспертизы и контроля качества стройматериалов.

## 8 ключевых KPI

| # | KPI | Описание | Формула |
|---|-----|----------|---------|
| 1 | **Объекты в работе** | Активные / приостановленные / завершённые | COUNT по статусу |
| 2 | **Замечания открыто / закрыто** | Текущие несоответствия по всем объектам | open + in_progress + reopened / closed |
| 3 | **Средний срок закрытия** | Дней от открытия до закрытия замечания | AVG(closed_at - opened_at) |
| 4 | **Испытания в очереди** | Лабораторные испытания ожидающие проведения | COUNT WHERE status='queued' |
| 5 | **Протоколы просрочены** | Документы с нарушенными сроками выдачи | COUNT WHERE status='overdue' |
| 6 | **Загрузка инженеров** | Средний % загрузки от максимума | current_objects / max_objects * 100 |
| 7 | **Повторные несоответствия** | Замечания по подрядчикам, устранённые некачественно | COUNT WHERE is_repeat=1 GROUP BY contractor |
| 8 | **Конверсия заявок** | % заявок, ставших договорами | won / (won + lost) * 100 |

## Технологии

- **Backend**: Hono (TypeScript) на Cloudflare Workers
- **Database**: Cloudflare D1 (SQLite)
- **Frontend**: Tailwind CSS + Chart.js + FontAwesome
- **Deployment**: Cloudflare Pages

## API-эндпоинты

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/api/kpi/summary` | Все 8 KPI одним запросом |
| GET | `/api/objects?status=active` | Детализация по объектам |
| GET | `/api/defects?status=open` | Замечания (open/closed/all) |
| GET | `/api/tests` | Все испытания |
| GET | `/api/protocols` | Все протоколы |
| GET | `/api/leads` | Все заявки |
| GET | `/api/repeats` | Повторные несоответствия |

## Модели данных

- **engineers** — инженеры компании (7 записей)
- **contractors** — подрядчики (6 записей)
- **objects** — строительные объекты (12 записей)
- **defects** — замечания / несоответствия (28 записей)
- **tests** — лабораторные испытания (18 записей)
- **protocols** — протоколы и документы (15 записей)
- **leads** — заявки и лиды (15 записей)

## Запуск локально

```bash
npm install
npm run build
npx wrangler d1 migrations apply webapp-production --local
npx wrangler d1 execute webapp-production --local --file=./seed.sql
npx wrangler pages dev dist --d1=webapp-production --local --port 3000
```

## Структура проекта

```
webapp/
├── src/
│   ├── index.tsx           # Точка входа Hono
│   └── routes/
│       ├── api.ts          # API-эндпоинты (8 KPI + детализация)
│       └── dashboard.ts    # HTML-страница дашборда
├── migrations/
│   └── 0001_initial_schema.sql  # Схема БД
├── seed.sql                # Тестовые данные
├── wrangler.jsonc          # Конфигурация Cloudflare
├── ecosystem.config.cjs    # PM2-конфигурация
└── vite.config.ts          # Сборка
```

## Следующие шаги

- [ ] CRUD для объектов, замечаний, испытаний
- [ ] Авторизация (роли: руководитель / инженер / лаборант)
- [ ] Фильтрация по периоду в дашборде
- [ ] Push-уведомления о просрочках
- [ ] Экспорт в Excel
- [ ] Мобильное PWA
