# Ultimate Doc Editor: Playwright E2E и CI (Wave E)

Операторский контур smoke/E2E для **Ultimate Doc Editor** на аутентифицированном desktop shell. Дополняет ручной чеклист и Vitest в **`ULTIMATE-DOC-EDITOR.md`** §6; не заменяет canary runbook (**`ULTIMATE-DOC-EDITOR-CANARY-ROLLBACK-CHECKLIST.md`**) и ops triage (**`ULTIMATE-DOC-EDITOR-OPS-RUNBOOK.md`**).

**Wave E статус (2026-07-01):** добавлены automated seed API (`CONTENT_E2E_SEED_ENABLED`), Playwright `globalSetup` (`e2e/global-setup-content-e2e.ts`), npm script **`test:e2e:doc-editor`**, workflow **`.github/workflows/doc-editor-e2e.yml`**. Always-on CI canary по-прежнему opt-in через `DOC_EDITOR_E2E_SCHEDULE_ENABLED` и секрет storage state.

## Что уже есть (факт дерева)

| Слой | Путь / команда | Примечание |
|------|----------------|------------|
| Playwright (opt-in) | **`e2e/content-manager-doceditor.spec.ts`** | Файловый менеджер → Doc Editor: open, switch file, load error, `beforeunload` clean/dirty |
| Gate | `CM_DOC_E2E_RUN=1` **и** `MC_E2E_BASE_URL` (HTTPS) | Без gate suite **skip** (как `desktopShellE2eGate.ts` для shell) |
| Auth | Playwright `storageState` | Тот же контур, что desktop E2E: **`e2e/.auth/storage-state.json`** или **`PLAYWRIGHT_STORAGE_STATE`** |
| Vitest (редактор) | **`src/components/UltimateDocEditor/**/*.test.ts`** | Unit/contract; **не** заменяют authenticated Playwright |
| PR gate | **`.github/workflows/eliteew-pr-gate.yml`** | `check:release`; **не** прогоняет gated Doc Editor E2E |
| Desktop shell CI | **`.github/workflows/desktop-shell-e2e.yml`** | **`test:e2e:desktop`** — shell/UGS; **не** включает doc-editor spec |

### Честные пробелы (не маскировать Wave E `[x]`)

- **`threadHashLink`** (`parseThreadIdFromHash`, `buildThreadDeepLink`, …): модуль есть; **отдельного Vitest-файла в дереве нет** — ops runbook ссылается на локальный прогон, покрытие CI не доказано.
- Playwright для **comments deep-link**, **draft recovery**, **multi-tab doc editor UUID** в **`e2e/`** **отсутствуют** — только CM integration spec выше.
- **Seeded fixtures** («doc editor e2e», «doc one/two», «restricted or deleted doc») **не** описаны в репо как API/seed script — оператор готовит строки Файловый менеджер вручную на целевом стенде.
- **GitHub Actions workflow** для doc-editor canary **нет** (в отличие от **`desktop-shell-e2e`**).

## Переменные окружения

| Имя | Обязательность | Назначение |
|-----|----------------|------------|
| **`CM_DOC_E2E_RUN`** | **обязателен** (`=1`) | Включает suite; иначе skip |
| **`MC_E2E_BASE_URL`** | **обязателен** (HTTPS) | База SPA (например `https://app.eliteew.ru`) |
| **`PLAYWRIGHT_STORAGE_STATE`** | рекомендуется | Путь к JSON после Keycloak login; иначе auto **`e2e/.auth/storage-state.json`** если файл есть |
| **`ELITEEW_DESKTOP_E2E_STORAGE_STATE_JSON`** | CI (планируемый workflow) | **Тот же секрет**, что **`desktop-shell-e2e`** — отдельный секрет для doc-editor **не** нужен, если тестовый пользователь совпадает. JSON Playwright `storageState` после Keycloak login; не коммитить. |
| **`DOC_EDITOR_E2E_SCHEDULE_ENABLED`** | CI variable (планируемый workflow) | Значение **`true`** включает scheduled cron; иначе job **guard** skip (как **`DESKTOP_SHELL_E2E_SCHEDULE_ENABLED`**). |
| **`ELITEEW_MC_E2E_BASE_URL`** | CI variable (опционально) | База для scheduled-запусков; если не задана — `https://app.eliteew.ru`. |

Секреты storage state в репозиторий **не** кладутся. Публичные форки без секретов: job **guard** должен **skip** с **`::notice::`** / **`::warning::`**, не fail на auth.

## Чеклист оператора (локальный smoke + подготовка CI)

