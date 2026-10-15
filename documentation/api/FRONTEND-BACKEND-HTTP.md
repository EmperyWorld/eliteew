# Фронтенд EliteEW и HTTP API бэкенда

Канонический код: [`shared/web/frontend`](../../shared/web/frontend), API: [`shared/api`](../../shared/api). Публичный импорт HTTP-клиента: [`shared/web/frontend/src/services/api/client.ts`](../../shared/web/frontend/src/services/api/client.ts) (и barrel `services/api`). Hub: [`README.md`](README.md).

**Wave 26 (atomization):** монолитный `client.ts` разделён; публичный путь импорта не меняется. Модули (каждый &lt;800 LOC):

| Модуль | Роль |
|--------|------|
| [`client.ts`](../../shared/web/frontend/src/services/api/client.ts) | Thin facade: `apiClient` / `adminApiClient` / `publicApiClient`, `api` helpers, re-exports |
| [`apiClientCore.ts`](../../shared/web/frontend/src/services/api/apiClientCore.ts) | Types, `APIError`, origin/retry helpers, session-auth branches |
| [`createAPIClient.ts`](../../shared/web/frontend/src/services/api/createAPIClient.ts) | Axios factory + request/response interceptors |
| [`apiFetchWithAuth.ts`](../../shared/web/frontend/src/services/api/apiFetchWithAuth.ts) | Streaming / SSE authenticated `fetch` |

Lock: `shared/web/frontend/src/services/api/__tests__/client.wave26-atomization.contract.test.ts`.

Living contracts are **EliteEW-only**. Soft-retired DEWA OpenAPI dumps are not a source of truth (→ `trash/`).

**Keycloak audience:** API validates JWT against confidential client **`empery-api`**. SPA uses public client **`empery-web`** (PKCE); Android uses **`empery-mobile`**. IdP canon: [`KEYCLOAK-ELITEEW.md`](../platform/docker-re_doc/KEYCLOAK-ELITEEW.md).

## Инвентаризация путей `/api*`

Снимок строковых литералов и `baseURL` с `/api` в исходниках фронта регенерируется командой из каталога фронта:

```bash
cd shared/web/frontend && pnpm run api:inventory
```

Артефакт (не править вручную): [`fe-be-api-inventory.snapshot.md`](fe-be-api-inventory.snapshot.md).

Сопоставление с роутерами: домены в [`shared/api/domains/`](../../shared/api/domains). Редирект legacy → `/api/v1` (неполный список префиксов): [`shared/api/middleware/api_versioning.py`](../../shared/api/middleware/api_versioning.py).

### Опционально: проверить дифф снимка перед релизом

```bash
cd shared/web/frontend && pnpm run api:inventory && git diff documentation/api/fe-be-api-inventory.snapshot.md
```

Включать как жёсткий gate в CI имеет смысл только если команда готова к частым обновлениям снимка.

## Экспорт OpenAPI (без HTTP / без Bearer)

Полный JSON схемы из процесса FastAPI (как в Swagger, но локально):

1. **Из контейнера API** (рекомендуется, все зависимости уже в образе):

```bash
bash shared/api/scripts/export_openapi_docker.sh
```

Или из каталога фронта: `pnpm run openapi:export` (тот же shell-скрипт).

**Runtime:** по умолчанию **`podman`** (`ELITEEW_CONTAINER_RUNTIME`, см. `docker/scripts/eliteew-container-console.sh`). На хосте с Docker CLI: `ELITEEW_CONTAINER_RUNTIME=docker bash shared/api/scripts/export_openapi_docker.sh`.

**Remote (command-center → prod-core):** когда локальный API-контейнер не запущен:

```bash
pnpm run openapi:export:prod-core
# equivalent:
# ELITEEW_OPENAPI_SSH_HOST=192.168.1.111 \
# ELITEEW_API_CONTAINER=stack0-eliteew-api-prod-baked \
# bash shared/api/scripts/export_openapi_docker.sh
```

По умолчанию пишет в `documentation/api/eliteew-openapi-export.json` (файл в [.gitignore](../../.gitignore), не коммитить большие дампы без необходимости). Переопределить контейнер: `ELITEEW_API_CONTAINER` (default **`stack0-eliteew-api-prod-baked`**).

2. **Прямой Python** (если локальное окружение поднимает `api.main`):

```bash
cd /path/to/powered_by_emperyworld
python3 shared/api/scripts/export_openapi.py documentation/api/eliteew-openapi-export.json
```

Нужен **тот же набор зависимостей, что и в Docker-образе API** (`docker/builders/stack0-api/requirements/locks/api.lock` / образ stack0). На **хосте** venv: **`.venv`** (`bash scripts/eliteew/sync-host-api-venv.sh` — [platform/TESTING-STRATEGY.md](../platform/TESTING-STRATEGY.md) §Host venv).

Скрипт: [`shared/api/scripts/export_openapi.py`](../../shared/api/scripts/export_openapi.py).

## Пилоты OpenAPI → TypeScript (`openapi-typescript`)

Из каталога [`shared/web/frontend`](../../shared/web/frontend):

