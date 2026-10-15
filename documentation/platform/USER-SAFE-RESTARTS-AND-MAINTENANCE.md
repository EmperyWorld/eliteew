# User-safe restarts and maintenance windows

**Статус:** канон (2026-05-27).

Документ фиксирует контракт и операторский процесс безопасных перезапусков EliteEW: пользователь заранее видит спокойное окно обслуживания, во время рестарта не получает пачку ошибок, а после восстановления проходит контролируемое обновление вкладки.

## Цель

Перезапуск `stack0` не должен выглядеть для пользователя как авария: исчезла связь, посыпались уведомления, открылся пустой рабочий стол. Канонический путь — единое maintenance-состояние, которое читают deploy scripts, API, Socket.IO, frontend и edge fallback.

## Контракт `MaintenanceWindow`

Публичный endpoint:

- `GET /api/v1/system/maintenance`

Admin endpoints:

- `POST /api/admin/system/maintenance/schedule`
- `POST /api/admin/system/maintenance/phase/{phase}`
- `DELETE /api/admin/system/maintenance`
- `GET /api/admin/system/maintenance/defaults` — Postgres defaults + rendered preview for stack0 release
- `PUT /api/admin/system/maintenance/defaults` — notice/downtime (seconds) + title/templates

Основные поля:

- `id`, `kind`: тип окна (`stack0_restart`, `frontend_deploy`, `api_restart`, `workers_restart`, `full_maintenance`, `emergency`).
- `phase`: `scheduled`, `warning`, `draining`, `active`, `recovering`, `completed`, `cancelled`.
- `starts_at`, `expected_ends_at`, `notice_before_seconds`, `retry_after_seconds`.
- `title`, `message`, `user_impact`: пользовательский текст без внутренних имён контейнеров и стеков.
- `suppress_error_toasts`, `block_new_long_jobs`, `allow_operator_bypass`.

**Release defaults (Postgres):** таблица `system_maintenance_deploy_defaults` (singleton `id=1`). Seed: notice **600с** (10 мин), expected downtime **120с** (2 мин). Шаблоны `message_template` / `user_impact_template` подставляют `{notice_minutes}`, `{downtime_minutes}`, `{starts_at_local}`, `{ends_at_local}` (часовой пояс `ELITEEW_OPERATOR_TZ` / `TZ`, иначе `Asia/Vladivostok`). Админка: System → Planned maintenance → «Параметры релиза».

**Честное окно времени:** `starts_at = now + notice` в момент **публикации warning** (старт release, до bake/export); `expected_ends_at = starts_at + downtime`; `retry_after_seconds = downtime`. **Notice ≠ idle pad:** bake/export идут параллельно с warning; перед recreate скрипт спит только `max(0, starts_at − now)`. Если сборка съела lead time — recreate сразу, без дополнительных 10 минут простоя.

Фазы `draining` и `active` включают HTTP gate: защищённые `/api/*` получают `503` JSON с `code=maintenance` и HTTP `Retry-After`. Health, auth, `/api/version`, `/api/v1/system/maintenance`, admin maintenance endpoints и Socket.IO не блокируются.

## Источники состояния

Runtime-источник:

- Redis key `eliteew:maintenance:window:v1`, управляется API service **и** stack0 release ctl (`api/scripts/maintenance_deploy_ctl.py` via `podman exec`, без admin OAuth).

Fallback-источник:

- `shared/web/frontend/dist-build/maintenance-state.json`, пишет stack0 release (`eliteew-deploy.sh` → implementer `eliteew-stack0-baked-deploy.sh` / `eliteew-maintenance-window.sh`).
- API читает этот файл через `ELITEEW_MAINTENANCE_STATE_FILE` (default `/app/frontend-dist/maintenance-state.json`).
- Frontend в штатном режиме сначала читает `GET /api/v1/system/maintenance`. Static `/maintenance-state.json` читается только если API maintenance недоступен, чтобы понимать planned downtime при недоступном API без постоянного browser-console `404` в здоровом runtime.

## Операторский процесс

