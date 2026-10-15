# Сверка фронтенда EliteEW с бэкендом

Краткая процедура для воспроизводимой инвентаризации путей, pilot OpenAPI и условных GET на веб-клиенте. Hub: [`README.md`](README.md).

Living surface — **EliteEW** (`shared/api` ↔ `shared/web/frontend`). DEWA OpenAPI / FE inventory не используются как living source of truth.

**Auth:** authenticated `/api/v1/*` ожидает JWT с аудиторией Keycloak **`empery-api`** (см. [`KEYCLOAK-ELITEEW.md`](../platform/docker-re_doc/KEYCLOAK-ELITEEW.md)).

## Gate: новые или изменённые маршруты API

Перед merge изменений, которые трогают **контракт** эндпоинтов для веб-клиента или Android, пройдите раздел **«Чеклист: новый или изменённый публичный маршрут `/api`»** на этой странице (шесть шагов). Periodic audit cadence / master roadmap / hard-acceptance one-shots soft-retired → `trash/`; living gates: [TESTING-STRATEGY.md](../platform/TESTING-STRATEGY.md), [AGENT-CODE-VERIFICATION-WORKFLOW.md](../platform/AGENT-CODE-VERIFICATION-WORKFLOW.md), [PRODUCT-AUDIT-STABILITY-BACKLOG.md](../platform/PRODUCT-AUDIT-STABILITY-BACKLOG.md).

## Инвентаризация вызовов `/api`

Из каталога `shared/web/frontend`:

```bash
pnpm run api:inventory
```

Снимок с ключом `--write` (скрипт уже передаёт его из `package.json`) перезаписывает:

[`documentation/api/fe-be-api-inventory.snapshot.md`](fe-be-api-inventory.snapshot.md)

Сопоставляйте результат с каноническим экспортом [`documentation/api/eliteew-openapi-export.json`](FRONTEND-BACKEND-HTTP.md) (gitignored) и регистрацией доменов в `shared/api/domains/*.py`.

## Матрица «инвентарь vs OpenAPI»

Автоматическое сравнение строк путей из снимка с ключами `paths` полного экспорта:

```bash
cd shared/web/frontend
pnpm run api:gap-matrix
```

Артефакт: [`documentation/api/FE-BE-GAP-MATRIX.md`](FE-BE-GAP-MATRIX.md) (living; auto-generated — do not hand-edit above the manual triage append).

- **Нормализация:** из строк инвентаря отрезаются `?query` и `#fragment` перед сравнением с ключами `paths`.
- **Режим по умолчанию:** путь без точного ключа в export, но с хотя бы одним маршрутом вида `path + '/' + …` в OpenAPI, попадает в секцию **mount prefix** (типичный `baseURL` + относительные вызовы), а не в actionable.
- **Actionable:** остаток после шума и после проверки mount (реальные расхождения или legacy).
- **Noise:** правила в `shared/web/frontend/scripts/fe-be-gap-matrix.ignore.json` (префикс `/api/auth`, шаблоны, хвостовой `/`, тестовые download и т.д.).
- **Strict:** `node scripts/fe-be-gap-matrix.mjs --strict --write` — только exact-сопоставление (для отладки; больше ложных «gap»).
- **Triage:** в конец `FE-BE-GAP-MATRIX.md` вклеивается [`FE-BE-GAP-MATRIX.manual.md`](FE-BE-GAP-MATRIX.manual.md) (living hand-maintained companion — not superseded by the auto matrix).

Полный список «только в OpenAPI» (может быть длинным): `node scripts/fe-be-gap-matrix.mjs --full --write`.

## Pilot OpenAPI и типы TypeScript

Pilot-файлы лежат в `shared/web/frontend/openapi/pilot/` (в т.ч. `desktop.openapi.json`, `friends.openapi.json`). Список путей для узкого **marketing-cabinet** pilot: `openapi/pilot-marketing-cabinet-paths.json` (один источник для `openapi-extract-pilots.mjs` и Vitest). Сборка срезов:

`shared/web/frontend/scripts/openapi-extract-pilots.mjs`