1. **Self-hosted runner** — тот же контур, что **`desktop-shell-e2e`** и **`openapi-pilots-refresh`**: runner с HTTPS-доступом к **`MC_E2E_BASE_URL`**.
2. **Storage state** — один раз локально (§ «Сохранить сессию»); для CI — секрет **`ELITEEW_DESKTOP_E2E_STORAGE_STATE_JSON`** уже используется desktop workflow; при первом подключении doc-editor canary **переиспользовать** его (тестовый пользователь = владелец CM fixtures).
3. **CM fixtures на стенде** — создать строки из таблицы § «Подготовить fixtures» под тем же пользователем, что в storage JSON; без seed прогон **падает** (ожидаемо).
4. **Локальный parity-smoke** — § «Прогон» (`CM_DOC_E2E_RUN=1`, один spec); при зелёном результате можно запрашивать ТЗ на workflow.
5. **После появления workflow** (ТЗ): **Actions → doc-editor-e2e → Run workflow** → Base URL при необходимости; при падении — артефакт **`doc-editor-e2e-playwright-report`**; при skip в **guard** — проверить секрет/variable по таблице выше (сообщение в логах указывает причину).

## Локальный smoke path (канон сейчас)

Каталог: **`shared/web/frontend`**.

### 1. Сохранить сессию (один раз)

После входа в приложение (Keycloak):

```bash
export MC_E2E_BASE_URL=https://app.eliteew.ru
pnpm exec playwright codegen "$MC_E2E_BASE_URL" --save-storage=e2e/.auth/storage-state.json
```

Файлы **`e2e/.auth/*.json`** в **`.gitignore`**.

### 2. Подготовить fixtures на стенде

На **`MC_E2E_BASE_URL`** в Файловый менеджер должны существовать строки, на которые ссылается spec (имена в UI):

| Строка CM | Сценарий |
|-----------|----------|
| **doc editor e2e** | PKM open, clean reload без `beforeunload`, dirty reload с confirm |
| **doc one** / **doc two** | Переключение уже открытого редактора на другой файл |
| **restricted or deleted doc** | Явный load error («Failed to load», not found / access denied) |

Без fixtures прогон **падает** — это не дефект gate; seed — зона оператора до появления автоматического seed API (ТЗ).

### 3. Прогон

```bash
export MC_E2E_BASE_URL=https://app.eliteew.ru
export CM_DOC_E2E_RUN=1
pnpm exec playwright install chromium
pnpm exec playwright test e2e/content-manager-doceditor.spec.ts
```

Узкий Vitest (редактор, без auth):

```bash
pnpm exec vitest run src/components/UltimateDocEditor
```

Release gate перед canary/deploy редактора — **`ULTIMATE-DOC-EDITOR.md`** §6.2 (`build:react-compiler`, typecheck, Vitest).

### Bundled script (планируется, сейчас отсутствует)

CI-parity локально сейчас — явный spec (§3). После ТЗ оператора в **`package.json`** добавить:

```json
"test:e2e:doc-editor": "CM_DOC_E2E_RUN=1 playwright test e2e/content-manager-doceditor.spec.ts"
```

До появления script — в workflow и runbook использовать команду §3 без изменений.

## GitHub Actions (проверено: workflow отсутствует)

Проверка дерева **2026-06-30**: в **`.github/workflows/`** есть **`desktop-shell-e2e.yml`**, **`eliteew-pr-gate.yml`**, … — **`doc-editor-e2e.yml` нет**. Guard-only job (<50 строк) **недостаточен** без основного job (checkout → pnpm → storage → Playwright); полный workflow по образцу desktop — **~65 строк** → **не добавлен** в этой волне; только документация и next steps ниже.

### Целевой workflow (когда оператор даст ТЗ на код)

Файл: **`.github/workflows/doc-editor-e2e.yml`** (имя каноническое).

| Job | Назначение |
|-----|------------|
| **`guard`** | **`schedule`**: skip, если **`DOC_EDITOR_E2E_SCHEDULE_ENABLED`** ≠ **`true`**. **Всегда**: skip, если **`ELITEEW_DESKTOP_E2E_STORAGE_STATE_JSON`** пуст — **`::warning::`** + ссылка на этот документ; **`proceed=false`**. Иначе **`proceed=true`**. |
| **`doc-editor-e2e`** | `needs: guard`, `if: proceed`. Checkout → pnpm → запись **`e2e/.auth/storage-state.json`** из секрета → `playwright install chromium` → **`CM_DOC_E2E_RUN=1`**, **`MC_E2E_BASE_URL`** (dispatch input или **`ELITEEW_MC_E2E_BASE_URL`**) → **`pnpm exec playwright test e2e/content-manager-doceditor.spec.ts`** (или **`pnpm run test:e2e:doc-editor`** после script). При падении — артефакт **`playwright-report/`**. |

Триггеры (рекомендация):

