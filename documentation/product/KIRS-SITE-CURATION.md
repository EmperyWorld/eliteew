# КИРС (курирование и разработка сайта)

## Назначение

- **Оператор (агентство):** desktop-приложение `KirsCuration` — список маркетинг-проектов, где у пользователя есть права ведущего; создание **одного** Site Studio runtime на проект (`project_site_instances`), выбор шаблона (`olenti` / `allenti` / `aurelia`), provision/start/stop/redeploy, настройка **доступа клиента** (`client_access_json`: публичная витрина, встраивание админки).
- **Клиент (представитель заказчика):** приложение `KirsClientSite` (в UI — **«Мой сайт»**) — проекты как в кабинете заказчика; вкладки **витрина** / **админка** при выданном доступе (`client_access_json`). В панели приложения — кнопка **Развернуть** / **Восстановить**, дублирующая разворот окна на область рабочего стола.

**Living public host (2026-07-18):** витрина КИРС — `{slug}-site.eliteew.ru` (edge → Meet WG → prod-core `:29000`). Legacy `*.sites.eliteew.ru` deferred; `*.sites.empery.world` not living. Admin only inside Desktop on `app.eliteew.ru`. Shared Site Studio canon: [SITE-STUDIO.md](SITE-STUDIO.md), ops: [INTERNAL-SITES-ACCESS.md](../platform/docker-re_doc/INTERNAL-SITES-ACCESS.md).

## Операторские кнопки (простые формулировки)

В панели КИРС для куратора runtime-действия синхронизированы с Site Studio и используют простой язык:

- `Подготовить сайт` (ранее `Provision`)
- `Запустить сайт` (ранее `Start`)
- `Поставить на паузу` (ранее `Stop`)
- `Обновить сайт` (ранее `Redeploy`)
- `Открыть публичную витрину`
- `Открыть админку (Desktop)`

Для каждой кнопки добавлен подробный tooltip без технического жаргона.

С 2026-05-27 в «Консоли» КИРС добавлены runtime-guardrails:

- кнопки `Запустить сайт`, `Поставить на паузу`, `Обновить сайт` и `Подготовить сайт` автоматически блокируются в неподходящих состояниях (pending-операция, уже запущен/остановлен и т.п.);
- добавлен блок **«Операционный статус»** (`runtime/api/public/visibility`) с краткой подсказкой «следующий шаг» для оператора;
- tooltip кнопок теперь динамический: при disabled-состоянии показывает конкретную причину (например, «Сайт уже запущен» / «Сначала запустите сайт, затем обновляйте его»);
- причины disabled теперь выводятся и отдельным текстовым списком под runtime-кнопками (не только через hover tooltip), чтобы это работало на touch/keyboard сценариях;
- блок причин рендерится через общий Desktop-компонент `pages/Desktop/components/RuntimeDisabledActionsHintCard.tsx` (тот же компонент используется в Site Studio);
- если несколько действий недоступны по одной и той же причине (например, pending), компонент автоматически группирует их в одну строку (`Действие A / Действие B: причина`), чтобы сократить визуальный шум;
- для прозрачности добавлен переключатель «Показать подробный список» / «Скрыть подробный список», который раскрывает причины по каждому действию отдельно;
- в compact режиме label переключателя показывает число скрытых подробностей (`Показать подробный список (N)`);
- переключатель доступен для скринридеров через `aria-expanded` + `aria-controls` на блок подробностей;
- состояние переключателя подробностей сохраняется в `sessionStorage` (ключ `kirs.runtimeDisabledReasons.showDetailed`) и восстанавливается в рамках текущей браузерной сессии;
- если причины перестают группироваться (toggle больше не нужен), expanded-предпочтение автоматически сбрасывается, чтобы при следующем появлении grouping карточка открывалась предсказуемо в compact-режиме;
- переключение подробного режима отправляет desktop telemetry-событие `runtime_disabled_reasons_toggle` (surface=`kirs`) с агрегатами `raw/collapsed/hidden` для анализа реального использования;
- поведение карточки покрыто component-тестом `pages/Desktop/components/__tests__/RuntimeDisabledActionsHintCard.test.tsx` (toggle, grouped summary, remount persistence);
- список причин помечен `aria-live="polite"` для мягкого a11y-анонса при переходах между runtime-статусами;
- список причин и подробный список рендерятся как семантические `ul/li`, чтобы screen reader корректно озвучивал навигацию по элементам списка;
- details-регион теперь имеет стабильный DOM-id даже в collapsed состоянии (`hidden`), чтобы `aria-controls` всегда ссылался на существующий узел;
- details-регион оформлен как отдельный landmark (`section`), в expanded состоянии доступен как `region` с именем "Подробно по действиям";
- строки подсказок визуально разделяют «действие» и «причину» (action-prefix выделен), а в заголовке карточки показывается компактный счётчик сгруппированных причин;
- раскрытый details-блок дополнительно выделяется мягкой рамкой/фоном, чтобы оператор быстрее считывал границу между compact и detailed режимами;
- если в строке несколько действий (`A / B / C`), action-prefix рендерится как набор compact chips; это уменьшает визуальный шум в grouped pending/busy сценариях;
- в header рядом со счётчиком grouped-причин показывается дополнительный индикатор скрытых деталей (`+N`), когда доступен подробный режим;
- счётчики в header/details теперь подписаны текстом (`Причин`, `Скрыто`, `Строк`) — цифры больше не «немые», оператор быстрее считывает смысл бейджей;
- summary/details списки теперь отрисовываются как «ряд карточек» (каждая причина в отдельной bordered row), что повышает читаемость при длинных reason-текстах;
- в раскрытом details-panel добавлен явный числовой индикатор количества строк, чтобы оператор сразу видел объём подробного списка;
- для длинных списков причин включён внутренний скролл (summary/details), чтобы runtime-карточка не «раздувала» консоль и сохраняла быстрый доступ к кнопкам действий;
- при включённом скролле показываются текстовые helper-подсказки «прокрутите список…», а список становится keyboard-focusable, чтобы пролистывать причины без мыши;
- в scroll-режиме добавлены edge-индикаторы «Выше есть строки» / «Ниже есть строки»: они динамически показывают, где ещё есть скрытые пункты, и затухают на границах списка;
- в scroll-режиме поверх списков добавлены мягкие fade-mask на верхней/нижней кромке: переполнение считывается быстрее даже периферийным зрением;
- для операторской консоли КИРС включён усиленный режим fade-mask (`strong`), чтобы границы длинных списков заметнее читались на плотной панели действий;
- для runtime-карточки КИРС включена плотная компоновка строк (`rowDensity=compact`), чтобы в пределах той же высоты экрана помещалось больше причин блокировки;
- для compact-layout порог включения внутреннего scroll повышен до 5 строк (`scrollThreshold=5`), чтобы карточка реже «ломала» чтение коротких списков;
- при scrollable details-списке показывается компактный sticky-subheader (название + число строк), чтобы контекст «что именно сейчас листаем» не терялся во время прокрутки;
- detail-toggle карточки дополнен SR-only `aria-live` анонсом («раскрыт/свернут»), чтобы скринридер явно подтверждал смену режима списка;
- sticky-subheader details-списка получает мягкую тень при прокрутке вниз, чтобы активное «мы внутри длинного списка» читалось быстрее без дополнительных подсказок;
- SR-only анонс detail-toggle использует русскую plural-логику для количества строк (`строка/строки/строк`) и проговаривает размер подробного списка без грамматических артефактов;
- grouped/hidden count-индикаторы в header дополнены SR-only семантическим текстом (formatter callbacks), чтобы скринридер озвучивал и число сгруппированных причин, и число скрытых подробностей с корректной грамматикой;
- `instance` в UI теперь опрашивается каждые ~4 секунды, пока статус в переходном состоянии (`provisioning|starting|redeploying|stopping`), чтобы интерфейс быстрее отражал завершение операции без ручного refresh.
- логика guardrails вынесена в `pages/Kirs/kirsRuntimeGuards.ts` и покрыта unit-тестами `pages/Kirs/kirsRuntimeGuards.test.ts` (регресс на pending/running/busy/public-health сценарии).

С 2026-05-29 backend стал источником истины для lifecycle safety и операторской диагностики:

- `provision/start/stop/redeploy/destroy` создают durable `site_studio_lifecycle_jobs` с `job_id`, стадией, attempts, worker id, duration и ошибкой;
- health endpoint `GET /projects/{project_id}/instance/health` отдаёт `worker_ready`, freshest heartbeat, `pending_job` и `last_job`;
- UI-консоль показывает блок **«Фоновые задачи»**: готовность исполнителя, текущая задача, последняя ошибка и `job_id` для поддержки;
- backend возвращает явные `409/503` для pending-дубликатов, невозможных переходов, отсутствующего compose metadata и неготового worker до изменения статуса инстанса;
- health endpoint запускает stale-job reaper для зависших `created|queued|running`, а операторские endpoints `.../jobs/{job_id}/cancel|retry` позволяют отменить или повторить stuck runtime-задачу (кроме destroy);
- общий proxy-код вынесен в `site_studio_admin_proxy.py`, но авторизация остаётся в `kirs.py` (проект/клиентский доступ) и не смешивается с публичным gateway.

