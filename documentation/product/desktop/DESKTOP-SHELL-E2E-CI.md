# Desktop shell: Playwright E2E (операторский контур)

Волны **12** и **16** плана desktop UI expansion + follow-up reliability automation + **Wave D (2026-07-18)** program closeout: смоук на аутентифицированном хосте (`#desktop-main`), runtime smoke profile, multi-tab shell-state 412 conflict/recovery, **widget outbox → `POST /widget-sync` journey**, центр управления, узкий Пуск. Не дублирует весь чеклист **`DESKTOP-SHELL-A11Y-CHECKLIST.md`**.

Канон состояния/синхронизации: **`DESKTOP-STATE-PERSISTENCE.md`** (Wave B outbox + Wave C shell_state SLI). API surface: **`DESKTOP-API-AND-APPS.md`**.

## Секреты и переменные GitHub Actions

| Имя | Тип | Обязательность | Назначение |
|-----|-----|----------------|------------|
| **`ELITEEW_DESKTOP_E2E_STORAGE_STATE_JSON`** | Secret | **обязателен** для прогона | Полное тело Playwright `storageState` после входа в приложение (Keycloak). Одна JSON-строка или pretty-printed multiline. Без секрета job **guard** пропускает прогон с предупреждением — секреты в репозиторий не коммитятся. |
| **`ELITEEW_UGS_ADMIN_E2E_STORAGE_STATE_JSON`** | Secret | опционально | Storage после входа **UGS admin** для strict specs `e2e/ugs-hub-admin-queue-ops.spec.ts`. Без секрета admin-тесты **skip** (не fail). |
| **`DESKTOP_SHELL_E2E_SCHEDULE_ENABLED`** | Variable | опционально | Значение **`true`** включает еженедельный cron (понедельник 05:30 UTC). Иначе scheduled workflow завершается skip в job **guard**. |
| **`ELITEEW_MC_E2E_BASE_URL`** | Variable | опционально | База для scheduled-запусков; если не задана — `https://app.eliteew.ru`. |

Публичные форки: секреты недоступны — job осмыслен только на доверенном репо / внутреннем GitHub.

**Агент не выставляет секреты.** Operator Acceptance (Wave D): secret + optional schedule variable + один успешный **`workflow_dispatch`**.

## Operator checklist — после major desktop/shell update

Использовать после релиза stack0, крупного refactor `pages/Desktop/**`, изменений `shell-state` / `widget-sync`, или смены auth/storage.

1. **Secret fresh?** Перезаписать **`ELITEEW_DESKTOP_E2E_STORAGE_STATE_JSON`**, если Keycloak-сессия в JSON протухла (типичный симптом: skip/`#desktop-main` timeout / redirect на login).
2. **Actions → `desktop-shell-e2e` → Run workflow** (`workflow_dispatch`): Base URL = целевой стенд (по умолчанию `https://app.eliteew.ru`).
3. Job **guard** = proceed; job **desktop-shell-e2e** = green. При fail — артефакт **`desktop-shell-e2e-playwright-report`**.
4. В отчёте убедиться, что прошли (не skip из-за gate):
   - `desktop-shell-smoke`
   - `desktop-shell-state-conflict`
   - **`desktop-widget-sync-outbox`** (Wave D journey)
   - **`desktop-shell-lifecycle-honesty`** (P17 offline/Start 2-col + P18 stalled app-chunk escalate via asset abort; P19 narrow Start opens **All apps** via `start-menu-tab-all`)
5. **Optional schedule:** Variables → **`DESKTOP_SHELL_E2E_SCHEDULE_ENABLED=true`** только когда weekly cron нужен на self-hosted runner.
6. **Manual UI spot-check (5 мин)** если CI недоступен:
   - Открыть стол → Widget shelf notes → offline (DevTools) → добавить заметку → увидеть local-only hint → online → sync chip без зависшего error; outbox `eliteew-desktop-widget-outbox-v1` пуст после 2xx.
   - Две вкладки: stale shell-state → chip «устарело» / Refresh (см. persistence §3.2.4).
