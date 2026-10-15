# EliteEW — Pack layout (living SoT)

**Status:** Living target (2026-08-15). Normative for **how product entrances appear on disk** and how agents/operators scope sessions.  
**Editions (cloud / onprem / client):** [ELITEEW-PRODUCT-EDITIONS-AND-APP-PLATFORM.md](ELITEEW-PRODUCT-EDITIONS-AND-APP-PLATFORM.md).  
**Migration process:** Waves 0–4 **Done** (2026-08-15). Closed checklists/step prompts soft-retired under `trash/` (id 20260815-134408) (not living canon). **This SoT wins.**  
**Cloud runtime topology:** [PRODUCTION-TOPOLOGY-STATE.md](PRODUCTION-TOPOLOGY-STATE.md) §Current.

## 1. Задумка

EliteEW — **один продукт, один monorepo, одна ветка `main`**. Различаются не «два EliteEW в git», а **две двери входа** к одной середине:

| Вход | Кто | Как заходит |
|------|-----|-------------|
| **Cloud** | Основной путь | Браузер и/или **Mobile** → Keycloak → SPA/API/Meet |
| **Organization** | Контролируемый контур | **Connection Agent** (license + WireGuard) → браузер → Keycloak → тот же SPA/API/Meet |

Середина (API, SPA, apps, Meet, Keycloak, docker stacks) **общая**. Двери **разные** и должны быть **видны в дереве каталогов**, иначе и оператор, и агент галлюцинируют «что рядом лежит».

Канон-only split без папок `pack-*` — **недостаточен** (парадокс «лежит вместе / в голове раздельно»). Цель раскладки — чтобы session scope = **две директории** (shared + один pack).

## 2. Целевое дерево

```text
powered_by_emperyworld/
├── shared/                    # shared core ON DISK (Wave 4 physical)
│   ├── api/
│   ├── web/frontend/
│   ├── apps/
│   ├── packages/              # private @eliteew/* (Wave leftover)
│   └── tools/                 # neutral packages baked into API (runtime alias /app/shared_tools)
├── host/                      # ops-data (Wave Host-1): comfyui, generated_files, runtime, kernel-offline
├── .venv/                     # host API tooling (IDE/pytest; not in images)
├── pack-cloud/                # облачная дверь (Wave 1 Done)
│   ├── README.md
│   └── mobile/                # бывший MobileAndroid/
├── pack-organization/         # org-дверь (Wave 1 Done)
│   ├── README.md
│   ├── connection-agent/      # former mid-alias desktop-client door
│   ├── kiosk-fedora-iso/      # portal kiosk ISO workspace (gitignored)
│   └── trusted-substrate/     # sealed from-source OS carrier (stub; SoT only)
├── docker/                    # общий runtime/ops (stacks, scripts)
├── documentation/
├── tools/                     # host/CI utilities (not in API images)
├── scripts/                   # host shell wrappers (not deploy SoT — see docker/scripts/)
├── KBSEW/                     # adjacent knowledge service (not a pack door)
├── site-templates/            # Site Studio templates (adjacent)
└── keys/                      # secrets tree (hard-blocked; not product mid)
```

**Normative mid (Wave 4 / `M4.1`):** **shared** = `shared/api` + `shared/web/frontend` + `shared/apps` (+ `docker/` as shared infra).  
**Ops-data (Wave Host-1):** `host comfyui / generated_files / runtime / kernel-offline}` — bake `host/kernel-offline` → `/app/shared`; prod binds `host/comfyui` → `/app/comfyui`.  
Agent indexing: `host comfyui / generated_files / runtime}` hard-blocked in `.cursorignore`; `host/kernel-offline` + `host/README.md` stay readable.  
Do **not** recreate `EliteEW/` as product mid — retired leftover (Wave leftover 2026-08-16); mid is `shared/` + host `.venv` + `shared/packages/` + `shared/tools/`.  
Wave 2 **alias** (`shared api/web/apps (mid-alias EliteEW tree retired)}` as shared) is **superseded**.

### Tooling trees (do not confuse)