С 2026-05-29 КИРС также поддерживает MVP внутренних доменов для уже купленных hostnames:

- API: `/api/v1/desktop/kirs/projects/{project_id}/instance/domains/*` — список, создание, TXT-проверка владения, запрос internal DNS route, activation после TLS-ready, disable.
- UI-блок **«Внутренний домен»** живёт в консоли проекта рядом с runtime-действиями и показывает TXT имя/значение, status и `tls_status`.
- Авторизация остаётся operator-only через `_require_project_instance_for_operator`; клиентский `client-access` не даёт права управлять domain bindings.
- Public gateway ищет активный custom domain перед fallback на `public_hostname`, но `/admin/*` и Desktop/admin APIs остаются недоступны на custom host.

С 2026-05-29 КИРС получил handoff/collaboration слой в общем Site Manager Ops API:

- API: `/api/v1/desktop/site-manager/ops/kirs/projects/{project_id}/collaboration`.
- Состояние хранится в существующем `project_site_instances.client_access_json`: `site_readiness_status`, `site_approval_status`, `site_operator_notes`, `site_handoff_checklist`.
- Операторская консоль КИРС показывает блок **«Клиентская готовность»**: `preparing`, `ready_for_review`, `published`, `paused`, approval (`not_requested|requested|approved|changes_requested`) и notes.
- Handoff checklist привязывается к конкретному project site instance, а не к общим комментариям проекта; выдача admin embed по-прежнему управляется отдельным `allow_admin_embed`.
- Hardening wave: клиентский `GET /client/projects/{project_id}/site` теперь отдаёт только безопасные поля readiness/approval/client feedback без worker/jobs/DNS internals, а клиент может выполнить `POST /client/projects/{project_id}/site/approval` с `approve` или `request_changes`.
- `PATCH .../client-access` больше не включает `allow_admin_embed=true`, пока handoff checklist не заполнен и не завершён; это сохраняет operator-controlled grant.

## Полноценный выбор шаблона в «Менеджере сайтов»

В экране создания инстанса КИРС выбор шаблона переведён с базового dropdown на карточный selector:

- отдельные карточки `Olenti`, `Allenti` и `Aurelia`;
- краткое описание сценария использования у каждой карточки;
- явное состояние «Выбрано»;
- нижний блок «Что вы получите» с ключевыми возможностями выбранного шаблона.

Это снижает риск случайного выбора «по названию» и помогает оператору понять разницу до запуска runtime.

### Шаблон `Aurelia` (новый полноценный вариант)

- `Aurelia` подключён как отдельный `template_key` и доступен в выборе КИРС.
- При **первом** успешном `provision/start/redeploy` backend применяет профиль `aurelia-v1`:
  - обновляет `admin/site-settings` (включая `defaultTheme`);
  - записывает готовый стартовый набор контент-блоков через `PUT /content/blocks/bulk`.
- Профиль помечается в `brief_json` (`_site_template_profile`), поэтому повторные запуски не перетирают ручные правки контента.

## API

- Префикс: `/api/v1/desktop/kirs/`
- Оператор: `GET /operator-projects`, `GET|POST|PATCH|DELETE .../projects/{project_id}/instance`, runtime-действия как у Site Studio (`/provision`, `/start`, …), `PATCH .../client-access`.
- Домены проекта: `GET|POST .../projects/{project_id}/instance/domains`, `POST .../domains/{binding_id}/verify|request-route|activate|disable`.
- Site Manager Ops: `/api/v1/desktop/site-manager/ops/*` — operator overview, reconcile, smoke, DNS/TLS outbox and KIRS collaboration state.
- **Админка шаблона (как у личного Site Studio):** `POST .../projects/{project_id}/instance/admin-session`, прокси API runtime `.../projects/{project_id}/proxy/{path}` — доступ, если пользователь видит проект в маркетинге **и** (ведущий/владелец/команда по правилам `get_accessible_project`) **или** включено `allow_admin_embed` в `client_access_json`. Прямой `/admin` на `{slug}-site.eliteew.ru` (и на любом legacy Host) по-прежнему не используется.
- Клиент: `GET /client/projects/{project_id}/site` — контекст без секретов админки (URL витрины по флагам, `admin_embed_available`, readiness/approval state); `POST /client/projects/{project_id}/site/approval` — approve/request changes.
- Удаление: `DELETE .../instance?preserve_runtime_data=true` — остановить compose **без** `--volumes` и **без** удаления каталога runtime на диске (bind-монты сохраняются).