| Команда | Вход | Выход |
|---------|------|--------|
| `pnpm run openapi:pilot` | `openapi/pilot/friends.openapi.json` | `src/generated/friends-openapi.ts` |
| `pnpm run openapi:pilot:gaf` | `openapi/pilot/gaf-chat.openapi.json` | `src/generated/gaf-chat-openapi.ts` |
| `pnpm run openapi:pilot:marketing` | `openapi/pilot/marketing-cabinet.openapi.json` | `src/generated/marketing-cabinet-openapi.ts` |
| `pnpm run openapi:pilot:content` | `openapi/pilot/content.openapi.json` | `src/generated/content-openapi.ts` |
| `pnpm run openapi:pilot:desktop` | `openapi/pilot/desktop.openapi.json` | `src/generated/desktop-openapi.ts` |
| `pnpm run openapi:pilot:ugs` | `openapi/pilot/ugs.openapi.json` | `src/generated/ugs-openapi.ts` |
| `pnpm run openapi:pilot:product-desktop` | `openapi/pilot/product-desktop.openapi.json` | `src/generated/product-desktop-openapi.ts` |
| `pnpm run openapi:pilot:voice-gateway` | `openapi/pilot/voice-gateway.openapi.json` | `src/generated/voice-gateway-openapi.ts` |
| `pnpm run openapi:pilot:ewa` | `openapi/pilot/ewa.openapi.json` | `src/generated/ewa-openapi.ts` |
| `pnpm run openapi:pilot:doc-editor-v2` | `openapi/pilot/doc-editor-v2.openapi.json` | `src/generated/doc-editor-v2-openapi.ts` |
| `pnpm run openapi:pilot:kbsew` | `openapi/pilot/kbsew.openapi.json` | `src/generated/kbsew-openapi.ts` |
| `pnpm run openapi:pilot:ewa-desktop-orchestration` | `openapi/pilot/ewa-desktop-orchestration.openapi.json` (ручной срез / SSE-enriched overlay) | `src/generated/ewa-desktop-orchestration-openapi.ts` |
| `pnpm run openapi:pilot:ewa-companion-admin` | `openapi/pilot/ewa-companion-admin.openapi.json` (ручной admin task-runs срез) | `src/generated/ewa-companion-admin-openapi.ts` |
| `pnpm run openapi:pilot:ewa-companion-chat` | `openapi/pilot/ewa-companion-chat.openapi.json` (ручной companion chat SSE stream + task-runs + confirm + action notice, wave 9) | `src/generated/ewa-companion-chat-openapi.ts` |
| `pnpm run openapi:pilot:marketing-rag` | `openapi/pilot/marketing-cabinet-rag.openapi.json` | `src/generated/marketing-cabinet-rag-openapi.ts` |
| `pnpm run openapi:pilot:marketing:full` | `openapi/pilot/marketing-cabinet-full.openapi.json` | `src/generated/marketing-cabinet-full-openapi.ts` |
| `pnpm run openapi:pilot:ebrowser` | `openapi/pilot/ebrowser.openapi.json` | `src/generated/ebrowser-openapi.ts` |
| `pnpm run openapi:pilots` (= `:lite`) | friends, gaf-chat, marketing streams (2), marketing RAG (4), content, desktop, UGS, product-desktop, voice-gateway, **EWA desktop-orchestration**, **Assistant admin task-runs**, **Assistant chat task-runs**, **EBrowser** | все соответствующие `src/generated/*` |
| `pnpm run openapi:pilots:full` | то же + полный marketing-срез | дополнительно `marketing-cabinet-full-openapi.ts` |

**Marketing lite:** в `marketing-cabinet.openapi.json` по умолчанию только `POST …/ai/assist/stream` и `POST …/chat/message/stream`. Полный префикс `/api/v1/marketing-cabinet` — переменная `OPENAPI_MARKETING_FULL=1` при `openapi:extract-pilots`, затем `openapi:pilot:marketing:full` или одной командой `openapi:pilots:full` / `openapi:refresh-pilots:full`.

**Marketing RAG (узкий пилот):** `marketing-cabinet-rag.openapi.json` — только эндпоинты project RAG, которые вызывает [`marketingProjectRagApi.ts`](../../shared/web/frontend/src/services/api/marketingProjectRagApi.ts), без полного `marketing-cabinet-full`.

После расширения pilot-JSON перегенерировать типы тем же скриптом.

### Покрытие пилотами (ориентир для разработчиков)

| Модуль / зона | Пилот JSON |
|---------------|------------|
| Friends | `friends.openapi.json` |
| GAF Chat | `gaf-chat.openapi.json` |
| Marketing streams (lite) | `marketing-cabinet.openapi.json` |
| Marketing RAG (`marketingProjectRagApi`) | `marketing-cabinet-rag.openapi.json` |
| Marketing весь кабинет (опционально) | `marketing-cabinet-full.openapi.json` |
| Unified Content | `content.openapi.json` — includes owner broken-ops (`GET /content/broken`, `POST /content/broken/scan`, `POST /content/{id}/storage-recheck`, `POST /content/{id}/permanent-delete`); list bodies still loose until named `response_model` on BE — see [CONTENT-BROKEN-FILES-AND-WEBP-DISPLAY.md](../product/CONTENT-BROKEN-FILES-AND-WEBP-DISPLAY.md) §OpenAPI |
| Desktop user + вложенные под `/api/v1/desktop` | `desktop.openapi.json` |
| UGS runtime/admin/workflows под `/api/v1/ugs` | `ugs.openapi.json` |
| EWDesk / product-desktop | `product-desktop.openapi.json` |
| Voice-gateway (STT/TTS/process…) | `voice-gateway.openapi.json` |
| EWA full prefix `/api/v1/ewa` | `ewa.openapi.json` — incl. device-token `esp-display/turn` + `esp-display/image` (`EspDisplay*` schemas); canon [EWA-ESP-DISPLAY-AI.md](../product/ewa/EWA-ESP-DISPLAY-AI.md) |
| Document Editor V2 | `doc-editor-v2.openapi.json` |
| KBSEW gateway | `kbsew.openapi.json` |
| Assistant admin task runs (`/api/v1/ewa/admin/companion/task-runs*`) | `ewa-companion-admin.openapi.json` (hand SSE/admin overlay) |
| Assistant chat SSE stream + task runs + confirm | `ewa-companion-chat.openapi.json` — `POST /api/v1/ewa/companion-chat/stream` (`CompanionChatStreamDelta` / `Final` / `Actions` / `Error` SSE payloads) + `GET|POST …/task-runs*` — consumer: [`ewaCompanionChatApi.ts`](../../shared/web/frontend/src/services/ewa/ewaCompanionChatApi.ts) (`components['schemas']`, exported `CompanionChatStream*Event` helpers + Zod list/confirm boundary) |
| EBrowser policy `/api/v1/ebrowser` | `ebrowser.openapi.json` — consumer: [`ebrowserOpenApi.ts`](../../shared/web/frontend/src/features/ebrowser/ebrowserOpenApi.ts); product SoT [DESKTOP-EBROWSER.md](../product/desktop/DESKTOP-EBROWSER.md) |