| Path | Role | In stack0 API image? |
|------|------|----------------------|
| `shared/tools/` | Neutral Python packages (`i18n_rewriter`, …); host SoT | **Yes** — COPY/mount as **`/app/shared_tools`** (runtime/NFS alias name kept) |
| `tools/` | Host/CI: architecture guard, `check_all.sh`, KBSEW MCP | No |
| `scripts/` | Host wrappers (`scripts/eliteew/`, backups, meet-media) | No |
| `docker/scripts/` | Canonical ops CLI (`eectl`, bake, prod-line) | N/A (ops host) |

### Adjacent (not pack doors)

| Path | Role |
|------|------|
| `KBSEW/` | Knowledge / eval service — separate product surface |
| `site-templates/` | Site Studio storefront templates |
| `keys/` | TLS/SSH material — never product mid; agent hard-block |
| `tools/`, `scripts/` | See tooling table above |

These stay at monorepo root. **Do not** invent `pack-kbsew/` or move them under a door without an explicit operator Scope lock.

**Wave 0:** SoT + plan + Cursor OS — **done**.  
**Wave 1:** doors on disk — **Done** (`W1-M1.5`).  
**Wave 2:** shared = **alias** — **Done** (`W2-M2.3`); superseded by Wave 4.  
**Wave 3:** CI/release matrix — **Done** (`W3-M3.3`).  
**Wave 4:** physical `shared api / web / apps}` — **Done** (disk); Commit Package = `W4-M4.3`.

### Paths (Wave 4 physical shared)

| Сегодня | Целевой pack / роль |
|---------|---------------------|
| `shared/api/`, `shared/web/frontend/`, `shared/apps/` | **shared** (physical `W4-M4.1`) |
| `shared/tools/` | **shared** neutral packages (runtime alias `/app/shared_tools`) |
| `shared/packages/` | **shared** private `@eliteew/*` |
| `host/comfyui`, `host/generated_files`, `host/runtime`, `host/kernel-offline` | **ops-data** (Wave Host-1; not product mid) |
| `docker/stack/`, общие `docker/scripts/` | **shared infra** (остаются под `docker/`) |
| `tools/`, `scripts/`, `KBSEW/`, `site-templates/`, `keys/` | **adjacent** (not pack doors; see §2 tables) |
| `pack-cloud/mobile/` | **pack-cloud** / mobile (бывший `MobileAndroid/`) |
| `pack-organization/connection-agent/` | **pack-organization** / connection-agent (former mid-alias desktop-client door) |
| `pack-organization/kiosk-fedora-iso/` | **pack-organization** / portal kiosk ISO workspace (gitignored) |
| `documentation/product/mobile/` | docs двери cloud |
| `documentation/product/desktop/` | docs двери org (agent / seats / FoFline) |

## 3. Session scope (HARD для агента и оператора)

| Работаешь над… | Открыт scope | Не трогать без явной просьбы |
|----------------|--------------|------------------------------|
| Облачный продукт | **shared** (`shared api / web / apps}`) + **pack-cloud** (`pack-cloud/mobile/`) | pack-organization / connection-agent |
| Org / agent / license / WG | **shared** + **pack-organization** (`pack-organization/connection-agent/`) | pack-cloud / mobile |
| Общий контракт (API / Meet / Keycloak / compose) | **shared** (+ `docker/` + topical docs) | обе двери, пока оператор не расширит scope |
| Оба pack’а сразу | Только после явного **scope expanded** в текущем сообщении | — |

Если неясно — сначала этот SoT и README pack’а, не «положу рядом в EliteEW/».

## 4. Таблица: модуль → pack

| Область | Путь (as-is) | Pack |
|---------|--------------|------|
| API | `shared/api/` | shared |
| Product SPA | `shared/web/frontend/` | shared |
| Desktop app manifests | `shared/apps/` | shared |
| Runtime stacks | `docker/stack/` | shared infra |
| Keycloak / Meet | stack6 / stack11 | shared infra |
| Mobile Android | `pack-cloud/mobile/` | **pack-cloud** |
| Tauri desktop-client | `pack-organization/connection-agent/` | **pack-organization** |
| Portal kiosk ISO | `pack-organization/kiosk-fedora-iso/` | **pack-organization** (gitignored) |
| Desktop seats / FoFline docs | `documentation/product/desktop/` | org-facing docs (связь с pack-organization) |
| Mobile docs | `documentation/product/mobile/` | cloud-facing docs |

