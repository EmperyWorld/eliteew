# Системный GAF: шаблон «Инструкция» и онбординг

## Как получить текст инструкции (шаблон не пустой)

1. **После миграций** — в `pending/` есть `20260413_system_gaf_instruction_seed_ru.sql`: подставляет **дефолтный русский** текст и шаги, **только если** строка `ru` ещё пустая (`welcome`/`thanks` пустые и `steps = []`). Применить: `shared/api/migrations/apply_migrations.sh`.
2. **Вручную в UI** — единая админка: боковое меню **«GAF: инструкции»** (отдельный раздел) → заполнить поля → **«Сохранить шаблон»**. Кнопка **«Обновить»** подтягивает текущее с сервера. Прямая ссылка на раздел: добавить к URL админки параметр **`?section=gaf`** (например после перехода на страницу админки).
3. **По API** (админский JWT): `GET /api/v1/desktop/admin/system-gaf/instruction` — просмотр; `PUT` — сохранение (тело как в `SystemGafInstructionPutBody` в `system_gaf_admin.py`).

Если шаблон пустой, автоотправка новому пользователю и **«Отправить себе»** ничего не отправят — сначала должен быть ненулевой текст после сборки шаблона.

## Назначение

- Админы (`admin` / `emperyworld_admin`) редактируют шаблон приветствия, благодарности и шагов с опциональным открытием приложения рабочего стола (новое окно).
- Сообщения отправляются от системного пользователя GAF; тело хранится как plaintext, структура кнопок — в `gaf_messages.metadata` (тип `onboarding_instruction`).
- При **первом создании** пользователя в БД (SSO sync) ставится задача Celery: один раз отправить инструкцию и выставить `users.onboarding_gaf_sent_at`.

## API

- `GET/PUT /api/v1/desktop/admin/system-gaf/instruction`
- `POST /api/v1/desktop/admin/system-gaf/send-test` — отправить текущему админу
- `POST /api/v1/desktop/admin/system-gaf/send` — `{ "user_id": "uuid", "use_template": true }` (или `user_ids`: массив UUID). Опционально `dry_run: true` — не слать сообщения, только учесть получателей в ответе `sent`/`skipped`. UUID — это `users.id` в PostgreSQL (не сырой Keycloak `sub` без маппинга). В UI список для массовой отправки режется на пакеты (размер чанка в `systemGafInstructionPreview.ts`, `BULK_SEND_CHUNK_SIZE`).
- `GET /api/v1/desktop/admin/system-gaf/broadcast-preview` — оценка числа получателей (без системных аккаунтов и GAF-бота).
- `POST /api/v1/desktop/admin/system-gaf/send-broadcast` — поставить в очередь Celery массовую рассылку текущего шаблона; тело `{ "confirm": "SEND_INSTRUCTION_TO_ALL_USERS" }` (строка должна совпадать с константой на бэкенде). Прогресс — в логах воркера (`api.tasks.system_gaf_broadcast.broadcast_instruction_to_all_users`). В логах старта/завершения фиксируется `admin_user_id` инициатора. Повторная рассылка снова шлёт сообщение всем подходящим пользователям, в том числе тем, кто уже получал инструкцию.

Код: `shared/api/routers/system_gaf_admin.py`, Celery — `shared/api/tasks/system_gaf_broadcast.py`, валидация компонентов — `shared/api/gaf_chat/system_gaf_instruction.py`.

**Заметка (asyncpg):** вставка `gaf_messages.metadata` (JSONB) в `GafChatService.send_message` идёт через `json.dumps(...)`, иначе Celery/воркер падает с `expected str, got dict` и рассылка даёт `sent=0`.

**Заметка (Socket.IO):** `AsyncServer` в `api/routers/socketio_handler.py` использует `socketio.AsyncRedisManager` (тот же Redis, что и `get_connection_string("redis", "0")`), чтобы `emit` из **Celery** доходил до клиентов, подключённых к процессу **API**. Без message queue событие «новое сообщение» из фоновой задачи не приходит в браузер в реальном времени (сообщение при этом есть в БД и появится после обновления списка/чата).

## Миграции

- `system_gaf_instruction`, `users.onboarding_gaf_sent_at`, `gaf_messages.metadata` — см. `shared/api/migrations/applied/20260412_system_gaf_onboarding.sql`, применение через `shared/api/migrations/apply_migrations.sh`.

## Фронт

- Админка: раздел **«GAF: инструкции»** в боковом меню (`UnifiedAdminPage`, `section=gaf`), контент — `shared/web/frontend/src/pages/Admin/SystemGafInstructionSection.tsx` (лениво подгружается при входе в раздел). Загрузка шаблона и оценки рассылки через TanStack Query (`staleTime`, без лишнего refetch при фокусе окна). Предпросмотр итогового plaintext строится на клиенте (`systemGafInstructionPreview.ts`, синхронно с `build_instruction_body_and_metadata` в API); отображение через `useDeferredValue`, чтобы не блокировать ввод. Есть массовая вставка UUID с чанкированием и опциональный dry run, **экспорт/импорт шаблона в JSON** (файл — резервная копия и перенос между средами; после импорта нужен **Сохранить**), дублирование шага, копирование предпросмотра и `task_id`, горячая клавиша **Ctrl+S / Cmd+S** для сохранения, уведомления Sonner.
- Десктоп: контекст `DesktopGafActionsContext` (`openAppByComponent` с `forceNew`), рендер кнопок в `GAFChatApp` для входящих от системного партнёра с `metadata.kind === 'onboarding_instruction'`.

### Структурированное тело и метаданные (v2)

- В **`gaf_messages.metadata`** (JSONB) для типа `onboarding_instruction` могут быть поля **`welcome_text`**, **`thanks_text`** и список шагов; API собирает их в `shared/api/gaf_chat/system_gaf_instruction.py` (`build_instruction_body_and_metadata`). Текст пузыря по-прежнему **plain text**; структура нужна клиенту для пошагового UI.
- При **массовой отправке** (`POST .../system-gaf/send`) тело и метаданные шаблона строятся **один раз** до цикла по UUID (без повторных вызовов на каждого пользователя).
- Нормализация `metadata` при чтении из БД: `shared/api/gaf_chat/message_metadata.py` (`message_metadata_dict_from_db`), использование в `GafChatService.list_messages`.
- В чате: **`GafChatOnboardingStructuredBody.tsx`** — один блок приветствия + благодарности + шаги; **кнопка открытия приложения** под каждым шагом (если есть `open_app_component` и провайдер `DesktopGafActions`). Сообщения **без** `welcome_text`/`thanks_text` отображаются в **режиме совместимости** (кнопки действий внизу пузыря, как раньше). Подсказка «только рабочий стол», если провайдера нет: i18n `gafChat.onboardingDesktopOnlyHint`.
- Тесты: `shared/api/tests/test_system_gaf_instruction.py` (поля в метаданных и сборка шаблона).

## Ручная проверка

1. Применить миграцию, перезапустить API и Celery worker.
2. В админке сохранить шаблон → «Отправить себе» → в GAF видны текст, ссылки `https://` и кнопки шагов.
3. Клик по кнопке открывает приложение в **новом** окне.