**Default (release `--all`):** user-visible maintenance **включён** автоматически. Notice и expected downtime берутся из Postgres (`system_maintenance_deploy_defaults`); code fallback **600с** notice / **120с** downtime. Window id `deploy-<BAKED_TAG>`, `source=stack0-baked-deploy`. CLI `--notice-seconds` / `--duration-seconds` перекрывают DB. **`--notice-seconds` = lead time до advertised `starts_at`**, не «поспи N секунд после export».

```bash
bash docker/scripts/eliteew-deploy.sh release stack0 --all --yes
# publish warning early → bake/export overlap notice → wait remaining until starts_at → recreate
```

Opt-out:

```bash
bash docker/scripts/eliteew-deploy.sh release stack0 --all --yes --no-maintenance
```

Emergency без user lead time (recreate ASAP after export):

```bash
bash docker/scripts/eliteew-deploy.sh release stack0 --all --yes --notice-seconds 0
```

Override downtime estimate:

```bash
bash docker/scripts/eliteew-deploy.sh release stack0 --all --yes --duration-seconds 180
```

**Redis sync (не admin HTTP):** `eliteew-maintenance-window.sh` грузит defaults через `maintenance_deploy_ctl.py print-defaults`, пишет JSON **и** вызывает ctl в живом API-контейнере (argv через JSON-файл — без bash-ломания RU copy с `(~N мин)`). Фазы: upsert warning (рано) → set-phase active/recovering → completed/clear-if-owned. Чужое admin-окно (`source` не deploy-owned) **не перезаписывается**. На первом релизе после появления кода скрипт может inject'ить ctl + `maintenance_deploy_defaults.py` (+ schemas/service) в running container для side-car process.

**Clear после старта API:** lifespan снимает Redis-окно только если `source` deploy-owned **и** phase ∈ `{active, recovering}` — admin schedule / mid-notice `warning` не трогаются. Deploy после smoke также делает `completed` + `clear-if-owned`.

**stack0 baked:** implementer `eliteew-stack0-baked-deploy.sh` (historical `dewa-ops` prefix). Canon entrypoint: `eliteew-deploy.sh release stack0 --all`.

Фазы maintenance window:

1. `warning`: публикуется **в начале** release (Redis + `maintenance-state.json`); bake/export продолжаются; пользователи видят lead time (~10 мин по умолчанию) с абсолютными `starts_at`/`expected_ends_at`. Перед recreate — sleep только остатка до `starts_at`.
2. `active`: выполняется disruptive часть (`stack0` recreate); HTTP gate 503 на protected `/api/*`.
3. `recovering`: API health уже проверяется, UI ждёт восстановления.
4. `completed` / clear: клиенты получают спокойное завершение и controlled reload.

Один `id` на все фазы одного окна (`deploy-<tag>`), иначе браузеры воспримут каждую фазу как новое обслуживание.

## Frontend UX

Frontend слушает четыре источника:

- `GET /api/v1/system/maintenance`
- static `/maintenance-state.json`
- Socket.IO event `system.maintenance`
- HTTP `503 { code: "maintenance" }`

Поведение:

- `warning/scheduled`: верхний спокойный баннер и одна persistent-запись в notification center; Sonner toast показывается максимум один раз на стабильный `MaintenanceWindow.id`, а смена phase внутри окна не создаёт новые toasts.
- `draining/active/recovering`: единый technical-state overlay EliteEW поверх существующего **Безраздельного мира**; React root не размонтируется.
- `completed`: на `#desktop` — soft recovery (`requestMaintenanceReturn` → `performDesktopSoftRecovery`); на остальных маршрутах — один controlled reload через stale-bundle coordinator.
- Пока maintenance status активен, stale-bundle/deploy-version watcher и Socket.IO `client_stale` не делают hard reload. Они ждут завершения окна, чтобы пользователь не попал в цикл перезагрузок между frontend/API recreate.
- Во время maintenance и upstream 502/503/504 **не** показываются параллельные error-toast (React Query, axios interceptor, `unhandledrejection`): один recovery overlay + одна persistent-запись в notification center. Gate: `recoveryNotificationGuard.ts` + `suppress_error_toasts` на окне.
- Auto-reload координируется через `staleBundleReload.reloadAllAppTabs`: cooldown между автоматическими reload, defer во время maintenance/OAuth, один reload на `maintenance_completed` per window id (`markMaintenanceCompletionReload`) **после** успешных `/api/v1/system/maintenance` + `/api/health`. **Reload circuit breaker** (`reloadCircuitBreaker.ts`): каждая hard-navigation с `_eliteew_reason` (кроме `manual_*`) пишется в session ledger; после **2** auto-reload за 15 мин — **hold** (wait-only recovery, без новых reload). Prod deploy id — **`startDeployVersionWatcher`** (`mainFullApp.ts`, poll `/app-build-version.txt`); **`versionCheck`** — только read-only sync `/api/version` metadata, без auto-reload (не монтируется в `App.tsx`).
- API/socket ошибки maintenance не запускают Keycloak login и не создают серию `notify.error`.
- Все maintenance/preloader/fallback состояния используют одинаковый визуальный язык EliteEW: тёмное стекло и кислотно‑светло‑зелёный accent без внутренних имён стеков.
- **Четыре категории UI (один winner на категорию):**
  - **A. Boot preloader** — короткая загрузка (`ElitePreloaderPanel`): spinner, `EliteEW`, progress-scale, цитата; без product footer.
  - **B. Recovery waiting** — maintenance/handoff/reconnect (`EliteRecoveryScreen`): тот же preloader-стиль, опциональная одна кнопка действия, **статическая** цитата по умолчанию (без 7s rotation — GPU budget на long-lived wait); **без** product footer `po&T && TZBrand`.
  - **C. Actionable error** — crash, tab conflict, stale bundle manual (`EliteTechnicalState`): пояснение + кнопки; product footer **да**.
  - **D. In-window** — lazy load внутри desktop-окна (`DesktopAppPanel` + accent spinner + i18n); без fullscreen overlay.
- Подпись product authorship (`po&T && TZBrand`) показывают **только** категория C. На всех экранах с цитатой historical author (`cite`) обязателен (`EliteQuoteBlock`).
- Каталог цитат: `shared/web/frontend/src/components/ui/eliteQuotes/catalog/*.json` (категории `strategy`, `perseverance`, `leadership`, `discipline`; **16** записей на файл, **≥60** суммарно). **Recovery/waiting (категория B):** React SPA — **без** ротации по умолчанию (`quoteRotationIntervalMs=0`, `ambientStatic`); opt-in только для коротких overlay. Static `#app-preloader` / host nginx `eliteew-maintenance.html` могут по-прежнему крутить цитаты через `preloader-fallback.js` / `/elite-quotes-inline.js` (**7 с**) — это короткие/вне-SPA surfaces. На `#desktop` при gate: inline `DesktopMaintenanceOverlay` + taskbar chip; soft recovery без hard reload (`performDesktopSoftRecovery`).
- Стартовый HTML preloader показывает только один бренд `EliteEW`, локально отданный кириллический quote font (`/fonts/elite-quote/...`) и короткую случайную цитату исторического лидера/полководца. Текст цитаты выводится тем же локальным кириллическим шрифтом повышенной жирности и контрастности; автор цитаты выводится отдельным sans-serif начертанием.
- Время минимального показа управляется `VITE_ELITEEW_PRELOADER_MIN_MS` (default `2000`, clamp `0..15000`) и применяется к статическому HTML preloader, стартовой загрузке Безраздельного мира, UGS Hub initial loading и reduced-motion варианту EWA opening preloader.
- Обычные короткие preloaders должны быть минимальными: spinner, `EliteEW`, шкала `0%..100%` с заполнением до `99%` за `3s`, затем только цитата чёрным жирным шрифтом и автор серым sans-serif. Product authorship, пояснения «что загружаем» и дополнительные footer-строки на категориях A/B не показываются.
- Статический `#app-preloader`, desktop lazy fallback и desktop storage loading shell должны выглядеть как один экран загрузки: одинаковая glass-card (`.elite-glass-panel` + `.elite-glass-panel-premium` — gradient wash + top hairline), progress-scale и quote-card. Lazy fallback не должен оставаться отдельной grid-only заставкой.
- Recovery/maintenance screens use **recovery** progress variant (indeterminate bar **frozen** under `.elite-recovery-ambient-static`, not live shimmer loops). Shared tokens: `.elite-maintenance-banner`, `.elite-maintenance-banner-enter`, `.elite-recovery-subtitle`, `.elite-recovery-footnote`, `.elite-recovery-status-pill`, `.elite-recovery-ornament`, `.elite-recovery-backdrop` (**opaque**, no `backdrop-filter`), `.elite-recovery-enter`. Glass panel under ambient-static drops `backdrop-filter` too. **Non-desktop:** maintenance overlay banner OR fullscreen recovery (not both). **`#desktop` gate:** только `DesktopMaintenanceOverlay` + taskbar chip (`DesktopTaskbarRecoveryChip`); глобальный `MaintenanceProvider` overlay скрыт. Host nginx fallback: `docker/host_conf/eliteew-maintenance.html` — ротация **7 с** через `/elite-quotes-inline.js`. «Проверить связь» checks `/api/health` before reload (`performRecoveryConnectionCheck`); busy state shows inline spinner on `EliteLimeActionButton`. Reload hold на `#desktop` **не** вызывает `detachAppReactRoot` (`showRecoveryHoldOverlay`).