## База

- Миграция: `shared/api/migrations/applied/20260404_project_site_instances_kirs.sql`
- Каталог приложений: `20260404_desktop_app_catalog_kirs.sql`; переименование в каталоге БД: `pending/20260409_desktop_app_kirs_client_site_rename.sql` (**«Мой сайт»**).

## Публичный шлюз `{slug}-site.eliteew.ru`

- Шлюз в `shared/api/routers/site_studio_public.py` резолвит runtime по **`Host`** и `public_hostname` и для **пользовательских** (`user_site_instances`), и для **КИРС** (`project_site_instances`). Иначе витрина по HTTPS давала бы **404**, хотя контейнер поднят. Living product Host: `{slug}-site.eliteew.ru` (cert `*.eliteew.ru`); legacy `*.sites.eliteew.ru` deferred; `*.sites.empery.world` not living.
- Публичный HTTPS-путь: edge → **Meet WG** `10.77.77.2:29000` (primary) → gateway; SSH reverse = reserve — [WG-HTTP-BACKHAUL-PRIMARY.md](../platform/docker-re_doc/WG-HTTP-BACKHAUL-PRIMARY.md).
- Встраивание витрины в iframe с `app.eliteew.ru` требует **`CSP_FRAME_EXTRA`** (и при необходимости `CSP_CONNECT_EXTRA`) на фронте: origin витрины `https://*-site.eliteew.ru` или конкретный хост — см. `platform/FRONTEND-SECURITY-NGINX-STATIC.md`, `docker/builders/stack0-frontend/docker-entrypoint-csp.sh`.
- Ответ публичного шлюза для HTML задаёт **`Content-Security-Policy: frame-ancestors 'self' <USER_SITE_STUDIO_ADMIN_APP_URL>`** (`site_studio_public.py`), чтобы витрину можно было встроить с приложения. На хостовом nginx для site product hosts не должен добавляться **`X-Frame-Options: SAMEORIGIN`** (иначе кросс-ориджин iframe с десктопа блокируется) — в репозитории для site vhosts его нет, см. `docker/host_conf/nginx-app-https.conf`.

## Код

- Модель: `ProjectSiteInstance` в `shared/api/models/desktop.py`
- Роутер: `shared/api/routers/kirs.py`
- Runtime: `SiteStudioRuntimeManager` принимает `UserSiteInstance | ProjectSiteInstance`; очередь Celery/RabbitMQ передаёт `instance_scope: project` в `execute_site_studio_runtime_task`
- Lifecycle evidence: `site_studio_lifecycle_jobs.py` + `site_studio_lifecycle_policy.py`; queue payload содержит `job_id`.
- Фронт: `shared/web/frontend/src/pages/Kirs/` — stable facade `KirsPage.tsx` (named + default re-export) + implementation `kirsPage/` (`useKirsPage`, section panels, constants); siblings `KirsClientSitePage`, `KirsSiteStudioAdminPanel`, `kirsRuntimeGuards`, `kirsCurationGuideConstants`; `services/api/siteStudioProxy.ts` (scope прокси на КИРС), `features/kirs/kirsApi.ts`

## Site Studio runtime и контент

Встроенная админка (вкладка «Админка») ходит в **тот же** olenti-совместимый runtime, что и личный Site Studio: прокси `.../projects/{project_id}/proxy/*`. Структура страниц/секций для экрана «Контент» и подсказки «где на сайте» задаются в runtime (`GET /content/structure`, см. **`product/SITE-STUDIO.md`** — раздел Olenti и контракт `content/structure`). Шаблон `olenti` в `site-templates/` — исходник; `allenti`/`aurelia` используют совместимый runtime-контур, а различия задаются template key и стартовым профилем контента.

### Сетевой контур и изоляция

- Runtime каждого КИРС-сайта изолирован в собственном compose-`default` сегменте (контейнеры проекта не шарят его с другими сайтами).
- Дополнительная служебная сеть (`eliteew-shared`) используется только для платформенного доступа API/worker к runtime (health/proxy/admin-session).
- Полностью убрать runtime из служебной сети сейчас нельзя без изменения архитектуры Desktop-proxy: это сломает встроенную админку и фоновые операции синхронизации.