**Document Editor V2:** backend contour `/api/v1/doc-editor-v2/*` — pilot `doc-editor-v2.openapi.json` → `src/generated/doc-editor-v2-openapi.ts`; client [`documentEditorV2Api.ts`](../../shared/web/frontend/src/services/documentEditorV2Api.ts) aliases DTO from generated `components['schemas']`. Канон: [`product/DOCUMENT-EDITOR-V2.md`](../product/DOCUMENT-EDITOR-V2.md).

**EWA full prefix:** regenerable pilot `ewa.openapi.json` (all `/api/v1/ewa/*`) — **B5a** documents companion-chat / task-events / desktop-orch `text/event-stream` with named `$ref`. Hand overlays (`ewa-companion-chat` / admin / desktop-orchestration) remain for narrative + Zod consumers; shared SurfaceBlock / stream event components sync from Pydantic. **ESP TFT display** (`esp-display/turn`, `esp-display/image`) lives in the same regenerable pilot (device `X-EliteEW-Esp-Display-Token`, not JWT); firmware-only client — [EWA-ESP-DISPLAY-AI.md](../product/ewa/EWA-ESP-DISPLAY-AI.md).

**KBSEW gateway:** `kbsew.openapi.json` → `src/generated/kbsew-openapi.ts`. FE bridge: [`kbsewOpenApi.ts`](../../shared/web/frontend/src/pages/Admin/kbsewOpenApi.ts) re-exports Out/In schemas (`KbsewBarrelOut`, `KbsewReadyOut`, `AdminKbsewSearchOut`, …); admin client [`kbsewAdminApi.ts`](../../shared/web/frontend/src/pages/Admin/kbsewAdminApi.ts) uses bridge aliases (Wave 5). Stack0 gateway attaches Pydantic `response_model` (`shared/api/schemas/kbsew_gateway.py`) so OpenAPI bodies are no longer `unknown`. **Unique `operationId`:** GET/POST `/api/v1/kbsew/barrels` use `proxy_kbsew_barrels_list` / `proxy_kbsew_barrels_create` (not a shared `api_route`). Prefer bake-time `--refresh-openapi-pilots` on the release that ships the backend so generated ops match; otherwise re-export + path-scoped pilot refresh after the API is available (local tree or prod-core).

**Professional Worlds:** regenerable pilot `professional-worlds.openapi.json`. Desktop runtime aliases: [`professionalWorldsOpenApi.ts`](../../shared/web/frontend/src/features/professional-worlds/desktop/professionalWorldsOpenApi.ts). Admin aliases: [`professionalWorldsAdminOpenApi.ts`](../../shared/web/frontend/src/features/professional-worlds/admin/professionalWorldsAdminOpenApi.ts). **Do not** treat `ProfessionalWorldsSnapshotOut` (runtime desktop) as `ProfessionalWorldsAdminSnapshot` (FE admin bootstrap aggregate) — different contracts. **R1 (2026-08-06):** desktop `api/` clients use bridge Out generics (no `api.<unknown>` / `getNoCache<unknown>`); lock in `professionalWorldsApi.adoption.test.ts`.

### Adoption policy for `src/generated/*-openapi.ts`

Every regenerable lite pilot should have **at least one** FE import path (thin bridge or service alias). Preferred pattern: `*OpenApi.ts` next to the client, re-exporting `components['schemas']` / `paths` — UI components do not import `src/generated/` directly.

**Agent rule (HARD):** `.cursor/rules/openapi-ssot-bridge.mdc` — no parallel hand DTOs where a bridge exists; missing shape → backend OpenAPI / expand bridge / refresh pilots, not an invented twin. **TS meaning at boundaries:** `.cursor/rules/typescript-contract-usage.mdc`.

**Dirty-typing defense (2026-08-06, R0–R6 + residual clear):** Biome `noExplicitAny` / `noNonNullAssertion` = **error** (DOM/UI overrides warn). Fail-closed rg gate: `shared/web/frontend/scripts/lint-api-integrity.sh` (`pnpm lint:api` / `pnpm lint:gate`) — Patterns A/C/D. **R6 default:** REST-strict (`mode=rest-strict+sse-allowlist`); both allowlists **empty** (Wave7 A + SSE C cleared via field coerce / Zod `.strip()`+`.catchall`). `API_INTEGRITY_STRICT=1` green at residual **0**. Living backlog: `documentation/plans/api/API-INTEGRITY-BACKLOG.md` *[operator-local process plan; gitignored — not living canon]*. Vitest locks: `apiIntegrityPatternA.r5.test.ts`, `apiIntegrityGate.r6.test.ts`.