Пользовательские дефолты:

- `title`: `EliteEW обновляет среду`
- `message`: `Безраздельный мир временно на технической паузе. Данные, окна и раскладка сохранены.`
- `user_impact`: `Оставьте вкладку открытой: Безраздельный мир восстановится автоматически, данные и раскладка сохранены.`

## Edge fallback

Хостовый nginx для `app.eliteew.ru` разделяет `/api/` и `/socket.io/` от SPA fallback:

- API и Socket.IO не перехватываются maintenance HTML, чтобы клиенты видели JSON/transport errors.
- SPA navigation при `502/503/504` получает `/eliteew-maintenance.html` с `Cache-Control: no-store` и `Retry-After: 60`; страница оформлена в том же EliteEW technical-state стиле и использует термин `Безраздельный мир`.
- Файл fallback лежит рядом с edge config: `docker/host_conf/eliteew-maintenance.html`; на edge его нужно развернуть в `/var/www/eliteew-maintenance.html`.
- Штатная доставка на edge: `bash docker/scripts/yandex-tunnel/deploy-nginx-app-to-vm.sh` копирует и nginx config, и `eliteew-maintenance.html`, затем выполняет `nginx -t` и reload.

## Blue/Green roadmap

Следующий уровень после базового maintenance UX:

- Два слота `stack0-blue` / `stack0-green` или минимум второй candidate API/frontend на отдельных локальных портах.
- Green поднимается и проходит health/build-id smoke до переключения.
- Edge upstream переключается только после green health.
- Blue остаётся в drain: новые подключения не идут в старый слот, существующие Socket.IO получают `system.maintenance` и reconnect/reload.
- Миграции только expand-contract: старый и новый код должны переживать одну схему БД на время переключения.
- Rollback: переключить upstream обратно на blue, если green health или browser smoke не прошёл.

## Проверка

Минимальный smoke:

```bash
curl -sf https://app.eliteew.ru/api/v1/system/maintenance
curl -I https://app.eliteew.ru/ | grep -Ei 'cache-control|retry-after|HTTP/'
```

Во время `draining/active`:

- API protected route возвращает `503` JSON с `code=maintenance`.
- UI не редиректит в Keycloak.
- Notification center содержит одну persistent-запись по окну.
- Desktop layout не очищается; после `completed` вкладка обновляется один раз.

## Связанные документы

- Living recovery/preloader policy is **this document** (dated music-evolution program full-summary → `trash/`)
- [platform/docker-re_doc/STACK-CONTAINER-CONTROL.md](docker-re_doc/STACK-CONTAINER-CONTROL.md)
- [platform/docker-re_doc/FRONTEND-STALE-CHUNK-404.md](docker-re_doc/FRONTEND-STALE-CHUNK-404.md)
- [platform/ELITEEW-RELEASE-CHECKLIST.md](ELITEEW-RELEASE-CHECKLIST.md)
- [platform/FRONTEND-SECURITY-NGINX-STATIC.md](FRONTEND-SECURITY-NGINX-STATIC.md)