## Полная сводка выполненной работы по КИРС (май 2026)

Ниже — консолидированная документация по фактически завершённым улучшениям в контуре **КИРС + Site Manager**.

### 1) Продуктовая модель КИРС

- Закреплён один runtime-инстанс Site Studio на маркетинг-проект (`project_site_instances`).
- Разделены контуры:
  - **оператор** (`KirsCuration`) управляет lifecycle и доступами;
  - **клиент** (`KirsClientSite` / «Мой сайт») получает только разрешённые витрина/админка сценарии.
- Клиентский доступ управляется через `client_access_json` (public/admin embed флаги).

### 2) Полный UX-pass по operator runtime-panel

- Runtime-кнопки и copy унифицированы с Site Studio (`Подготовить`, `Запустить`, `Пауза`, `Обновить`).
- Добавлена семантика «операционного статуса» (что сломано и какой следующий шаг).
- Внедрены guardrails по state/pending/busy, а не только по общей «занятости».
- Подсказки о недоступных действиях вынесены в явную карточку причин (в т.ч. для touch/keyboard).
- Добавлен detailed режим причин с группировкой, sticky-подзаголовком, скролл-индикаторами, plural-aware SR-озвучкой, telemetry по toggle.
- Настройки отображения причин сохраняются в пределах сессии и корректно сбрасываются при исчезновении grouping.

### 3) Выбор шаблонов и профиль `aurelia`

- Selector шаблона в КИРС переведён в карточный режим (осознанный выбор вместо «чистого dropdown»).
- Поддержаны ключи `olenti` / `allenti` / `aurelia`.
- Для `aurelia` реализован one-time профиль `aurelia-v1` (site settings + стартовые блоки + marker в `brief_json`).

### 4) Контур очередей и обязательный воркер

- Runtime-задачи КИРС (`site_studio_provision|start|stop|redeploy|destroy`) идут через queue handler с `instance_scope=project`.
- Payload runtime-задачи содержит `job_id`; worker пишет heartbeat и stage evidence в БД до/после выполнения.
- Критичный инвариант эксплуатации:
  - queue key `site_studio` обслуживает **только** профильный `eliteew-site-studio-worker-prod`;
  - `stack0-eliteew-api-worker-prod` не слушает `site_studio` key.
- Если профильный воркер не поднят, lifecycle КИРС-сайтов может застревать в промежуточных состояниях.

### 5) Диагностический кейс 503/404 (кейс `kirs-41b1c202-site`)

Зафиксирован реальный production-сценарий:

1. Публичный домен давал `503 Site temporarily unavailable`.
2. В записи проекта был `status=starting` при пустых `compose_project_name/compose_file_path`.
3. После запуска профильного воркера `site_studio_start` отработал успешно.
4. После этого отдельный queued `site_studio_destroy` удалил инстанс.
5. Домен перешёл в `404 Not Found` (инстанс отсутствует в `project_site_instances`).

Что это означает для оператора:

- `503` и `404` по KIRS-витрине — это не одно и то же:
  - `503`: инстанс есть, но runtime/public-proxy недоступен;
  - `404`: запись инстанса отсутствует или закрыта.
- После неожиданного `destroy` требуется **пересоздание** инстанса, а не повторный `start`.

### 6) Runbook восстановления для КИРС

1. Убедиться, что запущен `stack0-eliteew-site-studio-worker-prod`.
2. Проверить `GET /api/v1/desktop/kirs/projects/{project_id}/instance`.
3. Если инстанса нет — создать заново и выбрать шаблон.
4. Выполнить `Подготовить сайт` → `Запустить сайт`.
5. Проверить:
   - `instance.status == running`;
   - public URL отвечает 200;
   - `instance/health` по API без ошибок.
6. При повторном удалении — проверить, откуда приходит `site_studio_destroy` (операторская кнопка, автоматизация, очередь).

### 7) Проверка после релизов КИРС/Менеджера сайтов

- UI smoke:
  - кнопки runtime корректно блокируются/разблокируются;
  - карточка причин отражает pending/busy/state mismatch;
  - detailed toggle и SR-озвучка работают.
- Backend smoke:
  - очередь `site_studio` обслуживается профильным воркером;
  - `provision/start/redeploy` не уходят в бесконечный `starting`.
- Public smoke:
  - витрина доступна по `https://{slug}-site.eliteew.ru`;
  - `/admin` на публичной витрине недоступен напрямую, админка только через Desktop embed.
