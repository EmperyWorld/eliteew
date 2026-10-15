# Центр уведомлений Desktop — руководство для разработчиков

Технический канон по реализации уведомлений на рабочем столе EliteEW.
Пользовательское описание и UX-сценарии находятся в `product/desktop/DESKTOP-NOTIFICATIONS-APP.md`.

## 1) Область и инварианты

- Единая точка отправки уведомлений на фронте: `notify.*` из `shared/web/frontend/src/notifications/api.ts`.
- Центр уведомлений и toast-слой должны оставаться синхронизированными по `id` серверного события (не создавать дубли одной сущности разными id).
- Обычные socket-toast должны автозакрываться по таймаутам Sonner (`info/success` ~3000 ms, `warning` ~4000 ms, `error` ~5000 ms).
- Бесконечный toast (`duration = Infinity`) допускается только для Doc Studio invite (через `showDocCollabInviteToast`).
- Серверный snapshot inbox ограничен 200 элементами (клиент и backend должны соблюдать одинаковый лимит).

## 2) Карта фронтенда

### Core слой уведомлений

- Провайдер и подключение sync:
  - `shared/web/frontend/src/notifications/NotificationProvider.tsx`
  - `shared/web/frontend/src/notifications/NotificationCenterSync.tsx`
- Store и local persistence:
  - `shared/web/frontend/src/notifications/context.tsx`
  - `shared/web/frontend/src/notifications/persistence.ts`
- DTO/merge:
  - `shared/web/frontend/src/notifications/types.ts`
  - `shared/web/frontend/src/notifications/notificationCenterMerge.ts`
  - `shared/web/frontend/src/notifications/notificationCenterSyncPolicy.ts`
- API facade:
  - `shared/web/frontend/src/notifications/api.ts`

### Socket delivery

- Основной bridge для desktop:
  - `shared/web/frontend/src/pages/Desktop/DesktopSocketNotificationsBridge.tsx`
  - монтируется в `shared/web/frontend/src/pages/Desktop/DesktopWorkspace.tsx`
- Legacy hook (держать поведение консистентным с bridge):
  - `shared/web/frontend/src/notifications/useSocketNotifications.ts`
- Спец-доставка doc collaboration invite:
  - `shared/web/frontend/src/notifications/docCollabSocketDelivery.ts`
- Политика socket toast options:
  - `shared/web/frontend/src/notifications/socketToastOptions.ts`

### Desktop UI

- Общее тело центра:
  - `shared/web/frontend/src/pages/Desktop/components/NotificationHubBody.tsx`
- Элементы:
  - `shared/web/frontend/src/pages/Desktop/components/notificationHub/NotificationHubItem.tsx`
  - `shared/web/frontend/src/pages/Desktop/components/notificationHub/NotificationHubQuickSettings.tsx`
- Метаданные источников:
  - `shared/web/frontend/src/notifications/sourceMeta.ts`
- Звук:
  - `shared/web/frontend/src/pages/Desktop/utils/notificationSound.ts`

## 3) Поток данных (runtime)

1. Домен вызывает `NotificationService.send_to_user` / `emit_in_app_now`.
2. Если событие **persistent** или **high/urgent** (и ещё не истекло), строка upsert-ится в `user_notification_center` (`notification_center_inbox.py`). Сбой записи логируется и **не** блокирует emit.
3. Событие уходит в Socket.IO (`notification`, room `gaf_user_{user_id}`).
4. В `DesktopSocketNotificationsBridge` событие нормализуется в `NotificationInput`.
5. Решается, добавлять ли строку в центр:
   - `persistent == true`, или
   - `priority in {high, urgent}`, или
   - включён user toggle `desktop_notification_center_all_socket_events`.
6. Для обычных событий вызывается `notify.info/success/warning/error(...)` с `buildSocketToastOptions(...)`.
7. Для doc-collab invite вызывается `deliverDocCollabInviteSocketNotification(...)`:
   - строка в центр (если разрешено),
   - специальный интерактивный toast invite,
   - звук источника `doc_editor`.
8. Офлайн-клиент без сокета получает ту же qualifying-строку на следующем `GET /profile/notification-center` / desktop shell bootstrap / любом `connection-restored` (включая initial). GET и bootstrap отдают `dismissed_ids`; клиент вычитает их из localStorage-merge.
9. Снятие строки: `emit_dismiss_for_user` пишет tombstone в `dismissed_ids` и убирает id из `items`, затем Socket.IO `notification_dismiss`. Клиентский dismiss шлёт те же id в `PUT … dismissed_ids` сразу (без debounce 900 ms). Tombstone побеждает поздний PUT/persist с тем же id.