### Релиз (норма)

| Артефакт | Cloud release | Org release |
|----------|:-------------:|:-----------:|
| stack0 SPA+API bake | yes | yes (тот же или их контур) |
| Mobile APK / OTA | yes | no (не обязателен для org-двери) |
| Tauri / Connection Agent RPM·NSIS | **no** | yes |
| Seat / device license issue | no | yes |

**Operator contours (Wave 3):**

| Contour | Command (command-center) | Pack tree |
|---------|--------------------------|-----------|
| Shared stack0 | `bash docker/scripts/eliteew-deploy.sh release stack0 --all` | `shared api / web / apps}` |
| Cloud mobile | `eemobile --yes --all` → `docker/scripts/mobile-apk-release-cycle.sh` | `pack-cloud/mobile/` |
| Org agent OTA | `bash scripts/eliteew/desktop-client-ota-release.sh` | `pack-organization/connection-agent/` |

**HARD:** не смешивать cloud mobile job и org agent OTA в одном прогоне без `ELITEEW_PACK_ALLOW_CROSS_DOOR=1`.  
Checklist: [ELITEEW-RELEASE-CHECKLIST.md](ELITEEW-RELEASE-CHECKLIST.md) §Pack release.  
Pack stubs: [pack-cloud/release/](../../pack-cloud/release/) · [pack-organization/release/](../../pack-organization/release/).

**Wave 3:** CI/release matrix — **Done** (`W3-M3.3`).

## 5. FoFline и editions

- **FoFline** / connected desktop — **родственный** org/connected pack (license + WG + device-local surface). Не плодить третий корневой `pack-fofline/` без отдельного operator решения; описывать связь в product desktop canon и в этом SoT.
- **Editions** (`cloud` / `onprem` / `client`) остаются осями *runtime/install profile* в [ELITEEW-PRODUCT-EDITIONS-AND-APP-PLATFORM.md](ELITEEW-PRODUCT-EDITIONS-AND-APP-PLATFORM.md).  
  **Pack layout** — ось *директорий и дверей входа*. Cloud edition ↔ pack-cloud + shared; organization entrance ↔ pack-organization + shared.

## 6. Не-цели

| Forbidden | Why |
|-----------|-----|
| Долгие git-ветки `main` vs `organization` как два продукта | Разъезд истории, двойной merge tax |
| Копии `api/` / `web/` внутри каждого pack | Два EliteEW снова |
| Тащить Tauri в cloud-релиз «на всякий случай» | Путаница двери; WebKit Meet не cloud-path |
| Считать Mobile частью org-двери | Mobile остаётся с **cloud** |
| Канон-only split без видимых `pack-*` на диске (после Wave 1) | Снова парадокс для человека и AI |

## 7. Related

| Topic | Doc |
|-------|-----|
| Editions / Kernel vs App | [ELITEEW-PRODUCT-EDITIONS-AND-APP-PLATFORM.md](ELITEEW-PRODUCT-EDITIONS-AND-APP-PLATFORM.md) |
| Migration (closed) | Soft-retired process docs under `trash/` (id 20260815-134408) (not living); living layout = this file |
| Desktop connected / seats | [../product/desktop/DESKTOP-TAURI-CONNECTED-CLIENT.md](../product/desktop/DESKTOP-TAURI-CONNECTED-CLIENT.md) |
| FoFline | [../product/desktop/DESKTOP-FOFLINE-EDITION.md](../product/desktop/DESKTOP-FOFLINE-EDITION.md) |
| Mobile | [../product/mobile/](../product/mobile/) |
| Meet media | [../product/INTERNAL-VIDEO-CALLS.md](../product/INTERNAL-VIDEO-CALLS.md) |
| Cursor rule | `.cursor/rules/eliteew-product-editions-app-platform.mdc` |
