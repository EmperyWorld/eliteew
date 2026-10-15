# Центр уведомлений на рабочем столе

> Для разработчиков: архитектура, поток socket-событий, синхронизация и чеклисты изменений описаны в `product/desktop/DESKTOP-NOTIFICATIONS-DEVELOPER.md`.

## Назначение

- **Таскбар:** компактная выезжающая панель (колокол) — список, фильтры по типу; подсказка «звук и режимы — в полном окне» + кнопка «Открыть полностью».
- **Окно приложения:** то же содержимое в полноразмерном окне (`appComponent`: **`NotificationsApp`**) + **быстрые настройки** (звук, «Не беспокоить», GAF, UGS).

### Mobile Android (embedded SPA, OTA ≥ 0.2.162)

- Hash: `#/mobile-notifications` → `MobileNotificationsPage` → `NotificationsDesktopApp embeddedMobile`.
- Desktop window density (поиск, группировка, экспорт JSON); native compact list в Feed → колокольчик остаётся.
- Точки входа: **EW hub**, **Desktop Hub**, **Профиль → Уведомления**. Канон: [MOBILE-ANDROID-EMBEDDED-SPA-UI-STYLE.md](../mobile/MOBILE-ANDROID-EMBEDDED-SPA-UI-STYLE.md) §4.5.

Данные — контекст `@/notifications` (`useNotifications()`), список дополнительно пишется в **localStorage** (ключ `elite_notification_center_v1`, debounce ~400 ms), лимит **200** строк (`MAX_NOTIFICATIONS`). В JSON **не** сохраняются: `icon`, `action.onClick`, `openApp` — после перезагрузки страницы недоступны. Дублировать store не нужно.

**Серверный снимок (между устройствами):** при входе выполняется `GET /api/v1/profile/notification-center`, список сливается с локальным (`notificationCenterMerge.ts`); изменения уходят на сервер с debounce ~900 ms (`NotificationCenterSync` в `NotificationProvider`), а снятие строки — сразу, с `dismissed_ids`. Таблица БД: `user_notification_center` (миграции `20260407_user_notification_center.sql` и `20260818_01_user_notification_center_dismissed_ids.sql`).

Важные in-app события (**persistent** или приоритет **high/urgent**) сервер **сам записывает** в этот снимок **до** Socket.IO emit. Если стол был закрыт, строка всё равно появится в центре после следующего входа, bootstrap или восстановления сокета. Снятие (`notification_dismiss` или закрытие в центре) ставит **tombstone**: GET эту строку не вернёт, а поздний PUT другого устройства не воскресит её. PUT **объединяет** снимок клиента с серверным (не заменяет целиком).

- **Виртуализация:** панель таскбара при `> 26` строк; полное окно при `> 40` — плоский список с отдельной прокруткой блока настроек сверху.
- **Настройки:** звук / GAF / UGS читают профиль из `UserPreferencesAppContext` (без трёх отдельных `getPreferences` на монтирование). Ошибка `PATCH` профиля — toast `notificationHub.toastSaveFailed`, откат optimistic UI, лог `[STEP] notification_hub_prefs_save_fail` (хелпер `quickSettings/useNotificationHubPrefsPersist.ts`).
- **Звук по источникам:** в полном окне центра уведомлений можно выбрать отдельную мелодию для источников (GAF Chat, UGS, Документы и др.) и отдельно включать/выключать звук по каждому источнику; настройки хранятся в `preferences.notifications.desktop_sound_theme_by_source` и `preferences.notifications.desktop_sound_enabled_by_source`, применяются к socket-toast.
- **Экспорт:** в полном окне кнопка **Export JSON** (сериализуемые поля, без функций).
- **Очистить всё:** подтверждение через **`NotificationHubClearConfirm`** → **`DesktopPortaledConfirmShell`** (`useShellPortal` / `ShellBodyPortal` tokens from `#desktop-main`, не «голый» `createPortal` к `document.body`).

**Сервер (socket):** по умолчанию в ленту попадают только события с `persistent`, `priority` high/urgent. Пользователь может включить в быстрых настройках окна **«все события с сервера в ленту»** — поле профиля `notifications.desktop_notification_center_all_socket_events` (см. `DesktopSocketNotificationsBridge`).
Обычные socket-toast в UI закрываются по стандартному таймауту Sonner; бесконечный toast (`duration = Infinity`) используется только для приглашений в совместную работу Doc Studio, пока пользователь не нажмёт действие.

В полнооконном режиме доступны **поиск** и **фильтр по источнику** (`source`). В окне (не в режиме виртуализации длинного списка) можно переключить **группировку: по типу или по источнику**; при группировке по источнику секции — **аккордеоны** (`<details>`), режим запоминается в `sessionStorage` (`elite_notification_hub_group_mode_v1`).

## Открытие полного окна

- Кнопка **«Открыть полностью»** в панели диспатчит `CustomEvent('desktop-open-app', { detail: { appComponent: 'NotificationsApp' } })` (как и другие ссылки на приложения).
- Чтобы событие нашло приложение, на столе должен быть ярлык с тем же `appComponent` — для новых конфигов он есть в **`DEFAULT_APPS`** (`app-notifications`). У существующих пользователей без этого ярлыка можно добавить приложение из магазина.