- **`workflow_dispatch`** — ручной запуск, поле **Base URL** (default `https://app.eliteew.ru`).
- **`schedule`** — отдельный cron от desktop-shell (например вторник 06:00 UTC), только при **`DOC_EDITOR_E2E_SCHEDULE_ENABLED=true`**.

Runner: **`self-hosted`**, **`working-directory: shared/web/frontend`**.

### Regression coverage (текущий spec)

| Spec | Пользовательский сценарий |
|------|---------------------------|
| **`e2e/content-manager-doceditor.spec.ts`** | CM PKM → Doc Editor: open; switch doc one → doc two; load error (restricted/deleted); clean reload без `beforeunload`; dirty reload с confirm |

Gate: **`CM_DOC_E2E_RUN=1`** и **`MC_E2E_BASE_URL`** (HTTPS) — иначе suite **skip** (не fail).

## Целевое состояние Wave E CI (только по ТЗ оператора)

Следующая итерация **не** стартует кодом «по умолчанию». Минимальный scope для ТЗ:

1. **`test:e2e:doc-editor`** (или расширение **`test:e2e:desktop`**) — явный список spec-файлов, parity с локальной командой выше.
2. **Workflow** (по образцу **`desktop-shell-e2e.yml`**): job **guard** (секрет storage + optional schedule variable) → self-hosted runner → артефакт report.
3. **Seeded fixtures**: документированный seed (API script / operator runbook / test-only migration) — имена и ACL зафиксированы в репо.
4. **Новые Playwright specs** (если в ТЗ): comments `thread=` deep-link, draft recovery modal, две вкладки doc-editor UUID — **новые файлы**, не восстановление удалённых suite без археологии.
5. **Vitest** для **`threadHashLink`** и других pure utils — до claim «integration tests in CI».

### Next steps для оператора (явное ТЗ на код)

| # | Артефакт | Оценка | Зависимости |
|---|----------|--------|-------------|
| 1 | **`test:e2e:doc-editor`** в **`package.json`** | 1 строка | — |
| 2 | **`.github/workflows/doc-editor-e2e.yml`** | ~65 строк, копия паттерна **`desktop-shell-e2e.yml`** | п.1 опционально; секрет storage; CM fixtures на стенде |
| 3 | Repo-visible **seed** (script или runbook-only checklist в репо) | отдельная задача | имена строк CM зафиксированы в § fixtures |
| 4 | Playwright specs: comments deep-link, draft recovery, multi-tab UUID | новые файлы | fixtures + стабильный стенд |
| 5 | Vitest **`threadHashLink.test.ts`** | узкий unit | — |

Порядок внедрения: **fixtures на стенде** → локальный зелёный §3 → **п.1–2** → optional schedule variable → п.4–5 по приоритету продукта.

### Вне scope без отдельного ТЗ

- Воскрешение исторических **`ugs-ui.spec.ts` / `desktop.spec.ts`** (см. **`ugs_frontend_contract_and_regression_baseline.md`**).
- Подключение doc-editor к **`eliteew-pr-gate`** без решения о flakiness/auth secret на PR forks.
- Backend pytest для doc-editor в CI canary (отдельный контур **`run-stack0-api-tests.sh`**).

## Failure / Edge-Case Matrix

| Ось | Поведение |
|-----|-----------|
| **Offline-mode** | Playwright не запускается без `MC_E2E_BASE_URL`; локально — skip. На стенде при недоступном API — явные load error states в spec (fixture «restricted or deleted doc»). |
| **Dual-flag / conflict** | `CM_DOC_E2E_RUN` без HTTPS base → skip. Storage state и bearer **не** смешиваются с tokenized download URL (редактор использует session cookies в storage state). |
| **Permission / access boundary** | Spec проверяет denied/not-found UX; ACL fixtures должны быть на тестовом пользователе storage state, не admin prod. |
| **Regression command** | Локально: команда §3; Vitest UltimateDocEditor; canary manual § **`ULTIMATE-DOC-EDITOR-CANARY-ROLLBACK-CHECKLIST.md`**. CI canary — **после** workflow из ТЗ. |

## Связанные документы

- **`ULTIMATE-DOC-EDITOR.md`** — продуктовый канон, §6 проверки
- **`ULTIMATE-DOC-EDITOR-CANARY-ROLLBACK-CHECKLIST.md`** — staged rollout
- **`ULTIMATE-DOC-EDITOR-OPS-RUNBOOK.md`** — инциденты
- **`product/desktop/DESKTOP-SHELL-E2E-CI.md`** — образец guard + storage secret + self-hosted runner
- Historical Wave E backlog mirror (not product hub): soft-retired under `trash/` (former `EliteEW/ULTIMATE-DOC-EDITOR-EXECUTION-BACKLOG.md`); living SoT — `ULTIMATE-DOC-EDITOR.md` + canary checklist