из полного экспорта. Для ряда GET с поддержкой **ETag** на бэкенде пайплайн дополняет в pilot описание **304**, заголовок **ETag** на 200 и опциональный заголовок запроса **If-None-Match** (см. `patchConditionalGetsInPilot` в том же скрипте).

Регенерация типов:

```bash
cd shared/web/frontend
node scripts/openapi-extract-pilots.mjs
pnpm run openapi:pilot:desktop
pnpm run openapi:pilot
pnpm run build:react-compiler
```

Сгенерированные типы: `src/generated/desktop-openapi.ts`, `src/generated/friends-openapi.ts` (и другие pilot-таргеты из `package.json`).

## Контрактные тесты (Vitest)

- `src/pages/Desktop/services/__tests__/desktopApi.contract.test.ts` — пути desktop и наличие **304** в pilot для `config`, `shell-state`, `installed`.
- `src/features/friends/api/__tests__/friendsApi.contract.test.ts` — **304** для `GET /api/v1/friends/overview`.
- `src/services/api/__tests__/apiPaths.contract.test.ts` — якорные пути desktop в `openapi/pilot/desktop.openapi.json` (через `API_PATHS.DESKTOP`).
- `src/features/marketing/api/__tests__/marketingCabinetPilot.contract.test.ts` — узкий срез marketing pilot (streaming-маршруты).
- `src/services/api/__tests__/conditionalJsonGet.test.ts` — общий слой ETag/304.

```bash
pnpm exec vitest run src/pages/Desktop/services/__tests__/desktopApi.contract.test.ts
```

## Unified Content direct downloads

Unified Content save-as/download flows use server-issued tickets instead of Blob-first buffering:

- Authenticated mint routes: `POST /api/v1/content/{id}/download-ticket`, `POST /api/v1/content/versions/{version_id}/download-ticket`, `POST /api/v1/content/batch-download-ticket`, `POST /api/v1/content/download-owned-archive-ticket`.
- Public consume routes: `GET /api/v1/content/{id}/download-by-ticket?ticket=...`, `GET /api/v1/content/versions/{version_id}/download-by-ticket?ticket=...`, `GET /api/v1/content/batch-download-by-ticket?ticket=...`, `GET /api/v1/content/download-owned-archive-by-ticket?ticket=...`.
- Middleware exemption is narrow and only covers `download-by-ticket` paths; normal `/download` remains Bearer-protected.
- Frontend owner: `src/services/contentApi.ts` (`downloadContentToBrowser`, `downloadVersionToBrowser`, `batchDownloadToBrowser`, `downloadOwnedArchiveToBrowser`). Direct URL helpers must not append Bearer/JWT; fallback remains authenticated Blob.

Focused checks:

```bash
cd shared/api
UV_PROJECT_ENVIRONMENT=../.venv uv run pytest tests/test_content_download_ticket_service.py -q --tb=short

cd shared/web/frontend
pnpm exec vitest run src/services/contentApi.downloads.test.ts src/services/__tests__/contentApi.contract.test.ts src/utils/__tests__/browserDownload.test.ts
```

## Условные GET на веб-клиенте

Браузерный слой `api.get` в `src/services/api/client.ts` не настраивает `validateStatus` для **304**. Общая реализация: `src/services/api/conditionalJsonGet.ts` (`conditionalJsonGet`, сброс по префиксу ключа).

Desktop обёртка с ключами `desktop:config`, `desktop:shell-state`, `desktop:installed`: `src/pages/Desktop/services/desktopConditionalGet.ts` — вызывается из `desktopApi.ts`. Кэш сбрасывается при мутациях и при `clearDesktopShellStateCache()` (префикс `desktop:`).

Друзья: `getFriendsOverview` использует ключ `friends:overview`.

**Logout teardown (web):** `AuthContext` выполняет **§3.4 six-step cascade** ([FRONTEND_BROWSER_CACHE_MODEL.md](../product/FRONTEND_BROWSER_CACHE_MODEL.md)): (1) `clearPrincipalScopedLocalStorage`, (2) `clearIdentityAndSessionKeys`, (3) `clearDesktopShellStateCache()` — shell RAM, префикс `desktop:`, music IndexedDB (`musicAudioBlobCache.ts`), offline queue, (4) `clearFeSessionApiCaches()` — все ETag/тела conditional GET, (5) `resetQueryClient()`, (6) `authSessionLogout()` → OIDC tokens.