7. **API narrow (command-center / CI parity):**
   `bash docker/scripts/run-stack0-api-tests.sh tests/ -k 'widget_sync or desktop_shell_state_metric' -q`

## Чеклист оператора (первичная настройка CI)

1. Убедиться, что в организации есть **self-hosted** runner с выходом в **`MC_E2E_BASE_URL`** (аналогично job **`openapi-pilots-refresh`**).
2. В репозитории GitHub: **Settings → Secrets and variables → Actions** — создать секрет **`ELITEEW_DESKTOP_E2E_STORAGE_STATE_JSON`** (полный JSON Playwright `storageState` после входа в приложение, см. блок «Локально» ниже).
3. При необходимости **еженедельного** прогона: **Settings → Secrets and variables → Actions → Variables** — **`DESKTOP_SHELL_E2E_SCHEDULE_ENABLED`** = **`true`**; опционально **`ELITEEW_MC_E2E_BASE_URL`** для стенда, отличного от дефолта в workflow.
4. **Actions → desktop-shell-e2e → Run workflow** — выбрать **Base URL** при необходимости, запустить; при падении проверить артефакт **`desktop-shell-e2e-playwright-report`** и срок жизни сессии в storage JSON.
5. Если job **guard** завершился skip: проверить секрет/переменные по таблице выше; сообщение в логах job указывает причину.

## Локально

Каталог: **`shared/web/frontend`**.

### 1. Сохранить сессию (один раз)

После входа в приложение (Keycloak):

   ```bash
   pnpm exec playwright codegen "$MC_E2E_BASE_URL" --save-storage=e2e/.auth/storage-state.json
   ```

   Закройте браузер codegen после успешного логина, чтобы файл записался. Файл **`e2e/.auth/*.json`** в **`.gitignore`** — не коммитить.

### 2. Прогон — канонический bundled script

Рекомендуется для CI-parity и smoke+UGS contour:

```bash
export MC_E2E_BASE_URL=https://app.eliteew.ru
pnpm exec playwright install chromium
pnpm run test:e2e:desktop
```

Скрипт **`test:e2e:desktop`** сам выставляет **`DESKTOP_SHELL_E2E_RUN=1`** и включает shell smoke, state-conflict, **widget-sync outbox journey**, **lifecycle honesty (P17)** (`e2e/desktop-shell-lifecycle-honesty.spec.ts` — offline banner browser-layout copy + narrow Start 2-col grid), wave16 a11y, **Wave 4 matrix** (`e2e/desktop-shell-wave4-matrix.spec.ts` — narrow × reduced-motion × low-GPU for Start/Settings/open-app), Start Menu intent deep-link, settings wave16/19, favorites widget smoke, UGS hub smoke/wave4, optional UGS admin queue-ops, **Unified Admin shell nav** (`e2e/unified-admin-shell-nav.spec.ts`, UGS admin storage), site-manager click chains.

**Узкий a11y (регулярный / CI-parity без полного desktop bundle):**

| Команда | Контур | Auth |
|---------|--------|------|
| **`pnpm run test:desktop-shell-a11y`** | Vitest contracts (Start/Settings budgets, full-shell chrome map, Settings a11y, shell Suspense, landmarks, taskbar More, support map, @390 stacked) | не нужен |
| **`pnpm run test:e2e:desktop-a11y`** | `e2e/desktop-shell-wave16-a11y.spec.ts` + `e2e/desktop-shell-wave4-matrix.spec.ts` | нужен storage + `MC_E2E_BASE_URL` |

Machine Vitest checklist (no Playwright): `pnpm run test:admin-shell` or `bash docker/scripts/unified-admin-shell-checklist.sh` — see `documentation/platform/UNIFIED-ADMIN-SHELL.md` §Smoke.

### 3. Прогон — glob только desktop-prefixed specs