Важное: `notify.*` сам играет звук (`playNotificationSoundForSourceThrottled`), поэтому в bridge нельзя дублировать вызовы звука вручную.

## 4) Источники (source), i18n и визуал

- Канонические source-ключи и alias normalizer: `normalizeNotificationSource(...)` в `sourceMeta.ts`.
- Порядок в UI задаёт `NOTIFICATION_SOURCE_ORDER`.
- i18n-ключ для источника должен возвращаться относительно `notificationHub` keyPrefix:
  - корректный формат: `sources.<key>`.
- Toast-accent по источнику задаётся через `getNotificationSourceToastClassName(...)`.

Практическое правило: если компонент вызывает `useTranslation('desktopUi', { keyPrefix: 'notificationHub' })`, нельзя возвращать ключ с повтором `notificationHub.*`, иначе в UI появятся сырые строки ключей.

## 5) Звук уведомлений

Глобальные переключатели:

- `desktop_sound_enabled`
- `desktop_do_not_disturb`
- `desktop_sound_theme`

Пер-источник:

- `desktop_sound_theme_by_source: Record<string, string>`
- `desktop_sound_enabled_by_source: Record<string, boolean>`

Логика в `notificationSound.ts`:

- `shouldPlayNotificationSound()` проверяет глобальные sound+DND.
- `isDesktopSourceSoundEnabled(source)` проверяет toggle конкретного источника.
- `playNotificationSoundForSource(Throttled)` выбирает theme по source и учитывает оба уровня enable/disable.

## 6) Persistence и sync

### Local

- Local storage key: `elite_notification_center_v1`.
- Debounce записи: ~400 ms.
- На logout используется `clearNotificationStore()` и очистка persisted store.

### Server snapshot

- GET/PUT: `/api/v1/profile/notification-center`. GET and PUT responses include `items` **and** `dismissed_ids`. Clients **must** drop tombstoned ids from localStorage/union merge. Missing ids in `items` are still **not** inferred as dismiss (that would tombstone unread persist-on-emit rows).
- **Persist-on-emit:** `NotificationService.emit_in_app_now` upserts the row into `user_notification_center` **before** Socket.IO emit when `persistent` or `priority in {high, urgent}` (same default as the desktop hub). Expired events are not written. Failures are logged (`[STEP] notification_center_persist_fail`) and must not block the live emit. If Postgres is down, the live toast still works; the offline GET stays empty until persist succeeds.
- **Dismiss tombstones:** `emit_dismiss_for_user` removes the id from `items` and appends it to `dismissed_ids`, then emits `notification_dismiss`. Persist of a tombstoned id is a no-op. GET strips tombstoned ids even if they linger in `items`.
- **PUT is merge, not replace:** the server unions client `items` with the stored inbox under `pg_advisory_xact_lock`, then drops tombstoned ids. Response body is the **stored** snapshot plus `dismissed_ids`. A stale client PUT cannot wipe a row the client never loaded. Client `dismissed_ids` are merge-additive (server cap 500). Missing ids in a PUT are **not** inferred as dismiss (that would tombstone a persist-on-emit row the client had not fetched yet).
- Sync-компонент: `NotificationCenterSync.tsx`.
- Debounce PUT: ~900 ms for ordinary edits; **0 ms** when `dismissed_ids` is non-empty.
- Retry-backoff PUT: `[2000, 5000, 10000, 20000, 30000]`.
- Inbox GET uses `staleTime: 0` (not the 120 s bootstrap seed). Socket.IO `connection-restored` **always** refetches, including the initial connect.
- Dedup:
  - `lastSentHashRef` is set **only after a successful PUT**. A GET apply sets it to `null` so reconnect cannot suppress a pending dismiss PUT.
  - `inFlightHashRef` не запускает дубликаты in-flight,
  - `retryHashRef` отменяет ретраи старого payload при смене данных.
- **Not in this wave:** `metadata` / `serverActions` still omitted from the snapshot (buttons die after reload). Toggle `desktop_notification_center_all_socket_events` remains **client-only** (low-priority socket events are not persisted).

## 7) Backend контракт

### Endpoints

- `GET /api/v1/profile/notification-center` — visible `items` plus `dismissed_ids` for client merge
- `PUT /api/v1/profile/notification-center` — merge `items` + additive `dismissed_ids`; returns stored snapshot including `dismissed_ids`
- `GET /desktop/shell-bootstrap` — `notification_center` uses the same GET shape (tombstones included)
- `PATCH /api/v1/profile/preferences` (notification settings)

Реализация:

- `shared/api/routers/user_profile.py`
- `shared/api/schemas/notification_center.py`
- `shared/api/schemas/user_profile.py`
- `shared/api/services/notification_service.py`
- `shared/api/services/notification_center_inbox.py` — persist / remove / PUT merge / GET visibility
- `shared/api/services/user_profile_service.py` — GET/PUT snapshot
- `shared/api/services/desktop_shell_bootstrap_service.py` — cold-path `notification_center` includes `dismissed_ids`

OpenAPI generated pilots do **not** list `dismissed_ids` until a stack0 bake with `--refresh-openapi-pilots`. The live PUT schema accepts the field; extra JSON is ignored by older generated clients.

### DB

- Таблица: `user_notification_center`
- SQL: `shared/api/migrations/applied/20260407_user_notification_center.sql`
- Tombstones: `shared/api/migrations/applied/20260818_01_user_notification_center_dismissed_ids.sql` (runner key `20260818_01|user_notification_center_dismissed_ids` in `docker/scripts/apply-eliteew-migrations.sh`)
- Поля:
  - `user_id` (PK, FK -> `users.id`)
  - `items` JSONB
  - `dismissed_ids` JSONB (default `[]`; apply migration **before** API that writes this column)
  - `updated_at` timestamptz
- Writes take `pg_advisory_xact_lock(hashtextextended(user_id::text, 0))`, then `INSERT … ON CONFLICT DO NOTHING`, then `SELECT … FOR UPDATE`.

## 8) Что сериализуется в inbox, а что нет

В серверный snapshot уходят только сериализуемые поля строки:

- `id`, `type`, `title`, `message`, `timestamp`, `read`, `persistent`, `source`, `expiresAt`.

Не сериализуются:

- `icon`
- `action.onClick`
- `openApp`
- runtime-only поля UI.

Если нужна восстановимая action-логика после reload, она должна ехать как серверный action-id + metadata и интерпретироваться в runtime.

## 9) Расширения центра уведомлений

Слоты и registry:

- `shared/web/frontend/src/pages/Desktop/notifications/notificationHubExtensionRegistry.ts`
- `shared/web/frontend/src/pages/Desktop/notifications/NotificationHubExtensionSlots.tsx`

Доступные слоты:

- `hubSettingsBefore`
- `hubSettingsAfter`
- `hubPanelFooter`
- `hubFeedStart`
- `hubFeedEnd`

Правило: для новых виджетов центра использовать slot API, а не раздувать `NotificationHubBody.tsx`.

## 10) Чеклист для изменений

### Добавить новый source

1. Добавить ключ/alias в `sourceMeta.ts`.
2. Добавить i18n строки `desktopUi.notificationHub.sources.<key>` в `ru/en`.
3. Добавить (если нужно) визуальный tone/class в `sourceMeta.ts` и/или `notificationHubStyles`.
4. Добавить дефолты sound theme/enable в `notificationSound.ts`.
5. Убедиться, что quick settings показывает источник в ожидаемом порядке.

### Изменить политику socket-toasts

1. Править `socketToastOptions.ts` (а не разрозненно в нескольких местах).
2. Проверить консистентность с `useSocketNotifications.ts` (legacy).
3. Сохранить инвариант: не делать все `persistent` toast бесконечными.

### Изменить политику persist-on-emit

1. Править `should_persist_in_notification_center` в `notification_center_inbox.py` (не разрозненно в роутерах).
2. Держать её согласованной с `DesktopSocketNotificationsBridge` (default: persistent / high / urgent). Toggle «все события в ленту» остаётся клиентским.
3. Прогнать `tests/test_notification_center_inbox.py`.

### Изменить серверный payload inbox

1. Обновить frontend merge/serialization (`notificationCenterMerge.ts`).
2. Обновить backend schema (`api/schemas/notification_center.py`).
3. При необходимости добавить SQL миграцию и обновить docs.

## 11) Минимальная проверка перед merge

Frontend:

```bash
cd shared/web/frontend
pnpm exec vitest run \
  "src/notifications/__tests__/socketToastBehavior.test.ts" \
  "src/notifications/__tests__/sourceMeta.test.ts" \
  "src/notifications/__tests__/notificationCenterMerge.offlineInbox.test.ts" \
  "src/notifications/__tests__/notificationCenterSyncPolicy.test.ts"
```

Backend (если меняли схемы/роуты/inbox persist):

```bash
cd shared/api
UV_PROJECT_ENVIRONMENT=../../.venv uv run pytest tests/test_notification_center_inbox.py -q --tb=short
```

- Проверить, что `GET/PUT /profile/notification-center` и `PATCH /profile/preferences` принимают новые поля.
- Убедиться, что сервер не режет новые настройки (`desktop_sound_*_by_source`) и корректно round-trip'ит их в `preferences.notifications`.
