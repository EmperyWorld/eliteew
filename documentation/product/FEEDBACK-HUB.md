# Обращения (Feedback Hub)

Полное описание продукта **«Обращения»**: десктопное приложение для пользователей, админ-очередь, API, бизнес-правила и безопасность.

## Назначение

Пользователи отправляют **пожелания** (`kind: wish`) или **сообщения об ошибках** (`kind: bug`). Команда обрабатывает тикеты в админ-панели: статусы, заметки, при закрытии — опционально внутренние «признания» (не денежное вознаграждение) и уведомления.

## Пользовательский опыт (desktop)

### Приложение

- Компонент: `shared/web/frontend/src/pages/Desktop/components/FeedbackHubApp.tsx` (shell).
- Подмодули: `feedbackHub/FeedbackHubStatsSection.tsx`, `feedbackHub/FeedbackHubComposeForm.tsx`, `feedbackHub/FeedbackHubTicketListSection.tsx`.
- Каталог: `FeedbackHubApp` (EWDesk / магазин приложений).
- **Ввод только текстом:** по умолчанию одно крупное поле «Ваше сообщение»; прежняя многосекционная шпаргалка (wish/bug) доступна по кнопке «по шаблону» и при открытии **дополняет** основной текст. Readonly-превью «что уйдёт на сервер». **Голос и распознавание речи в этом приложении отключены** (без микрофона, без STT).

### Mobile Android (embedded SPA, OTA ≥ 0.2.161)

- Hash: `#/mobile-feedback-hub` → `MobileFeedbackHubPage` → `FeedbackHubApp embeddedMobile`.
- Тот же API и UX, что desktop; native toolbar (`MobileEmbeddedSpaChrome`), без дублирующего product header.
- **Порядок колонок:** stats → **compose** → list (форма выше истории, чтобы не прокручивать длинный список до отправки); sticky send bar с `safe-area-inset-bottom`.
- Точки входа: **EW hub** (меню EliteEW), **Desktop Hub** (`ugs/desktop`), **Профиль → Поддержка**.
- Канон shell/UI: [MOBILE-ANDROID-EMBEDDED-SPA-UI-STYLE.md](mobile/MOBILE-ANDROID-EMBEDDED-SPA-UI-STYLE.md) §4.4, bootstrap: [MOBILE-ANDROID-EMBEDDED-SPA-WEBVIEW-TEMPLATE.md](mobile/MOBILE-ANDROID-EMBEDDED-SPA-WEBVIEW-TEMPLATE.md).

### Трей

- **`FeedbackHubApp` не входит в трей** (`useDesktopTrayItems`): строки «Обращения» в списке фоновых процессов нет; счётчик трея не увеличивается; переключателей «показывать в трее» для этого приложения нет. Канон: [`product/desktop/DESKTOP-TASKBAR-ARCHITECTURE.md`](desktop/DESKTOP-TASKBAR-ARCHITECTURE.md) §«Фоновые процессы в трее».
- Точки входа пользователя: значок на столе, **Пуск**, магазин; из **Ассистента** — **«Не помогло — в Обращения»** под ответом модели и **«Открыть Обращения»** в пустом чате (`requestOpenDesktopApp` с `feedbackQuickMode: 'text'`).

### Список и фильтры

- Бесконечная подгрузка списка своих тикетов; локальные фильтры по типу, статусу, тексту (в т.ч. **ID**); сортировка по дате; счётчик «показано N из M» (после фильтра).
- Карточка тикета: тип, статус, дата создания, для закрытых — **дата закрытия**; **краткий ID** (первые символы) + кнопка **копирования полного ID**; тело; при наличии — блок **«Ответ команды»** (содержимое `admin_notes`); для закрытых с начислением — **«Признание от команды»** (`reward_credits` > 0).

### Сводка (лимиты)

- Карточки: **число активных** (не в статусе `closed`) обращений по `wish` и по `bug` относительно персонального лимита; блок «Признание от команды» (сумма внутренних отметок по закрытым обращениям с начислением — не валюта). Пока summary грузится — **skeleton** трёх карточек (без layout shift). Бейдж «Доверенный участник» в шапке desktop — tooltip с числами лимитов. После закрытия тикета слот лимита **освобождается** — можно создать новое обращение того же типа.