Все файлы **`e2e/desktop*.spec.ts`** (shell + settings waves + restart-recovery + widget-sync). **Не** включает **`e2e/ugs-hub*.spec.ts`** и **`e2e/site-manager-ops-click-chains.spec.ts`**:

```bash
export MC_E2E_BASE_URL=https://app.eliteew.ru
export DESKTOP_SHELL_E2E_RUN=1
pnpm exec playwright install chromium
pnpm exec playwright test e2e/desktop*
```

Без **`DESKTOP_SHELL_E2E_RUN=1`** и **`MC_E2E_BASE_URL`** (HTTPS) все desktop suites **skip** через **`desktopShellE2eGate.ts`**.

### 4. Один файл

```bash
export MC_E2E_BASE_URL=https://app.eliteew.ru
export DESKTOP_SHELL_E2E_RUN=1
pnpm exec playwright test e2e/desktop-shell-smoke.spec.ts
```

Wave D journey only:

```bash
export MC_E2E_BASE_URL=https://app.eliteew.ru
export DESKTOP_SHELL_E2E_RUN=1
pnpm exec playwright test e2e/desktop-widget-sync-outbox.spec.ts
```

Переменная **`PLAYWRIGHT_STORAGE_STATE`** — путь к JSON (абсолютный или относительно каталога фронтенда); если указана, но файл отсутствует, конфиг выведет предупреждение и запустится без storage state. Если **`e2e/.auth/storage-state.json`** существует, он подхватится автоматически (см. **`playwright.config.ts`**).

## GitHub Actions

Workflow **`.github/workflows/desktop-shell-e2e.yml`**:

| Job | Назначение |
|-----|------------|
| **`guard`** | Проверяет schedule variable и наличие **`ELITEEW_DESKTOP_E2E_STORAGE_STATE_JSON`**. При отсутствии предпосылок — **skip** с **`::notice::`** / **`::warning::`** и ссылкой на этот документ; основной job не стартует. |
| **`desktop-shell-e2e`** | Checkout → pnpm → запись storage из секрета → **`pnpm run test:e2e:desktop`**. При падении — артефакт **`playwright-report/`**. |

Триггеры:

- **`workflow_dispatch`** — ручной запуск (поле **Base URL** по умолчанию `https://app.eliteew.ru`).
- **`schedule`** (понедельник 05:30 UTC), если **`DESKTOP_SHELL_E2E_SCHEDULE_ENABLED`** = **`true`**.

Требуется runner **`self-hosted`** с доступом к **`MC_E2E_BASE_URL`** (как для **`openapi-pilots-refresh`**).

## User-facing regression coverage (bundled `test:e2e:desktop`)

| Spec | Что проверяет для пользователя |
|------|--------------------------------|
| **`desktop-shell-smoke.spec.ts`** | Стол загружается после входа; idle runtime без stale chip и зависшего loader |
| **`desktop-shell-state-conflict.spec.ts`** | Две вкладки: chip «устарело» при 412 и восстановление после sync |
| **`desktop-widget-sync-outbox.spec.ts`** | Wave D: offline note → outbox → online `POST /widget-sync` + Idempotency-Key → outbox cleared |
| **`desktop-shell-wave16-a11y.spec.ts`** | Landmarks и keyboard/a11y контур оболочки |
| **`desktop-start-menu-intent.spec.ts`** | `desktop-open-start-menu` → Recent / Work tabs without manual More |
| **`desktop-settings-wave16.spec.ts`** | Настройки: storage map → поле timezone |
| **`desktop-settings-wave19.spec.ts`** | Баннер ошибки PATCH shell-state |
| **`desktop-favorites-widget-smoke.spec.ts`** | Панель виджетов на столе: слот «Избранное» с кнопкой «Добавить» (вкл. через настройки Shell) |
| **`ugs-hub-smoke.spec.ts`** | Deep-link в UGS Hub на `#/desktop` |
| **`ugs-hub-wave4.spec.ts`** | Пагинация/scroll fetch в hub (mocked API) |
| **`ugs-hub-admin-queue-ops.spec.ts`** | UGS admin queue ops (optional admin storage; skip без секрета) |
| **`site-manager-ops-click-chains.spec.ts`** | Site Manager: цепочки кликов оператора |