**Dual twin forbidden:** when a bridge (or domain `schemas.ts`) already exports a schema alias, HTTP clients must not keep a second hand `export type` / `export interface` with the same contract shape (e.g. `MusicForgeCapabilities` beside `MusicForgeCapabilitiesOut`). Temporary `export type X = BridgeX` is allowed only for a single transition PR, then delete the hand name. Hook: `.cursor/hooks/openapi-ssot-bridge-gate.py` — **deny** when a new hand export shadows / is an `*Out`/`*In` twin of a bridge export; soft **warn** (allow) when near a bridge without a twin name; hook crash / parse → allow (`hooks.json` `failClosed: false`). Inventory lock: `src/services/__tests__/openapiSsotBridgeInventory.contract.test.ts`.

| Generated module | Adoption |
|------------------|----------|
| friends, gaf-chat, marketing-cabinet, marketing-cabinet-rag, content, desktop, ugs, product-desktop, voice-gateway, doc-editor-v2, professional-worlds, ewa-companion-* | Wired via domain clients / bridges |
| music-forge | [`musicForgeOpenApi.ts`](../../shared/web/frontend/src/services/musicForge/musicForgeOpenApi.ts) |
| ebrowser | [`ebrowserOpenApi.ts`](../../shared/web/frontend/src/features/ebrowser/ebrowserOpenApi.ts) |
| ewa | [`ewaOpenApi.ts`](../../shared/web/frontend/src/services/ewa/ewaOpenApi.ts) — plans, runtime, workflows, admin catalog, profile; normalize at client boundary where optional nested blobs differ |
| ewa-desktop-orchestration | [`ewaDesktopOrchestrationOpenApi.ts`](../../shared/web/frontend/src/services/ewa/ewaDesktopOrchestrationOpenApi.ts) |
| kbsew | [`kbsewOpenApi.ts`](../../shared/web/frontend/src/pages/Admin/kbsewOpenApi.ts) |
| projects-members | `MarketingProjectMember*` aliases in marketing cabinet entity types |
| live-jobs-summary | `MarketingProjectLiveJobsSummaryParsed` in `marketingCabinetApiZod.ts` |
| marketing-cabinet-full | [`marketingCabinetOpenApi.ts`](../../shared/web/frontend/src/pages/MarketingCabinet/marketingCabinetApi/marketingCabinetOpenApi.ts) — entity CRUD, dashboard layout, performance, AMKA HTTP (Wave 4); **client-interaction JSON outs (Wave B1)** |
| companies-projects | [`marketingCabinetOpenApi.ts`](../../shared/web/frontend/src/pages/MarketingCabinet/marketingCabinetApi/marketingCabinetOpenApi.ts) — `MarketingCompany` / `MarketingProject` = `CompanyResponse` / `ProjectResponse` |

#### Under-adopted → target wave (SSOT program)

Bridge file exists, but hot-path clients still use parallel hand DTOs (or bridge exports only a thin slice). Do **not** grow hand twins; migrate per wave.

| Domain / surface | Symptom | Target wave |
|------------------|---------|-------------|
| MusicForge user REST/SSE | Hand `MusicForgeCapabilities` / `MusicForgeRun`; `languages` OpenAPI drift | **Wave 1 — Done** (BE `MusicForgeLanguageOption`; FE `musicForgeOpenApi` hot path) |
| MusicForge admin hub | Hand admin DTOs while `MusicForgeAdmin*` schemas exist in pilot | **Wave 1 — Done** (aliases + `MusicForgeAdminProductOut` on PATCH product; FE ModeRow/StageRow remain views over detail dict bags) |
| EWA `ewaOpenApi.ts` (plans / runtime / workflows / admin catalog) | Bridge exports only profile presets | **Wave 2 — Done** (`ewaOpenApi` hub; hot-path clients alias OpenAPI) |
| EWA profile / orch envelopes | Dual Out + loose `payload: Record<string, unknown>` | **Wave 2 — Done** (`normalizeCompanionProfileOut`; turn response from `EwaDesktopOrchestrationTurnResponse`) |
| Desktop admin + product-desktop surveys/assistant gaps | Hand beside `desktop-openapi` / `product-desktop-openapi` | **Wave 3 — Done** (`desktopAdminOpenApi`, `productDesktopSurveysOpenApi`, `productDesktopAssistantOpenApi`; BE `SurveyResultsSummaryOut`, `AssistantKb*Out`) |
| Marketing Cabinet bulk | Entity/mutation/dashboard/AMKA HTTP via `marketingCabinetOpenApi`; Zod ⊆ lite keys; SSE stream + widget view configs remain hand | **Wave 4 — Done** |
| Marketing client-interaction JSON | Named Pydantic Out + full-pilot `$ref`; FE aliases (no hand twin) | **Wave B1 — Done** — see `documentation/plans/api/BE-FE-CONTRACT-INTEGRITY-REMEDIATION.md` *[operator-local process plan; gitignored — not living canon]* |
| Ассистент JSON | Named Out + `desktop.openapi.json` `$ref`; `desktopAiChatOpenApi` bridge | **Wave B2 — Done** — see remediation doc |
| PW admin pack/release/rollout/test/export | Named Out + `professional-worlds.openapi.json` `$ref`; admin OpenApi bridge | **Wave B3 — Done** — see remediation doc |
| MF admin lane/prompt/style/mode/stage mutators | Named Out + `music-forge.openapi.json` `$ref`; `musicForgeOpenApi` + admin API | **Wave B4 — Done** — see remediation doc |
| EWA context-anchor / driver-catalog / tiny deletes | Named Out + `ewa.openapi.json` `$ref`; `ewaOpenApi` aliases | **Wave B4 — Done** — see remediation doc |
| Assistant chat / task / desktop-orch SSE + MF run events | Named SSE payload models + `text/event-stream` `$ref`; SurfaceBlock dual SoT with hand overlay | **Wave B5a — Done** — see remediation doc |
| PW realtor/coach text AI SSE | `ProfessionalWorldsAiTextStreamSsePayloadDoc` on three streams; pilot `$ref` | **Wave B5b (PW text) — Done** |
| PW intake / media / playbook SSE | Intake/MediaEnhance/MediaBatch/Playbook stream payload docs; pilot `$ref` | **Wave B5b (PW media) — Done** |
| Marketing AI / chat / AMKA SSE | `MarketingAiAssistStreamSsePayloadDoc` / `MarketingChatStreamSsePayloadDoc` / `AmkaRunEventsStreamSsePayloadDoc`; lite+full pilot `$ref` | **Wave B5b (Marketing residual) — Done** |
| Core4 `response_model` coverage fail-closed | AST audit + pytest; 204/SSE/File allow | **Wave B7 — Done** — see remediation doc |
| OpenAPI nested bare-object bags (field depth) | Schema-depth audit; typed nests + PW manifest bodies | **B9a + B9b + B9c Done** — see remediation doc |
| KBSEW admin DTOs | Bridge Out/In aliases; gateway `response_model` | **Wave 5 — Done** |
| UGS `GenerationType` list / `ProvidersSummary` flatten | OpenAPI `$ref` list + FE aliases; flatten documented on normalizer | **Wave 6 — Done** |
| API-boundary `as unknown as` hygiene + bridge-gate deny | Casts masking contract drift; twin hand DTOs | **Wave 7 — Done** (hook **deny** twin/shadow; soft warn near-bridge; program-domain residual casts **0**) |

