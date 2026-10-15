# FE/BE gap matrix — ручной triage (EliteEW)

Living companion to auto-generated [`FE-BE-GAP-MATRIX.md`](FE-BE-GAP-MATRIX.md) — **not superseded** by it. Hub: [`README.md`](README.md).

Файл **не перезаписывается** скриптом `api:gap-matrix`: его содержимое **вклеивается** в конец `FE-BE-GAP-MATRIX.md` при каждой регенерации с `--write`.

Добавляйте сюда строки из секции **«Inventory paths missing from OpenAPI export (actionable)»** (после волны 10 — без mount-префиксов и без query в строке).

| Path | Вердикт | Комментарий |
|------|---------|-------------|
| `/api/v1/dashboard` | Ожидаемо | Placeholder в `API_PATHS`; реальные дашборды — `marketing-cabinet`. |
| `/api/auth/*` | Ожидаемо | Вне FastAPI export; отдельный контур аутентификации (см. также noise-фильтр). |
| `/api/data` | Ожидаемо вне export | Нет как единого REST-маршрута в EliteEW; в инвентарь попадает из примера в [`UGSHub.tsx`](../../shared/web/frontend/src/components/UGSHub.tsx) (`fetch("/api/data")` в тексте промпта), не продуктовый вызов API. |
| `/api/analytics/web-vitals` | Ожидаемо вне export | Типично браузер/отдельный сборщик или nginx; не обязан дублироваться в OpenAPI EliteEW. |
| `/api/emperyworld` | Ожидаемо вне export | Отдельный контур: [`ServiceConfig.ts`](../../shared/web/frontend/src/services/core/ServiceConfig.ts) `baseUrl: '/api/emperyworld'`, токены `emperyworld_*`; не домен FastAPI в этом репозитории. |
| `/api/config/unified` | Ожидаемо / fallback | Вызывается из `getUnifiedConfig()`; при отсутствии ответа — fallback на env. В `shared/api` отдельного `@app.get("/api/config/unified")` нет — путь может отдавать прокси/старый бэкенд или 404 в чистом стенде. |
| `/api/logs` | Ожидаемо частично | Клиентские логи: в OpenAPI есть `POST /api/v1/monitoring/logs` и др.; строка `/api/logs` из инвентаря может быть legacy — сверять с фактическим клиентом. |
| `/api/protected` | Ожидаемо вне export | Нет зарегистрированного маршрута в коде EliteEW API; вероятна заглушка/прокси или устаревший инвентарь. |
| `/api/monitoring` | См. матрицу | В режиме по умолчанию может попасть в mount-prefix, если есть дочерние пути в export. |
| `/api/v1/dashboard/layouts/active` | Ожидаемо | Плейсхолдер/тест (`client.interceptors.test`); реальные layout — `.../marketing-cabinet/projects/{id}/dashboard-layouts/active`. |
| `/api/v1/desktop/ai-chat/chats/stream` | Шум инвентаря | В API: `POST .../desktop/ai-chat/chats/{chat_id}/stream` ([`desktop_ai_chat.py`](../../shared/api/routers/desktop_ai_chat.py)); глобального `chats/stream` нет. |
| `/api/v1/desktop/kirs/projects/…/proxy` | Тест/UUID | Вероятно пример из кода; не ключ OpenAPI. |
| `/api/v1/health` | Закрыто (Wave 11) | Роут в [`main.py`](../../shared/api/main.py); публично через [`oauth2_protection.py`](../../shared/api/middleware/oauth2_protection.py). После `openapi:export` — ключ в export. |
| `/api/v1/ping` | Закрыто (Wave 11) | Лёгкий liveness в `main.py`; публичный путь; в export после экспорта. |
| `/api/v1/product-desktop/news-linked-image/abc` | Тестовый | Плейсхолдер в инвентаре. |
| `/api/v1/resource` | Тест / уточнить | Встречается в [`client.interceptors.test.ts`](../../shared/web/frontend/src/services/api/__tests__/client.interceptors.test.ts) как произвольный путь; не якорь продакшен-контракта. |
| `/api/v1/system-info` | Разведено (Wave 11) | **EliteEW:** алиас к `/api/health` (сводка БД/сервисов). **A1111 SD:** провайдер бьёт в `/sdapi/v1/system-info` на GPU-контейнере, не в EliteEW. |
| `/api/v1/desktop/site-studio/proxy` | См. mount | После волны 10 обычно в секции mount-prefix; exact-ключ есть в export. |

*(Дополняйте таблицу по мере разбора.)*