Glob **`e2e/desktop*`** покрывает дополнительные settings waves и restart-recovery, но **не** UGS/site-manager и **не** заменяет bundled script для CI-parity.

### Wave D journey details (`desktop-widget-sync-outbox`)

| Step | Observable |
|------|------------|
| Auth desktop | `#desktop-main` visible; `emperyworld_user.id` present |
| Offline | Playwright `context.setOffline(true)` → notes API fails → `data-widget-shelf-guide="local-hint"` |
| Mutation | Add note → `eliteew-desktop-widget-outbox-v1` contains `note_create` |
| Online sync | Route captures `POST /api/v1/desktop/widget-sync` with **`Idempotency-Key`**; fulfill 200 `{ results }` (client contract; Redis not required for this smoke) |
| Verify | Outbox ops length → `0` |

Unit/integration locks (no secret): Vitest outbox + pytest `test_desktop_widget_sync.py` / `test_desktop_shell_state_metrics.py`.

## Связанные файлы

- **`shared/web/frontend/e2e/desktop-shell-smoke.spec.ts`**
- **`shared/web/frontend/e2e/desktop-widget-sync-outbox.spec.ts`** — Wave D offline→sync journey; входит в **`test:e2e:desktop`**
- **`shared/web/frontend/e2e/desktop-favorites-widget-smoke.spec.ts`** — widgets panel favorites slot; skip без auth storage / `emperyworld_user` в localStorage (как wave 10–11); входит в **`test:e2e:desktop`**
- **`shared/web/frontend/e2e/desktopRuntimeSmoke.ts`** — runtime profile helper (FPS/frame cadence, long tasks, running animations, stale chip, stalled loader)
- **`shared/web/frontend/e2e/desktop-shell-state-conflict.spec.ts`** — two-tab shell-state 412 stale chip + recovery
- **`shared/web/frontend/e2e/desktop-shell-wave16-a11y.spec.ts`**
- **`shared/web/frontend/e2e/desktop-start-menu-intent.spec.ts`** — Start Menu intent tab deep-link (Wave N8)
- **`shared/web/frontend/e2e/desktop-restart-recovery.spec.ts`**
- **`shared/web/frontend/e2e/desktop-settings-wave8.spec.ts`** … **`desktop-settings-wave19.spec.ts`** — settings waves (glob **`e2e/desktop*`**)
- **`shared/web/frontend/e2e/desktop-settings-wave16.spec.ts`** — storage map → sync timezone field
- **`shared/web/frontend/e2e/desktop-settings-wave19.spec.ts`** — shell-state PATCH error banner
- **`shared/web/frontend/e2e/ugs-hub-smoke.spec.ts`** — deep-link → `#/desktop` + `ugs-hub-root` (только **`test:e2e:desktop`**, не glob)
- **`shared/web/frontend/e2e/ugs-hub-wave4.spec.ts`** — paginated sentinel + scroll fetch (mocked `/tasks`)
- **`shared/web/frontend/e2e/ugs-hub-admin-queue-ops.spec.ts`** — strict UGS admin storage; panel + strip + backlog prefetch (mocked)
- **`shared/web/frontend/e2e/ugsHubE2eAuth.ts`** — `PLAYWRIGHT_UGS_ADMIN_STORAGE_STATE` resolver
- **`shared/web/frontend/e2e/desktopShellE2eGate.ts`**
- **`shared/web/frontend/playwright.config.ts`**
- **`shared/web/frontend/package.json`** — script **`test:e2e:desktop`**
- **`.github/workflows/desktop-shell-e2e.yml`** — `workflow_dispatch` + optional weekly schedule