### Горячие клавиши

- Отправка: **Ctrl+Enter** / **Cmd+Enter** (см. подсказку под превью). Обработчик на уровне **`<form>`** (без отправки навигацией: `onSubmit` с `preventDefault`), чтобы сочетание работало предсказуемо и без конфликта с правилами a11y для «интерактивных» обёрток.

### Разметка и a11y (форма)

- Группы полей с подписями оформлены через **`<section aria-labelledby="…">`** (в т.ч. блок частоты для bug, дополнительные заметки, превью итогового текста).

### Разметка и a11y (список)

- Поиск с кнопкой **«Сбросить»** при непустом запросе; фильтры типа — **`aria-pressed`**; сортировка — **`aria-label`** по текущему порядку; список — **`aria-label`** с числом показанных карточек; при пустом фильтре — кнопка **«Сбросить фильтры»** (поиск, тип, статус, сортировка).
- **Esc** сбрасывает активные фильтры списка (подсказка под панелью фильтров на desktop).
- На **mobile embedded** при активных фильтрах — кнопка «Сбросить фильтры» (Esc недоступен).
- Карточка тикета — **`<article id="feedback-ticket-article-{id}" aria-labelledby>`** со скрытым заголовком «тип, статус, дата»; после отправки фокус и scroll на article; **`aria-live`** о добавлении в список.
- Карточки лимитов сводки — **`aria-label`** с числом активных обращений.

### Горячие клавиши (список)

