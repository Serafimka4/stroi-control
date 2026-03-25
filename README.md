# СтройКонтроль — Панель руководителя

Дашборд ключевых показателей + система управления для компании строительной экспертизы и контроля качества стройматериалов.

## Функционал

### 8 KPI-карточек
| # | KPI | Формула |
|---|-----|---------|
| 1 | Объекты в работе | COUNT по статусу |
| 2 | Замечания открыто / закрыто | open + in_progress + reopened / closed |
| 3 | Средний срок закрытия | AVG(closed_at - opened_at) |
| 4 | Испытания в очереди | COUNT WHERE status='queued' |
| 5 | Протоколы просрочены | COUNT WHERE status='overdue' |
| 6 | Загрузка инженеров | current_objects / max_objects * 100 |
| 7 | Повторные несоответствия | COUNT WHERE is_repeat=1 GROUP BY contractor |
| 8 | Конверсия заявок | won / (won + lost) * 100 |

### Авторизация
- JWT-сессии (7 дней), хранение токена в httpOnly cookie + localStorage
- 3 роли: **admin**, **engineer**, **lab** (лаборант)
- Middleware проверки аутентификации на всех CRUD-маршрутах
- Ролевой доступ: admin может всё, engineer — объекты/замечания/испытания/протоколы, lab — испытания/протоколы

### CRUD-операции
| Сущность | Создание | Редактирование | Статусы | Удаление |
|----------|----------|---------------|---------|----------|
| Объекты | admin, engineer | admin, engineer | active -> paused/completed | admin |
| Замечания | admin, engineer | admin, engineer | open -> in_progress -> closed / reopened | admin |
| Испытания | admin, engineer, lab | — | queued -> in_progress -> completed/failed | admin |
| Протоколы | admin, engineer, lab | — | draft -> review -> issued | admin |
| Заявки | admin | — | new -> in_progress -> proposal_sent -> won/lost | admin |
| Подрядчики | admin | admin | — | admin |

### Тестовые аккаунты
| Логин | Пароль | Роль | Имя |
|-------|--------|------|-----|
| admin | 123456 | admin | Директор |
| kozlov | 123456 | engineer | Козлов А.В. |
| petrova | 123456 | engineer | Петрова Е.М. |
| sidorov | 123456 | lab | Сидоров Д.И. |
| novikova | 123456 | engineer | Новикова О.С. |
| morozova | 123456 | lab | Морозова Н.А. |

## Технологии
- **Backend**: Hono (TypeScript) на Cloudflare Workers
- **Database**: Cloudflare D1 (SQLite)
- **Frontend**: Tailwind CSS + Chart.js + FontAwesome
- **Auth**: SHA-256 хеширование + сессии в D1

## API-эндпоинты

### Публичные (read-only)
| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/api/kpi/summary` | Все 8 KPI одним запросом |
| GET | `/api/objects?status=active` | Объекты по статусу |
| GET | `/api/defects?status=open` | Замечания |
| GET | `/api/tests` | Испытания |
| GET | `/api/protocols` | Протоколы |
| GET | `/api/leads` | Заявки |
| GET | `/api/repeats` | Повторные несоответствия |

### Авторизация
| Метод | Путь | Описание |
|-------|------|----------|
| POST | `/api/auth/login` | Вход (login, password) |
| POST | `/api/auth/logout` | Выход |
| GET | `/api/auth/me` | Текущий пользователь |

### CRUD (требуют авторизации)
| Метод | Путь | Роли |
|-------|------|------|
| GET | `/api/crud/ref/engineers` | все |
| GET | `/api/crud/ref/contractors` | все |
| GET | `/api/crud/ref/objects-list` | все |
| POST | `/api/crud/objects` | admin, engineer |
| PUT | `/api/crud/objects/:id` | admin, engineer |
| PATCH | `/api/crud/objects/:id/status` | admin, engineer |
| DELETE | `/api/crud/objects/:id` | admin |
| POST | `/api/crud/defects` | admin, engineer |
| PUT | `/api/crud/defects/:id` | admin, engineer |
| PATCH | `/api/crud/defects/:id/status` | admin, engineer |
| DELETE | `/api/crud/defects/:id` | admin |
| POST | `/api/crud/tests` | admin, engineer, lab |
| PATCH | `/api/crud/tests/:id/status` | admin, lab |
| DELETE | `/api/crud/tests/:id` | admin |
| POST | `/api/crud/protocols` | admin, engineer, lab |
| PATCH | `/api/crud/protocols/:id/status` | admin, engineer, lab |
| DELETE | `/api/crud/protocols/:id` | admin |
| POST | `/api/crud/leads` | admin |
| PATCH | `/api/crud/leads/:id/status` | admin |
| DELETE | `/api/crud/leads/:id` | admin |

## Запуск

```bash
npm install
npm run build
npx wrangler d1 migrations apply webapp-production --local
npx wrangler d1 execute webapp-production --local --file=./seed.sql
npx wrangler d1 execute webapp-production --local --file=./seed_users.sql
npx wrangler pages dev dist --d1=webapp-production --local --port 3000
```

## Структура проекта

```
webapp/
├── src/
│   ├── index.tsx              # Точка входа
│   └── routes/
│       ├── api.ts             # KPI-эндпоинты (read-only)
│       ├── auth.ts            # Login/logout/me + middleware
│       ├── crud.ts            # CRUD все сущности
│       └── dashboard.ts       # HTML (login + main page)
├── migrations/
│   ├── 0001_initial_schema.sql
│   └── 0002_users_sessions.sql
├── seed.sql                   # Тестовые данные
├── seed_users.sql             # Тестовые пользователи
├── wrangler.jsonc
└── ecosystem.config.cjs
```

## Следующие шаги
- [ ] Фильтрация по периоду в дашборде
- [ ] Push-уведомления о просрочках
- [ ] Экспорт в Excel
- [ ] Мобильное PWA
- [ ] Аудит-лог действий пользователей