Exceptions (not under-adopted debt): documented SSE overlays; pure UI/shell state.

#### Wave 7 closeout metrics (2026-08-06)

| Metric | Value |
|--------|-------|
| Under-adopted program domains (MusicForge / EWA / desktopAdmin+product-desktop / Marketing / KBSEW / UGS) | **0** |
| Bridge hubs | `musicForgeOpenApi`, `ewaOpenApi`, `ewaDesktopOrchestrationOpenApi`, `desktopAdminOpenApi` (+ product-desktop surveys/assistant), `marketingCabinetOpenApi`, `kbsewOpenApi`, `services/api/ugs/schemas.ts` |
| Bridge-gate | Deny twin/shadow hand DTOs; soft warn near-bridge; `failClosed: false` on crash |
| Residual program-domain `as unknown as` (non-test) | **0** — Wave7 `parseDefinitionV2` field-mapped (`canvasMapping.ts`); inventory allowlist empty |
| Residual SSE / hand exceptions | Companion-chat / admin / desktop-orch SSE overlays remain hand pilots; Zod gate Pattern C cleared via `.strip()` / `.catchall(z.unknown())` (no `.passthrough()`) |

Honest repo-wide FE residual (non-test, excluding `generated/`): ~60+ `as unknown as` in UI/DOM/notify/monitoring — **out of Wave 7 scope**.

### Срез полного OpenAPI в пилоты

После экспорта (`documentation/api/eliteew-openapi-export.json`, gitignored):

```bash
cd shared/web/frontend
pnpm run openapi:tooling:install   # once: isolated openapi-typescript + TypeScript 5.x
# Local API container:
pnpm run openapi:refresh-pilots:full
# Or from command-center against prod-core baked API:
pnpm run openapi:refresh-pilots:full:prod-core
pnpm run openapi:check-pilot-freshness   # OPENAPI_MARKETING_FULL=1 after :full
pnpm run api:gap-matrix
```

### Bake-time opt-in: `--refresh-openapi-pilots`

Чтобы **в одном release** SPA собралась с типами текущего API-дерева (без ожидания нового live backend):

```bash
bash docker/scripts/eliteew-deploy.sh release stack0 --all --yes --refresh-openapi-pilots
# эквивалент: eeprodbaked --yes --all --refresh-openapi-pilots
```

Порядок на command-center (внутри `build-stack0-prod-baked-images.sh`):

1. `deploy-provenance-gate` (чистое дерево).
2. **`stack0-refresh-openapi-pilots.sh`**: export OpenAPI из **текущего** `shared/api` (host `.venv` + staging env + `docker/scripts/openapi-export.env.defaults`) → `openapi:extract-pilots` → `openapi:pilots:lite` → freshness.
3. `pnpm build:react-compiler` (уже с обновлённым `src/generated/*`).
4. bake / export / recreate на prod-core.

Ограничения: несовместимо с `--skip-build` и `--skip-frontend-build` (и backend-only без `--with-frontend-build`). После bake working tree может быть dirty на `openapi/pilot/*` и `src/generated/*-openapi.ts` — **закоммитьте пилоты**, когда готовы (это SSOT, не gitignore). **Provenance gate (C):** dirty *только* в этих путях — WARN и release разрешён; любой другой dirty source path — fail closed как раньше. Это **не** runtime wait фронта за бэкендом.