## Бэкенд и каталог

- **`app_component`:** `NotificationsApp` — product manifest `shared/apps/notifications/app.manifest.yaml` (contributes to `KNOWN_DESKTOP_APP_COMPONENTS` via `api/services/desktop_app_manifests`). Without it in the union, админка каталога отклоняет создание/редактирование.
- **Каталог магазина:** миграция `shared/api/migrations/applied/20260417_desktop_app_catalog_notifications_app.sql` — строка `app_id` = **`app-notifications`**, при необходимости **`INSERT` дефолтной строки в `app_access_groups`** (`id` = `a0000000-0000-4000-8000-000000000001`, как `DEFAULT_ACCESS_GROUP_ID` в API), затем M2M в `desktop_app_catalog_access_groups`, заводская установка (`is_factory` = true).
- **System GAF onboarding:** `NotificationsApp` добавлен в `ALLOWED_DESKTOP_APP_COMPONENTS` (`api/gaf_chat/system_gaf_instruction.py`) для шагов с `open_app_component`.

## Код

| Что | Где |
|-----|-----|
| Общее тело UI | `NotificationHubBody.tsx`; модули под `components/notificationHub/` — `NotificationHubPanelFilters`, `NotificationHubWindowFilters`, `NotificationHubGroupedFeed`, `NotificationHubFooterToolbar`, Item, QuickSettings (`quickSettings/*`), виртуальные списки, confirm, export, **`notificationHubLayoutTokens.ts`**, **`notificationHubFilterState.ts`** |
| Панель таскбара | `NotificationCenter.tsx` |
| Окно | `NotificationsDesktopApp.tsx` |
| Регистрация окна | `EnhancedWindow.tsx` (`NotificationsApp`) |
| Визуал иконки | `desktopVisualSystem.tsx` (`NotificationsApp`) |
| Семейство chrome | `DesktopAppChrome.tsx` (`DESKTOP_APP_FAMILY_BY_COMPONENT`) |
| Ярлык по умолчанию | `pages/Desktop/constants/index.ts` (`DEFAULT_APPS`) |
| Строки UI | `i18n/locales/{ru,en}/desktopUi.json` → `notificationHub` |
| Расширения UI (слоты) | `shared/web/frontend/src/pages/Desktop/notifications/` — `registerNotificationHubExtension`, рендер в `NotificationHubBody` |

## Расширения центра уведомлений (слоты)

Подключайте виджеты без правок `NotificationHubBody`: вызовите `registerNotificationHubExtension` из модуля фичи (обычно side-effect при импорте).

**Слоты:** `hubSettingsBefore` / `hubSettingsAfter` (окно, вокруг QuickSettings), `hubPanelFooter` (панель таскбара под фильтрами), `hubFeedStart` / `hubFeedEnd` (окно, над/под лентой).

**Контекст:** `density`, `notifications`, `unreadCount`, `actions` (`markAsRead`, `markAllAsRead`, `dismiss`, `clearAll`).

В dev при открытии центра подгружается пример (`notificationHubExtensionDev.tsx`) — в production не бандлится.

---

## Ассистент для ИИ (ассистент «Ассистент») и поддержка KB

**Пользовательские формулировки для RAG** (загрузка в админку «Ассистент» → документы KB → переиндексация):

| Файл | Темы |
|------|------|
| `product/handbook-kb-articles/kb-tsentr-uvedomleniy.md` | колокольчик, где открыть, поиск, фильтры, **синхронизация между устройствами** |
| `product/handbook-kb-articles/kb-tsentr-uvedomleniy-kompakt-i-polnyy-ekran.md` | панель vs полное окно, «Открыть полностью» |
| `product/handbook-kb-articles/kb-tsentr-uvedomleniy-prochitano-i-ochistka.md` | прочитать все, очистить, **группы по типу и по источнику**, подтверждение очистки |
| `product/handbook-kb-articles/kb-uvedomleniya-zvuk-i-ne-bespochoy.md` | звук, «Не беспокоить», GAF/UGS в быстрых настройках |

Канон поведения продукта для ассистента: `product/PRODUCT-ASSISTANT-HANDBOOK.md`. Технические детали API ниже — **в пользовательские ответы ассистента не выносить** пути к файлам и имена таблиц; для людей использовать тексты из `kb-*.md`.

---

## API и данные (для разработчиков)