Мобильный контракт и семантика **If-None-Match**: [`ANDROID-API-CONTRACTS.md`](ANDROID-API-CONTRACTS.md), [`product/mobile/ANDROID-DEVELOPER-HANDBOOK.md`](../product/mobile/ANDROID-DEVELOPER-HANDBOOK.md).

## DTO на фронте

Предпочтительно объявлять публичные типы desktop API как алиасы к `components['schemas'][...]` из `desktop-openapi.ts`, без дублирования полей. Узкие типы для UI (например буфер обмена, now playing) остаются отдельными интерфейсами там, где OpenAPI намеренно оставляет `unknown`.

## Чеклист: новый или изменённый публичный маршрут `/api`

Используйте перед merge, если добавляете или меняете контракт эндпоинта, который вызывает веб-клиент или мобильное приложение.

1. **Инвентарь** — `pnpm run api:inventory` из `shared/web/frontend` (снимок `documentation/api/fe-be-api-inventory.snapshot.md`).
2. **OpenAPI** — убедиться, что маршрут попадает в экспорт приложения; при необходимости `pnpm run openapi:export` и `pnpm run api:gap-matrix` ([FE-BE-GAP-MATRIX.md](FE-BE-GAP-MATRIX.md), triage — [FE-BE-GAP-MATRIX.manual.md](FE-BE-GAP-MATRIX.manual.md)).
3. **Pilot и типы** — если маршрут в зоне pilot (desktop, friends, marketing и т.д.), обновить срезы и сгенерированные типы: `pnpm run openapi:extract-pilots` + `pnpm run openapi:pilots` (или узкий `openapi:pilot:<name>`), затем **`pnpm run openapi:check-pilot-freshness`** (зелёный для regenerable pilots). При bake release можно opt-in: `release stack0 --all --refresh-openapi-pilots` (tree export → pilots → SPA build в одном прогоне). При поддержке условных GET — не забыть `If-None-Match` / 304 в контракте клиента. Новый сгенерированный модуль lite → thin `*OpenApi.ts` bridge или явный exclude в [`FRONTEND-BACKEND-HTTP.md`](FRONTEND-BACKEND-HTTP.md) §Adoption policy.
4. **Тесты** — по возможности Vitest на форму ответа или якорный путь (см. список файлов в разделе «Контрактные тесты»); политика — `.cursor/rules/frontend-tests.mdc`.
5. **Android** — если тот же путь использует мобильный клиент: [ANDROID-API-CONTRACTS.md](ANDROID-API-CONTRACTS.md) и [ANDROID-DEVELOPER-HANDBOOK.md](../product/mobile/ANDROID-DEVELOPER-HANDBOOK.md) (в т.ч. ETag / 304, если применимо).
6. **Опционально — CI** — периодическое обновление pilot OpenAPI и типов по решению оператора: [OPENAPI-PILOTS-CI.md](OPENAPI-PILOTS-CI.md).

**Маркетинг-дашборд (волна 19):** публичные мутации `POST /api/v1/marketing-cabinet/projects/{project_id}/dashboard-layouts/import` (JSON-конверт экспорта: `_exportSchemaVersion`, `layout`) и расширение тела `POST .../dashboard-layouts/from-preset` полем `rebuild_existing` — см. [MARKETING-CABINET.md](../product/marketing/MARKETING-CABINET.md); фронт: `marketingCabinetApi.importDashboardLayoutFromExport`, `createDashboardLayoutFromPreset` с `rebuild_existing`.

Периодический прогон всего контура: [TESTING-STRATEGY.md](../platform/TESTING-STRATEGY.md) + [PRODUCT-AUDIT-STABILITY-BACKLOG.md](../platform/PRODUCT-AUDIT-STABILITY-BACKLOG.md) (audit-cadence one-shot → `trash/`).