**Bake pitfalls (agent shells):** do not leave `STACK0_*_BAKED_IMAGE` from a prior sync in the environment — build always derives image names from this release `BAKED_TAG` (`eeprodbaked` unsets leftovers). If `HOME=/tmp`, restore the host home before SOPS/env-push (`eeprodbaked` does this when `USER` home exists).

Env for remote export (also used by `openapi:export:prod-core`):

| Variable | Meaning |
|----------|---------|
| `ELITEEW_OPENAPI_SSH_HOST` | SSH host with Podman API container (e.g. `192.168.1.111`) |
| `ELITEEW_API_CONTAINER` | Default `stack0-eliteew-api-prod-baked` |
| `ELITEEW_CONTAINER_RUNTIME` | `podman` (default) or `docker` |
| `OPENAPI_EXPORT` | Override path to full JSON for extract/freshness |

Скрипт: [`shared/web/frontend/scripts/openapi-extract-pilots.mjs`](../../shared/web/frontend/scripts/openapi-extract-pilots.mjs) — по префиксам путей или точному списку путей (узкий marketing) вытягивает `paths` и замыкание `components.schemas` по `$ref`.

**TypeScript 7 + openapi-typescript:** SPA typecheck stays on `typescript@^7`. Generator runs via `shared/web/frontend/tools/openapi-typescript-runtime/` (TypeScript **5.9** + `openapi-typescript@7.13`) because TS 7 removed classic `ts.factory` from the package root. See [`FRONTEND-TOOLCHAIN-AND-BUILD.md`](../platform/FRONTEND-TOOLCHAIN-AND-BUILD.md).

**Desktop `recent-files` / `recent-content-feed`:** если в экспорте у `200` всё ещё пустой `schema: {}`, скрипт подмешивает **`DesktopRecentFileRow`**, **`DesktopRecentContentFeedResponse`** (включая срез **`projects`**) для пилота **`desktop.openapi.json`**. После появления в экспорте полноценных `response_model` с бэка этот шаг становится no-op для этих эндпоинтов.

**Profile `UIPreferences` / desktop shell motion (2026-06-21):** поля **`desktop_shell_*`**, **`desktop_font_*`**, **`desktop_scene_depth`** и др. живут в **`PATCH /api/v1/profile/preferences`** (`user_profile.py` → `UIPreferences`). Pilot **`desktop.openapi.json`** их **не** описывает; канон HTTP-полей — **[PROFILE-API.md](PROFILE-API.md)** + **`src/types/profile.ts`**. Swagger/OpenAPI gap осознанный до появления отдельного profile pilot или расширения full export.

**UGS typed contracts (2026-05, refreshed 2026-08-06 Wave 6):** frontend UGS code should not import `src/generated/ugs-openapi.ts` from components. Generated schemas are wrapped by service-layer aliases in `src/services/api/ugs/schemas.ts` (including `UGSQueueOpsOperatorSlo` / queue-ops snapshot, `GenerationTypeResponse`, `AdminGenerationTypeResponse`, `UGSProvidersStatusSummary`). UI-facing DTOs remain in `src/services/api/ugs/types.ts` (`GenerationType` = OpenAPI `GenerationTypeResponse`; `ProvidersSummary` = documented flatten of `UGSProvidersStatusResponse` via `normalizeUgsProvidersSummary`), `ugsAdmin.ts`, `ugsAdminV2.ts`, `queueOps.ts`, and workflow UI types. Do **not** hand-overlay OpenAPI fields on queue-ops — refresh `openapi/pilot/ugs.openapi.json` + `openapi:pilot:ugs` from a **current-code** export (`export_openapi.py` with stack0 env, or baked image that includes the schema). Backend guard: `api/tests/test_ugs_openapi_contracts.py` (list items `$ref` `GenerationTypeResponse`). Frontend locks: `queueOpsOperatorSlo.contract.test.ts`, `openapiSsotWave6.contract.test.ts`. Flexible payloads (`input_data`, `metadata`, `result`, workflow `workflow_data`, SSE events) stay intentionally loose before cache/UI merge paths.

**Уникальные `operationId` при нескольких методах на одном path:** если в pilot-JSON у `get` / `post` / … стоит **один и тот же** `operationId`, генератор **`openapi-typescript`** создаёт **дубли ключей** в `paths` сгенерированного TS → ошибка **`TS2300`**. На FastAPI для таких маршрутов задавать разные идентификаторы, например через **`router.add_api_route(..., operation_id=f"proxy_site_studio_{method.lower()}")`** (как в `desktop_sites.py`, `kirs.py`).

**Строгие типы патча expansion:** схема `DesktopShellStatePatch` из OpenAPI может описывать вложенные массивы как `{ [key: string]: unknown }[]`. Для полей expansion во фронте — **`ExpansionShellStatePatch`**, **`CoalescedDesktopShellStatePatch`**, **`ExpansionShellSlicePatch`** в **`src/pages/Desktop/types/desktopShellStatePatch.types.ts`** (реэкспорт из **`desktopApi.ts`**). Coalesced writer: **`desktopShellStateWriteCoordinator.ts`**. Константа **`EXPANSION_SHELL_STATE_PATCH_KEYS`** синхронизируется с pilot/`desktop.py` (тест в **`desktopApi.contract.test.ts`**).

Исправление экспорта: OpenAPI берётся с **`api.main.fastapi_app`** (после обёртки Socket.IO), см. [`export_openapi.py`](../../shared/api/scripts/export_openapi.py).

### Аудит `/api/v1/monitoring` (бэкенд)