| Элемент | Описание |
|---------|----------|
| **GET/PUT** | `GET /api/v1/profile/notification-center` — видимые строки **и** `dismissed_ids` (клиент вычитает их из localStorage-merge). `PUT /api/v1/profile/notification-center` — union `items` (до **200**) + additive `dismissed_ids` (до **200** за запрос; на сервере хранится до **500**); ответ — **сохранённый** снимок + tombstones. Поля строки: `api/schemas/notification_center.py` (`id`, `type`, `title`, `message`, `timestamp` ISO, `read`, опционально `persistent`, `source`, `expiresAt`). |
| **Профиль (звук по источникам)** | `PATCH /api/v1/profile/preferences` → `notifications.desktop_sound_theme_by_source` (JSON `source -> theme`, например `gaf_chat -> pulse`, `ugs -> digital`) и `notifications.desktop_sound_enabled_by_source` (JSON `source -> bool`). |
| **БД** | Таблица `user_notification_center` (`user_id` PK → `users`, `items` JSONB, `dismissed_ids` JSONB, `updated_at`). Миграции: `shared/api/migrations/applied/20260407_user_notification_center.sql`, `shared/api/migrations/applied/20260818_01_user_notification_center_dismissed_ids.sql`. Применять runner **до** API, который пишет `dismissed_ids`. |
| **Слияние** | На клиенте `mergeNotificationLists(local, server)` — объединение по `id`, более новая `timestamp` задаёт содержимое строки, `read` = логическое ИЛИ, `persistent` = ИЛИ; итог сортируется по времени, обрезка 200. На сервере PUT делает тот же union и вычитает `dismissed_ids`. |
| **Синхронизация** | `NotificationCenterSync`: GET с `staleTime: 0` (не 120 s bootstrap seed) и `replaceNotifications(merged minus dismissed_ids)`; `lastSentHash` только после успешного PUT. На изменение списка — debounce **~900 ms** и PUT; dismiss — PUT сразу с `dismissed_ids`; любой `connection-restored` (включая initial) — повторный GET. Сервер **upsert** qualifying emit-строк в ту же таблицу (`notification_center_inbox.py`) до Socket.IO emit. |
| **localStorage** | Ключ `elite_notification_center_v1`, debounce записи ~400 ms; на выходе из аккаунта список очищается вместе с store (`clearNotificationStore`). |
| **Сериализация на сервер** | Не передаются: `icon`, `action`, `openApp`, `metadata`, `serverActions` — после reload кнопки действий в inbox не восстанавливаются (следующая волна). |

**Ограничение UI:** при виртуализации окна (**> 40** строк после фильтров) группировка **только по типу**; переключатель «по источнику» отключён (компактный список для производительности).

---

## История изменений (документ)

| Период | Изменение |
|--------|-----------|
| 2026-08 | **Inbox persist-on-emit + merge/tombstones:** qualifying Socket.IO notifications (`persistent` or high/urgent) are upserted into `user_notification_center` before emit; dismiss writes `dismissed_ids` tombstones; PUT unions with the stored inbox (stale client cannot wipe a server-only row); GET strips tombstones; reconnect refetches. Metadata/actions still not in snapshot (later wave). |
| 2026-06 | **UI audit 11/20 (Notification Hub):** persist failure UX (NH-01), panel hint для Quick Settings, extraction `NotificationHubBody` → Panel/Window filters, GroupedFeed, FooterToolbar; QuickSettings → `quickSettings/*` + `useNotificationHubPrefsPersist`; RU theme labels; Vitest `useNotificationHubPrefsPersist.test.ts`, `resolveNotificationHubEffectiveGroupMode`. |
| 2026-06 | **Wave 9 S2/S3 (typography + z-index):** item title/message/server-action tokens on `DESKTOP_TYPOGRAPHY` (`widgetTrackTitle`, `meta`, `captionInherit`); QuickSettings control labels on `meta`; «Очистить все» — `DesktopPortaledConfirmShell` + `useEmbeddedPortaledModalZIndex`; контекстное меню строки — `DESKTOP_PORTAL_STACK_BUMP.NOTIFICATION_HUB_ITEM_MENU`. Vitest: `notificationHubLayoutTokens.test.ts`, `NotificationHubClearConfirm.zIndex.contract.test.ts`. |
| 2026-06 | **Wave 4 UI polish:** QuickSettings main block tokens (sound/source/test), `nhItemCardShellClass`, `nhExtensionSlotClass`, item `aria-label`. |
| 2026-06 | **Wave 3 UX:** Esc сброс фильтров (panel + window), `notificationHubFilterState.ts`, shell `NotificationsDesktopApp`, QuickSettings pref-row tokens, reset `aria-label`. |
| 2026-06 | **Wave 2 UI polish:** virtual list scroll/gap tokens + estimate constants; extension slot spacing tokens; ClearConfirm layout tokens + destructive `aria-label`; item footer/actions/new-badge tokens. |
| 2026-06 | **Wave 1 UI polish:** общие layout-токены `notificationHubLayoutTokens.ts` (фильтры, группы, empty/hint, карточка Item, toolbar); loading quick settings с `role="status"` + `settingsLoadingAria`; Vitest `notificationHubLayoutTokens.test.ts`. |
| 2026-04 | Серверный inbox GET/PUT, merge, `NotificationCenterSync`; группировка по источнику с `<details>` в полном окне; режим группировки в `sessionStorage` (`elite_notification_hub_group_mode_v1`); подтверждение «Очистить все»; экспорт JSON; бейдж 99+; виртуализация панели/окна; KB для RAG и черновик поста EWDesk: **`EWDESK-POST-DRAFT-notifications-2026-04.md`**. |