- **Esc** — сброс поиска и фильтров списка, когда хотя бы один фильтр активен.
- **Ctrl+F** / **/** — фокус в поле поиска списка (как в EWDesk).

### Поиск

- Локальный поиск по ID, телу, ответу команды и **локализованным меткам** типа/статуса.

### Тесты (клиент)

- Vitest: `feedbackHubBodyAssembler.test.ts`, `feedbackHubTicketFilters.test.ts`, `feedbackHubLocale.test.ts`, `feedbackHubSubmitGate.test.ts`, `feedbackHubSendLabels.test.ts`, `feedbackHubListFilterState.test.ts`, `feedbackHubClientMeta.test.ts`, `feedbackHubCharCount.test.ts`.

### i18n

- Пространство: `desktopUi`, префикс `feedbackHub` (`shared/web/frontend/src/i18n/locales/ru/desktopUi.json` / `shared/web/frontend/src/i18n/locales/en/desktopUi.json`).

### Клиентский API

- `shared/web/frontend/src/pages/Desktop/services/productDesktopApi.ts` (P36 aggregator; feedback cluster in `productDesktopApi/feedback.ts`) — `createFeedbackTicket`, `fetchFeedbackSummary`, `listMyFeedbackTickets` и нормализация ответов `{ items, total }`.

---

## Админка

### Раздел

- `shared/web/frontend/src/pages/Admin/FeedbackAdminSection.tsx`.
- Открытие по deep link: `?section=feedback` на `UnifiedAdminPage`; опционально `?ticket=<uuid>` — прокрутка к карточке.

### Возможности

- Поиск с debounce (`q` — по телу и id), фильтры статуса и типа, чекбокс «Показать закрытые» при просмотре всех статусов; кнопка обновления; карточка автора (`submitter`: username, email, имя, аватар); копирование id тикета и user id; смена статуса / заметок / закрытие с опциональным начислением (см. API).

---

## Продуктовое правило: `admin_notes`

- Поле **`admin_notes`** в API и в ответах **списка пользователя** — это **текст, видимый автору обращения** (в UI оформлен как ответ команды).
- **Не использовать** для внутренних пометок, которые не должны видеть пользователи. Для внутреннего трека нужен отдельный процесс или поле вне этой модели.

Правило для агентов и кода: **`.cursor/rules/feedback-tickets-product.mdc`**.

---

## API

Префикс: **`/api/v1/product-desktop`** (роутер `shared/api/routers/product_desktop.py`).

### Пользователь (OAuth2 + `get_desktop_user_id`)

| Метод | Путь | Описание |
|--------|------|----------|
| `GET` | `/feedback/summary` | Лимиты: `wish_count` / `bug_count` — только **активные** тикеты (`status <> 'closed'`); `wish_limit`, `bug_limit`, `is_trusted`, `team_recognition_total` |
| `GET` | `/feedback/tickets` | `limit`, `offset`, опционально `kind` (`wish` \| `bug`). Свои тикеты. Ответ: `{ items, total }` |
| `POST` | `/feedback/tickets` | Тело: `kind`, `body` (1…20000 символов), опционально `client_meta` (JSON, до ~4096 байт сериализации). Rate limit: `FEEDBACK_TICKET_RATE_LIMIT_*`, уважает `RATE_LIMIT_ENABLED` |

### Админ (`require_admin_user`: роли `admin`, `emperyworld_admin`)

| Метод | Путь | Описание |
|--------|------|----------|
| `GET` | `/admin/feedback/tickets` | `limit`, `offset`, `status`, `kind`, `q` (до 200 символов), `include_closed`. Без фильтра `status` закрытые по умолчанию скрыты, пока `include_closed=true` |
| `PATCH` | `/admin/feedback/tickets/{ticket_id}` | `status`, `admin_notes` (хотя бы одно поле) |
| `POST` | `/admin/feedback/tickets/{ticket_id}/close` | Закрытие; опционально `reward_credits`, `admin_notes`; логика UGS/уведомлений — в коде |

### Лимиты создания (одновременно активные, по `kind`)

- На пользователя одновременно может быть не больше **N** активных (`status <> 'closed'`) пожеланий и **M** активных сообщений об ошибках. По умолчанию: **2** и **5**; для `users.is_trusted`: **5** и **10** (env: `FEEDBACK_WISH_LIMIT_*`, `FEEDBACK_BUG_LIMIT_*`).
- Закрытые обращения **не учитываются** — после закрытия счётчик уменьшается и можно создать новое.
- При превышении лимита активных: **400** при `POST /feedback/tickets` с текстом на русском.

### Кэш

- Ответы product-desktop для GET не должны устаревать из-за кэша при работе с тикетами — см. `ProductDesktopNoStoreMiddleware` и рабочие заметки в `documentation/worklog/README.md` *[monthly journals retired — stub only]* (cache / HIT).

---

## Данные и миграции

- Таблица `feedback_tickets`: см. миграции в `shared/api/migrations/applied/` (например `20260420_product_desktop_backlog.sql`, `20260407_feedback_tickets_client_meta.sql`, `20260408_feedback_tickets_status_check.sql`).
- Поля: `user_id`, `kind`, `body`, `status`, `admin_notes`, `reward_credits`, `closed_at`, `client_meta` (jsonb), метки времени.

---

## Безопасность (кратко)

- Доступ к чужим тикетам по API — только через админ-очередь; пользователь видит только свои записи (`user_id` из сессии).
- SQL — параметризованные запросы; тело и метаданные ограничены по размеру.
- Рендер на фронте — текстом (без произвольного HTML из полей тикета).
- Подробности см. обзор в чате/ревью; голосовой pipeline к обращениям **не подключён**.

---

## Связанные файлы (ориентир)

| Область | Путь |
|--------|------|
| UI пользователя | `shared/web/frontend/src/pages/Desktop/components/FeedbackHubApp.tsx` · `feedbackHub/FeedbackHubStatsSection.tsx` · `feedbackHub/FeedbackHubStatsSkeleton.tsx` · `feedbackHub/FeedbackHubComposeForm.tsx` · `feedbackHub/FeedbackHubTicketListSection.tsx` |
| UI админки | `shared/web/frontend/src/pages/Admin/FeedbackAdminSection.tsx` |
| API клиент | `shared/web/frontend/src/pages/Desktop/services/productDesktopApi.ts` (+ `productDesktopApi/feedback.ts`) |
| Метки/статусы | `shared/web/frontend/src/pages/Desktop/utils/feedbackLabels.ts`, `feedbackPaged.ts` |
| Бэкенд | `shared/api/routers/product_desktop.py` |
| Rate limit | `shared/api/services/rate_limiter.py` (`get_feedback_ticket_rate_limiter`) |
| Правило Cursor | `.cursor/rules/feedback-tickets-product.mdc` |