В [`shared/api/main.py`](../../shared/api/main.py) под `/api/v1/monitoring` есть только **`POST /api/v1/monitoring/logs`** (плюс legacy `POST /api/monitoring/logs`). Полного зеркала `/api/monitoring/*` под v1 нет — `MONITORING.baseUrl` в [`ServiceConfig.ts`](../../shared/web/frontend/src/services/core/ServiceConfig.ts) на `/api/v1/monitoring` не переносить без появления роутов.

## Исключения: не весь трафик идёт через типичный `apiClient`

| Исключение | Где | Причина |
|------------|-----|---------|
| Mobile JSON refresh | MobileAndroid `AuthApi`; path constant [`mobileAuthRefreshPath.ts`](../../shared/web/frontend/src/services/auth/mobileAuthRefreshPath.ts) | `POST /api/auth/refresh` с телом `refresh_token` (mount only under `/api/auth`, см. `domains/auth.py`). **Not** SPA OIDC (`keycloak.ts` / `api/client.ts`). FE `AuthService` / `emperyworldAuthRefresh` soft-retired → `trash/`. |
| Admin UI к внутренним путям | [`adminApiClient`](../../shared/web/frontend/src/services/api/client.ts) + относительные пути вида `/admin/...` в [`config.ts`](../../shared/web/frontend/src/services/api/config.ts) | Отдельная база/права админки. |
| SSE / stream без тела axios | Например [`productDesktopApi.ts`](../../shared/web/frontend/src/pages/Desktop/services/productDesktopApi.ts), [`marketingCabinetApiStream.ts`](../../shared/web/frontend/src/pages/MarketingCabinet/marketingCabinetApi/marketingCabinetApiStream.ts) (`consumeMarketingEventStream`) | Поток + ручной Bearer / полные URL. |
| `<img src>` на URL контента | Превью через blob / прокси | Браузер не шлёт Bearer на произвольный `src`; см. `authenticatedImageUrl` и комментарии в редакторе. |
| Ingest логов в мониторинг | [`ServiceLogger.ts`](../../shared/web/frontend/src/services/core/ServiceLogger.ts) | `POST /api/v1/monitoring/logs` (дубль `POST /api/monitoring/logs` в [`main.py`](../../shared/api/main.py)); `MonitoringService` / [`ServiceConfig`](../../shared/web/frontend/src/services/core/ServiceConfig.ts) по-прежнему **`baseUrl: /api/monitoring`** для относительных путей (`/system`, …), пока нет полного зеркала под `/api/v1`. |

### Пути health на корне приложения (`main.py`)

[`shared/api/main.py`](../../shared/api/main.py) регистрирует:

- **`GET /api/health`** — без admin JWT: `{"ok": bool}` only; с admin JWT (`admin` / `emperyworld_admin` / `msi`) — полный topology (`services`, `ewa_postgres`, `celery_beat`). См. [`api_health_public.py`](../../shared/api/monitoring/api_health_public.py).
- **`GET /api/v1/health`** (versioned alias, тот же контракт)
- **`GET /api/v1/system-info`** (тот же агрегированный payload / тот же public-vs-admin split)
- **`GET /api/database/health`** (без `/api/v1` alias)
- **`GET /api/version`** — публично: `version`, `buildHash`, `appBuildId` (без `environment` / `buildTime`)

Фронт: [`systemHealth.ts`](../../shared/web/frontend/src/services/systemHealth.ts) — не переводить `/api/database/health` на вымышленный `/api/v1/database/health`.

### UGS Admin

Клиент [`ugsAdmin.ts`](../../shared/web/frontend/src/services/api/ugsAdmin.ts): **`baseURL: '/api/v1/ugs/admin'`**, относительные пути `/providers`, `/types`, … — совпадает с монтированием в [`domains/bi_ugs.py`](../../shared/api/domains/bi_ugs.py) (`/api/v1/ugs/admin` и legacy `/api/ugs/admin` на бэке; фронт использует канон v1).

Новые исключения добавлять в таблицу выше и по возможности оборачивать в один небольшой модуль с тестом.

### Оставшиеся `/api/...` без `v1` (инвентаризация)

Типовые случаи из [`fe-be-api-inventory.snapshot.md`](fe-be-api-inventory.snapshot.md); решение — **не мигрировать**, пока нет роутера или редиректа под `/api/v1`.

| Префикс / путь | Решение |
|----------------|---------|
| `/api/health` | Есть в [`main.py`](../../shared/api/main.py), плюс alias `/api/v1/health`. |
| `/api/database/health` | Только в [`main.py`](../../shared/api/main.py), без дубля под `/api/v1`. |
| `/api/auth/*` | Living on `/api/auth` only: **refresh** (MobileAndroid + Keycloak AuthProviderService), plus logout mounts per [`domains/auth.py`](../../shared/api/domains/auth.py). **login** / **exchange-token** — retired/absent on BE. SPA dual-token `emperyworld_*` FE path removed. Keycloak SSO — `/api/v1/auth/sso/*` (and legacy aliases). |
| `/api/emperyworld`, `/api/monitoring` (кроме `…/logs` в `ServiceLogger`) | [`ServiceConfig`](../../shared/web/frontend/src/services/core/ServiceConfig.ts) + BaseService; сверка с бэком перед любым переводом на v1. |
| `/api/config/unified` | Проверить роутер; не менять без ТЗ. |
| `API_PATHS.DASHBOARD` (`/api/v1/dashboard`) | В текущем экспорте OpenAPI **нет** единого префикса `/api/v1/dashboard`; константа в [`config.ts`](../../shared/web/frontend/src/services/api/config.ts) — legacy / тесты ([`client.interceptors.test.ts`](../../shared/web/frontend/src/services/api/__tests__/client.interceptors.test.ts)). Интерактивные дашборды маркетинга — под `/api/v1/marketing-cabinet/projects/...`. |
| Строки-плейсхолдеры в комментариях (`/api/...`, `/api/data`) | Не HTTP-вызовы. |

### Assistant user workflows

Префикс **`/api/v1/ewa/companion-user-workflows`** (сессия companion, как quick-actions). Клиент: [`companionUserWorkflowsApi.ts`](../../shared/web/frontend/src/services/ewa/companionUserWorkflowsApi.ts).

| Method | Path |
|--------|------|
| GET | `/companion-user-workflows/tool-catalog` |
| POST | `/companion-user-workflows/validate` |
| GET | `/companion-user-workflows` |
| POST | `/companion-user-workflows` |
| GET/PATCH/DELETE | `/companion-user-workflows/{id}` |
| POST | `/companion-user-workflows/{id}/enable` |
| POST | `/companion-user-workflows/{id}/disable` |

Chat response может включать `output_surface.mode` (`workflow_dag_builder`, `workflow_edit`, `roadmap`, `script`). Legacy `workflow_builder` from older backends normalizes to `workflow_dag_builder` in the SPA. Канон: [`EWA-COMPANION-USER-WORKFLOWS.md`](../product/ewa/EWA-COMPANION-USER-WORKFLOWS.md).

## Контрактные тесты

- Пути Site Studio: [`siteStudioApi.contract.test.ts`](../../shared/web/frontend/src/features/site-studio/desktop/__tests__/siteStudioApi.contract.test.ts).
- Friends: [`friendsApi.contract.test.ts`](../../shared/web/frontend/src/features/friends/api/__tests__/friendsApi.contract.test.ts).
- Voice-gateway (строки + пилот JSON): [`voiceGatewayPaths.contract.test.ts`](../../shared/web/frontend/src/voice-core/api/__tests__/voiceGatewayPaths.contract.test.ts).
- Marketing project RAG: [`marketingProjectRagApi.contract.test.ts`](../../shared/web/frontend/src/services/api/__tests__/marketingProjectRagApi.contract.test.ts).
- GAF Chat: [`gafChatApi.contract.test.ts`](../../shared/web/frontend/src/pages/Desktop/components/GAFChat/api/__tests__/gafChatApi.contract.test.ts).
- Marketing cabinet streams: [`marketingCabinetApi.contract.test.ts`](../../shared/web/frontend/src/pages/MarketingCabinet/__tests__/marketingCabinetApi.contract.test.ts).
- Empery World auth paths: [`emperyworldAuthPaths.contract.test.ts`](../../shared/web/frontend/src/services/auth/__tests__/emperyworldAuthPaths.contract.test.ts).
- Unified content: [`contentApi.contract.test.ts`](../../shared/web/frontend/src/services/__tests__/contentApi.contract.test.ts).
- Product desktop: [`productDesktopApi.contract.test.ts`](../../shared/web/frontend/src/pages/Desktop/services/__tests__/productDesktopApi.contract.test.ts).
- Desktop user API + pilot: [`desktopApi.contract.test.ts`](../../shared/web/frontend/src/pages/Desktop/services/__tests__/desktopApi.contract.test.ts).
- Document Editor V2: [`documentEditorV2Api.contract.test.ts`](../../shared/web/frontend/src/services/__tests__/documentEditorV2Api.contract.test.ts).
- OpenAPI pilot freshness: [`openapiPilotFreshness.contract.test.ts`](../../shared/web/frontend/src/services/__tests__/openapiPilotFreshness.contract.test.ts) (requires local export).
- EWA desktop orchestration: [`ewaDesktopOrchApi.contract.test.ts`](../../shared/web/frontend/src/services/ewa/__tests__/ewaDesktopOrchApi.contract.test.ts).
- Assistant user workflows: клиент [`companionUserWorkflowsApi.ts`](../../shared/web/frontend/src/services/ewa/companionUserWorkflowsApi.ts), префикс **`/api/v1/ewa/companion-user-workflows`** — канон [`EWA-COMPANION-USER-WORKFLOWS.md`](../product/ewa/EWA-COMPANION-USER-WORKFLOWS.md).
- `API_PATHS` в config: [`apiPaths.contract.test.ts`](../../shared/web/frontend/src/services/api/__tests__/apiPaths.contract.test.ts).
- Маппинг поиска друзей (`relationship_status` → `relationshipStatus`): [`friendSearchCandidateMap.contract.test.ts`](../../shared/web/frontend/src/features/friends/api/__tests__/friendSearchCandidateMap.contract.test.ts).
- ServiceConfig bases: [`serviceConfigPaths.contract.test.ts`](../../shared/web/frontend/src/services/core/__tests__/serviceConfigPaths.contract.test.ts).

## Опциональный CI (без gate на каждый PR)

Пример ручного `workflow_dispatch`: см. [`OPENAPI-PILOTS-CI.md`](OPENAPI-PILOTS-CI.md) и шаблон [`.github/workflows/openapi-pilots-refresh.yml`](../../.github/workflows/openapi-pilots-refresh.yml) (`runs-on: self-hosted`) — экспорт из Docker, `openapi:extract-pilots`, `openapi:pilots:lite` или `:full`, артефакт с `openapi/pilot/` и `src/generated/` (полный `eliteew-openapi-export.json` в git не класть).
