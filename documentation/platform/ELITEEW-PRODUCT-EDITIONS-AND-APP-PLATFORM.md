# EliteEW — Product Editions & Desktop App Platform (draft)

**Status:** Draft target architecture (2026-08-04). Rules/direction vector aligned in `.cursorrules` + `eliteew-product-editions-app-platform.mdc` (Phase 0 vocabulary). Not a claim that the living runtime already implements install checkboxes or offline client packaging.
**Living cloud runtime today:** [PRODUCTION-TOPOLOGY-STATE.md](PRODUCTION-TOPOLOGY-STATE.md) §Current · [project_master_card.md](../project_master_card.md).
**Pack layout (directories / entrances on disk):** [ELITEEW-PACK-LAYOUT.md](ELITEEW-PACK-LAYOUT.md) — **shared** = alias to `shared api / web/frontend / apps (mid-alias EliteEW tree retired)}` + doors `pack-cloud` / `pack-organization` (migration waves Done; process checklists → `trash/`). Editions = runtime/install profiles; pack layout = which entrance folders agents open.
**Related shell (already living):** [DESKTOP-SHELL-U1-APP-REGISTRY-DESIGN.md](../product/desktop/DESKTOP-SHELL-U1-APP-REGISTRY-DESIGN.md) (scroll/portal registry) · [DESKTOP-API-AND-APPS.md](../product/desktop/DESKTOP-API-AND-APPS.md) · [DESKTOP-APP-STORE.md](../product/desktop/DESKTOP-APP-STORE.md) · [SHELL-LIFECYCLE-AND-CHROME-SSOT.md](../product/desktop/SHELL-LIFECYCLE-AND-CHROME-SSOT.md).

## 1. Goal

EliteEW becomes a **platform + pluggable Desktop applications**, shippable as:

1. **Cloud edition** — shared multi-tenant (or shared-infra) product use as today.
2. **On-prem / team edition** — customer installs an isolated stack (LAN / private cloud / their hosts); accounts and data stay inside their boundary.
3. **Client / offline-capable edition** — Desktop (or wrapped app) runs primarily on-device; network API is optional and scoped (selected tools, or user-chosen AI: local / third-party / EliteEW cloud).

New applications attach by **manifest + template**, not by forking another full product tree (the soft-retired DEWA / EWGen / EWPower / EWC / EWCO / SSFEW / genEW-style stacks under `trash/` and external trees are **capability harvest sources**, not living second universes).

**Modularity means clear boundaries and manifests — not a maximum number of containers.**

## 2. Non-goals (explicit)

| Non-goal | Why |
|----------|-----|
| Every Desktop app = its own independent SaaS stack | Already failed as DEWA/EWPower/EWGen zoos; N auth/deploy/env surfaces. |
| Apps talk **only** via shared DB rows (no HTTP/SSE for UX) | Fine for async jobs; bad as the only chat/UX path (latency, streaming, schema-as-API). |
| Resurrect soft-retired trees as parallel products | Harvest features into EliteEW modules; do not restore whole trees without an explicit operator restore task. |
| Invent a second production topology for cloud | Cloud edition remains [PRODUCTION-TOPOLOGY-STATE.md](PRODUCTION-TOPOLOGY-STATE.md) §Current until a cutover doc says otherwise. |

## 3. Product editions

### 3.1 Comparison

| Axis | **Cloud** | **On-prem / team** | **Client / offline-capable** |
|------|-----------|--------------------|------------------------------|
| Who runs infra | Empery (prod-core / edge / gpu as today) | Customer (or managed private) | Mostly the end-user device |
| Isolation | Shared platform; tenant/RBAC boundaries | Strong: no shared tenancy with other customers | Strongest for local data; optional sync |
| Auth | Keycloak / OIDC as today | Same **protocol**, local IdP or bundled Keycloak | Local session / device identity; cloud OIDC only when user opts in |
| Desktop apps | Profile + entitlements | Install profile (checkboxes) at deploy | Manifest subset baked into the client + runtime toggles |
| AI | Platform LLM / gpu141 / Comfy paths | Customer GPU or remote they configure | **User chooses:** local models, third-party API, and/or EliteEW API |
| Update model | Platform release (`eliteew-deploy.sh` …) | Customer pulls / applies release packages | App store / OTA / packaged client; API optional |

### 3.2 Cloud (current product use)

- Users use EliteEW hosted on the living topology (build on command-center, run on prod-core, etc.).
- Desktop apps are surfaces inside the SPA shell; backend mostly stack0 (+ workers, LLM stacks).
- Edition / profile env (living): `ELITEEW_PRODUCT_EDITION=cloud` (default); empty `ELITEEW_INSTALL_PROFILE` → `cloud-full`.
- `cloud-full` is `access_mode=managed`: MIT grants source/runtime freedoms, while access to the official hosted service still follows its account, RBAC, capacity, and commercial service policy. The browser profile does not use native seat activation.

### 3.3 On-prem / team

- Same **codebase and manifests** as cloud; different **install profile** and **secrets/host binding**.
- “Easy reroll today” is acknowledged: compose + env already allow private deploy — the target is a **first-class profile** (documented package, smoke, IdP bootstrap), not a one-off ops ritual.
- Data and accounts stay in the customer boundary; no dependence on Empery prod-core for day-to-day use.
- Edition: `ELITEEW_PRODUCT_EDITION=onprem` (+ default profile `onprem-team-core` when `ELITEEW_INSTALL_PROFILE` empty).
- Community contract: `onprem-team-core` is `access_mode=community` and `seat_activation_required=false`. A customer may run this self-hosted profile without a paid EliteEW seat or activation service; OIDC/RBAC and local administrator permissions remain enforced.

### 3.4 Client / offline-capable

- Frontend (or a wrapped Desktop app) is the primary runtime on the device.
- **Offline-first** for shell UX that can work without network (local state, local AI where configured).
- Network is **capability-scoped**, not “all or nothing”:

  | Mode | Meaning |
  |------|---------|
  | `ai.local` | User-configured local inference (llama.cpp / Ollama / etc.) |
  | `ai.third_party` | User-supplied API keys/endpoints |
  | `ai.eliteew` | EliteEW cloud/on-prem API for selected tools only |
  | `tools.remote` | Explicit allowlist of remote tools (search, UGS, billing, …) |

- The user does not need a permanent full API surface; remote calls are opt-in per tool/family.
- **API hard gate (living):** when `ELITEEW_PRODUCT_EDITION=client`, `oauth2_protection` enforces `client_remote_tools.py` (bootstrap prefixes + mapped `client.remote_tools_allowlist` tool ids + `CLIENT_REMOTE_TOOLS_EXTRA_PREFIXES`). YAML alone is not enough.
- **AI hard floor:** client default allowlist is `ai.local` only; `ai.third_party` / `ai.eliteew` require `ELITEEW_AI_PROVIDERS_ALLOWLIST`.
- Edition: `ELITEEW_PRODUCT_EDITION=client` (default profile `client-offline-ai` when profile env empty; plus client feature flags).
- **Desktop-client seat modes (product IA):** operators and end users choose **`offline`** / **`cloud`** / **`both`** — not raw profile ids. Flags SoT: `allow_offline` + `allow_online` on `desktop_client_licenses` (patchable without key rotation). Internal map: `offline` → edition `client` + profile `client-offline-ai`; `cloud` → edition `connected`; `both` → offline pack apps + online channel under one license. Optional **`allowed_email`** at issue, else **claim on first successful desktop login** (`POST /session/assert`); then only that Keycloak account. Default seat issue = **offline**. **Issue SoT:** Admin «Выдать место» or `desktop-client-issue-seat.sh` / `issue-connected.sh` (API → Postgres). Wave 2 print+SQL `desktop-client-issue-license.sh` is **retired** (`trash/`). Living: [`DESKTOP-TAURI-CONNECTED-CLIENT.md`](../product/desktop/DESKTOP-TAURI-CONNECTED-CLIENT.md) §Ops issue paths + seat journey + #015.

### 3.4.1 FoFline (client-adjacent connected pack)

**FoFline** (target) is a **licensed device-local EliteEW product SPA**: signed **SPA pack via OTA**, run inside the FoFline shell, with **mandatory WireGuard** to the **same** stack0 API — not pure air-gap offline, not a second prod backend. Auth: same realm `empery` + public PKCE client **`empery-fofline`**; SSO **`client_class=fofline`** with **session XOR** vs browser. Additive over living desktop-client / cloud / offline packs.

- **Hub:** [`DESKTOP-FOFLINE-EDITION.md`](../product/desktop/DESKTOP-FOFLINE-EDITION.md) — target local SPA vs **dev-only** remote Start; dual OTA (public Linux shell **0.4.63** RPM-only; last dual-OS NSIS **0.4.61**; SPA pack **`1786238708853-jn25ybw0v0`**); foundation W1–W5 (W5 allowlist includes `fofline-connected` surface plus **gaf-chat** and **video-calls**; admin/marketing/factory stay denied); Local-SPA L1–L5; **asset groups + surface** (§17 A0–A4; **A0–A3 Done**; **A4 Partial** — poet seat residual). EmpiierOS WebKit is the same SPA: Socket.IO origin `https://app.eliteew.ru` on `fofline-spa:`; Meet iframe is not the OS success path.
- **Editions fit:** Kernel + stack0 shared with cloud; device-local delivery; remote-tools **required** (unlike optional `tools.remote` in §3.4). Static locality = core pack + optional hashed groups (`spa-assets-latest.json`); data plane stays scoped API over WG.
- **Runtime honesty:** Foundation (entitlement, SSO, shell OTA, local Start cutover) is **shipped**. **A0–A3 Done** (smart asset sync + `fofline-connected` surface gate). Residual **A4** = live seat smoke (§17.8) + poet pack parity — not a claim that remote `app.eliteew.ru` Start is the Done product path.

### 3.4.2 Trusted Substrate (sealed OS carrier — target)

**Trusted Substrate** is a **bare-metal kiosk OS** built from source with an EliteEW-built toolchain, hosting an EliteEW desktop **payload** (bootstrap: Electron installer; target: living Tauri / FoFline). It is **not** the Fedora portal Chromium kiosk and **not** a rewrite of Connection Agent. Tree: `pack-organization/trusted-substrate/` (stub). Living end-state SoT: [`ELITEEW-TRUSTED-SUBSTRATE.md`](../product/desktop/ELITEEW-TRUSTED-SUBSTRATE.md). Waves: `documentation/plans/product/desktop/ELITEEW-TRUSTED-SUBSTRATE-PLAN.md` *[operator-local process plan; gitignored — not living canon]* (W0–W8).

### 3.5 One product, three delivery shapes

```text
                 ┌──────────────────┐
                 │ App Manifests    │
                 │ Install Profiles │
                 └────────┬─────────┘
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
     Cloud pack      On-prem pack    Client pack
   (hosted run)    (customer host)  (device + optional API)
```

Kernel contracts stay shared; **packs** differ by which modules and runtimes are included and where they execute.

## 4. Platform shape: Kernel vs App

```text
┌─────────────────────────────────────────────────────────────┐
│ Platform Kernel (always in a given edition pack)            │
│  identity/auth protocol, Desktop shell, app registry,       │
│  config plane, storage adapters, job/event contracts,       │
│  install-profile resolver, AI router (local/3p/eliteew)     │
└─────────────────────────────┬───────────────────────────────┘
                              │ manifest enablement
        ┌───────────┬─────────┴─────────┬───────────┐
        ▼           ▼                   ▼           ▼
     Chat*       EWA*              Marketing*    Gen/Forge*
   (optional)  (optional)         (optional)    (optional)
```

\*A **module** = manifest + FE surface + API surface + optional worker/container — not a second Keycloak and not a second “whole product”.

### 4.1 Kernel responsibilities

- Auth **protocol** (OIDC/JWT patterns); edition chooses IdP placement.
- Desktop shell (windows, taskbar, portal/scroll registry — living U1).
- **Product App Registry** (broader than U1 scroll/portal): which apps exist, entitlements, required capabilities.
- Config / feature flags / install profile resolution.
- Shared data adapters (Postgres, object store, vector) behind stable interfaces.
- **AI provider router** (especially critical for client edition).
- Observability hooks and fail-closed defaults.

### 4.2 App (module) responsibilities

- Domain UX + domain API under a stable prefix or package boundary.
- Declare required capabilities in the manifest (`auth`, `pg`, `qdrant`, `llm`, `gpu`, `comfy`, …).
- Optional dedicated process/container **only when** isolation/scale justifies it (see §7).
- No silent import of unrelated domains (see domain boundary gate / EWA vs marketing rules).

## 5. App Manifest (living SoT path)

**Path:** `shared/apps/` + `<app_id>/app.manifest.yaml`
**Schema:** `shared/apps/_schema/app.manifest.schema.json` (+ Pydantic in `api/services/desktop_app_manifests/`)
**README:** `shared/apps/README.md`
**Validate:** `bash scripts/eliteew/validate-app-manifests.sh`

`KNOWN_DESKTOP_APP_COMPONENTS` (backend catalog validation) =
**union** of all manifest `surfaces.desktop.app_component` values **and**
`shared/apps/_legacy/known_desktop_app_components.legacy.json`.
When an app gains a full manifest, remove its component from legacy (no overlap).

Gold / migrated manifests: see `shared/apps/README.md` (**19** apps; Phase 1c waves stopped). Remaining heavy/legacy-hidden ids stay in `_legacy` until module work.

Example:

```yaml
id: desktop_ai_chat                 # stable snake / app_component aligned
title: Ассистент
edition_default:
  cloud: true
  onprem: true
  client: true                      # may still require ai.local or ai.eliteew
requires:
  - auth
  - postgres
  - llm                             # satisfied by ai.local | ai.third_party | ai.eliteew
optional_runtime:
  kind: in_process | process | container
  # container only when blast radius / scale proven
surfaces:
  desktop:
    app_component: DesktopAiChatApp # must match living DESKTOP-API-AND-APPS
    icon: ...
  api:
    prefixes: ["/api/v1/desktop-ai-chat"]   # example; living paths win until cutover
  jobs:
    queues: []                      # optional Celery / UGS families
client:
  offline_capable: partial          # none | partial | full
  remote_tools_allowlist: ["llm.eliteew", "rag.index"]
```

**Rules:**

- `id` / `app_component` stay aligned with [DESKTOP-API-AND-APPS.md](../product/desktop/DESKTOP-API-AND-APPS.md).
- Unknown keys fail closed (Pydantic `extra=forbid`).
- Enabling an app without satisfying `requires` is a deploy/client config error, not a half-broken icon.
- Shell scroll/portal remains U1 `appRegistry*` — not duplicated in manifest v0.

## 6. Install profiles & checkboxes

An **install profile** is a named set of manifest ids (+ edition).

**Living SoT (Phase 2 foundation):** `shared/apps/_profiles/*.yaml`
**Resolver:** `api/services/desktop_app_manifests/profiles.py` (`resolve_enabled_app_components`, `is_app_component_enabled`)
**Runtime env wire:** `api/services/desktop_app_manifests/runtime.py` + `UnifiedConfig` keys `ELITEEW_PRODUCT_EDITION` / `ELITEEW_INSTALL_PROFILE`
**API:** `GET /desktop/install-profile` schema v3 (`api/routers/desktop_install_profile.py`); FE client `getDesktopInstallProfile()`
**Store gate:** `GET/POST /desktop/store*` and install path filter by active enabled `app_component`
**Validate:** `bash scripts/eliteew/validate-app-manifests.sh` (includes profiles)

| Profile id | Intent | Mode | Access / activation |
|------------|--------|------|---------------------|
| `cloud-full` | Current broad Desktop surface on hosted topology | `edition_default` + legacy union | managed service; no native seat |
| `onprem-team-core` | Shell + core apps; no marketing / unified admin / customer cabinet | `allowlist` | community; no seat activation |
| `client-offline-ai` | Official client pack: manifests with `edition_default.client=true` | `edition_default` | managed channel; signed seat |
| `fofline-connected` | Official FoFline connected surface | `allowlist` | managed channel; signed seat |

**Rules:**

- `edition_default[edition]` is a **hard floor** — profile cannot enable an app marked false for that edition.
- `include_legacy` only for `edition: cloud` (transition until heavy apps leave `_legacy`).
- Unknown allowlist manifest ids → fail closed.
- `access_mode=community` + `seat_activation_required=true` is invalid and fails profile validation.
- `access_mode` separates the right to run MIT code from access to an operator-managed service/delivery channel. It does not disable OAuth2, RBAC, remote-tool allowlists, or host permission checks.
- **Dual-flag:** empty `ELITEEW_INSTALL_PROFILE` → default profile for `ELITEEW_PRODUCT_EDITION`; if both set and `profile.edition ≠ edition` → **503** / `InstallProfileConfigError` (fail closed).
- FE Start/Taskbar/App Store: `useDesktopInstalledApps` + launch paths consume `GET /desktop/install-profile` (`enabled_app_components`) as defense-in-depth over the server store gate.
- Compose generation / installer checkbox UX — still Phase 3+.

Operator / installer UX (target):

1. Choose edition (cloud pack is internal; customer sees on-prem or client).
2. Check applications (or pick a profile).
3. Generate: compose overlay / enabled flags / FE build defines / nginx routes as needed.
4. Smoke against the profile’s health matrix.

**Today’s approximation:** App Store + entitlements + feature flags — profile env gates catalog/install server-side; Start/Taskbar/launch also filter via `getDesktopInstallProfile`.

## 7. Runtime units (when to split process/container)

| Stage | Mechanism | Use when |
|-------|-----------|----------|
| 0 | Feature flag / manifest off | Hide app; same process |
| 1 | In-process module boundary | Default for most Desktop apps |
| 2 | Second process, same image | Chat/LLM CPU isolation without new repo |
| 3 | Dedicated container/image | Proven blast radius, scale, or GPU locality |

Do **not** jump to stage 3 for “clean folders”. Prefer stage 0→1 first (registry + template).

**DB as bus:** allowed for **async jobs** (outbox / queue tables / Celery). Not the primary interactive UX channel (chat streaming stays SSE/HTTP or local IPC in client edition).

## 8. Auth across editions (why tokens still matter)

Auth is a **trust boundary**, not a cloud-only habit.

| Edition | Where trust is enforced |
|---------|-------------------------|
| Cloud / on-prem | Gateway/API validates OIDC; apps trust kernel identity |
| Client offline | Local principal; remote calls carry tokens **only** for opted-in tools |
| Shared DB writers | Still need authenticated writer identity — DB is not an IdP |

“User never sees an API” means the **shell** is the UX; the shell still talks to kernel/local adapters. Hiding URLs does not remove authorization.

## 9. AI routing (client edition focus; useful everywhere)

**Living policy module:** `api/services/ai_provider_router/` (`resolve_provider_kind`, `get_active_ai_provider_snapshot`, `probe_eliteew_http_provider`).
**Env:** `ELITEEW_AI_PROVIDER_DEFAULT`, `ELITEEW_AI_PROVIDERS_ALLOWLIST` via `UnifiedConfig`.
**Client pack canon:** [ELITEEW-CLIENT-OFFLINE-AI-PACK.md](ELITEEW-CLIENT-OFFLINE-AI-PACK.md).

```text
request → get_active_ai_provider_snapshot(edition, allowlist, user_pref, default)
       → local | third_party | eliteew
       → provider adapter (eliteew HTTP probe living; local/3p incremental) → stream/result
```

- Pack/edition allowlist is a **hard floor** — user preference cannot enable a forbidden provider.
- Fail closed if required provider missing (`AiProviderNotConfiguredError`).
- `GET /desktop/install-profile` exposes resolved `ai_provider` best-effort (does not break Start on AI misconfig).
- No secrets in FE for third-party keys beyond OS-secure storage patterns.
- EliteEW adapter probe uses `llama_url` / `default_ai_model`; **O3b** service completions; **O3c–O3e** Tauri local / third_party (keyring) / eliteew (network-gated).

## 10. Harvest from retired / external trees

| Source | Treatment |
|--------|-----------|
| soft-retired DEWA under `trash/`, `EWPower` | Operator/energy capabilities → EliteEW modules if product still wants them |
| soft-retired EWGen under `trash/`, external `/data/repos/genEW` | Generation / factory mechanisms → **Gen/Forge** Kernel (+ companion modules when UX fits) |
| soft-retired EWC under `trash/`, `EWCoderOrchestrator` | Agentic/coding plane → optional module |
| soft-retired SSFEW under `trash/` | Hub/agent patterns → EWA/companion, not a second hub product |

Criterion: *what Desktop button or install checkbox does this enable?* If only “another compose”, do not bring it back as a tree.

**Agent workflow (living):** skill **`eliteew-capability-harvest`** / `/eliteew-capability-harvest` — read-only inventory + target map; **Approval required** before port or `/eliteew-app-scaffold`. Prefer snapshot soft-retired under `trash/` (id 20260718-015129) when present. Never restore whole product trees to repo root without an explicit operator restore task.

**Gen/Forge factory harvest (program):** [ELITEEW-GENEW-FACTORY-HARVEST.md](ELITEEW-GENEW-FACTORY-HARVEST.md) — mechanisms A–H from genEW into Kernel (mount verify, recipe packs, Intention FSM, Admin Factory). Wave 0 = canon only; runtime factory **not** claimed Done. Plan: retired Cursor plan `genew_factory_harvest_ec52b368.plan.md` (not in monorepo tree).

## 11. Roadmap (suggested phases)

### 11.1 Editions / app platform

| Phase | Outcome | Proof |
|-------|---------|--------|
| **0** | Canon + agent rules + Cursor editions skill | Done (2026-08) |
| **1a** | Manifest SoT path + schema + gold apps + KNOWN loader ∪ legacy | Done — `shared/apps/`; validate + pytest |
| **1b** | App scaffold skill (manifest + FE stub + locks) | Done — skill `eliteew-app-scaffold` (**not** factory verify / Intention) |
| **1c** | Migrate medium apps off legacy | **Done (stop)** — **19** manifests, legacy **24**; further migrate only when touching the module |
| **2** | Install profiles + env/API + Start FE gate | Done — store/API + `useDesktopInstalledApps` / launch filter via install-profile |
| **3** | On-prem install profile package (compose/env/smoke) | **Foundation Done** — pack canon + env overlay + `smoke-install-profile.sh`; full customer compose/IdP still open |
| **4** | Client pack: offline shell + AI router (local/3p/eliteew) | **Foundation+wire** — pack + policy + UnifiedConfig env + eliteew HTTP probe + install-profile v2; chat adapters/wrapper still open |
| **5** | Optional process/container only for hot modules | Measured isolation benefit |

### 11.2 Gen/Forge factory harvest (from genEW)

| Wave | Outcome | Proof |
|------|---------|--------|
| **F0** | Program canon + harvest source-map includes external genEW | **Done** — [ELITEEW-GENEW-FACTORY-HARVEST.md](ELITEEW-GENEW-FACTORY-HARVEST.md) |
| **F1** | Declarative Desktop mount registry + FE/API KNOWN sync | **Done** — `appMounts.registry.ts` / `resolve.tsx` + generated FE known JSON + parity Vitest |
| **F2** | `verify-app-factory` DoD (D1–D3 adapted) | **Done** — `scripts/eliteew/verify-app-factory.sh`; gold + `--all-manifests` |
| **F3** | Fix-generator rule + protect-scaffold hook | **Done** — `eliteew-fix-generator-not-capsule.mdc` + `protect-scaffold-outputs.py` + template freeze |
| **F4** | Recipe packs + golden registry | **Done** — `.cursor/orchestration/recipes/` + P18 + `pack_golden_law` + `/eliteew-factory-plan` |
| **F5** | Factory Intention FSM + admin API + Admin Factory UI (flagged) | **Done** — `ewa_platform/factory/` + `/desktop/admin/factory` + Celery `ewa_factory` (opt-in async) |
| **F6** | Factory memory atoms + extract-adapt dry-run | **Done** — `factory/atoms` + `context_pack` + `extract-adapt-map.py` |
| **F7** | Config-driven assembly pilot (Gates T∧C) | **Done** — `ELITEEW_FACTORY_ASSEMBLY` default OFF + Gate T∧C evaluate |

## 12. Failure / Edge-Case Matrix (editions)

| Axis | Behavior |
|------|----------|
| **Offline-mode** | Client: declared offline subset works; remote tools fail visibly. Cloud/on-prem: standard degrade. |
| **Dual-flag / conflict** | Install profile vs runtime entitlement: **deny** if profile disabled the app. AI: user setting cannot enable `ai.eliteew` if pack forbids it. |
| **Permission / access** | Default deny cross-app data; authz at kernel. Client remote tools require explicit allowlist. |
| **Regression command** | Per profile: `bash scripts/eliteew/smoke-install-profile.sh --profile <id>`; cloud remains existing stack0/user-path gates. |

## 13. Relation to living code (honest delta)

| Living today | Gap to this canon |
|--------------|-------------------|
| Cloud topology + stack0 Desktop apps | Editions packs living (cloud/onprem/client); cloud topology unchanged |
| U1 `appRegistry` (scroll/portal) | Still scroll/portal only; **mount** SoT is `shell/appMounts.registry.ts` (Wave F1) |
| App Store / `app_component` + install profiles | Catalog/install + Start/Taskbar/launch gated by `ELITEEW_*` profile |
| On-prem possible via compose/env | Pack foundation: `ELITEEW-ONPREM-TEAM-CORE-PACK.md` + smoke |
| Client / offline | Pack foundation: `ELITEEW-CLIENT-OFFLINE-AI-PACK.md` + AI policy; Tauri desktop-client Waves 0–5 + **O0–O5 living** (entitlement, OTA, AI panels, denylist, local pack panels) in `DESKTOP-TAURI-CONNECTED-CLIENT.md` §8.1; seats/modes/capabilities (#014/#011/#015). **Deferred:** full SPA Kernel offline (K14+) |
| Soft-retired trees in `trash/` | Harvest policy stated; no auto-restore |
| External `/data/repos/genEW` | Factory harvest source; Intention **lite Done** (F5) — [ELITEEW-GENEW-FACTORY-HARVEST.md](ELITEEW-GENEW-FACTORY-HARVEST.md); Celery queue deferred |
| Scaffold skill vs factory | Scaffold = stub + mount; factory plan/verify = F2–F4; Intention Admin = F5 |

## 13.1 Agent tooling (Cursor)

| Asset | Role |
|-------|------|
| Rule `eliteew-product-editions-app-platform.mdc` | alwaysApply direction vector |
| Skill `/eliteew-product-editions` | Intake: edition + Kernel vs App + anti-patterns |
| Skill `/eliteew-app-scaffold` | New Desktop app from template (Phase 1b) — after `/eliteew-factory-plan` |
| Skill `/eliteew-factory-plan` | Intent → recipe pack + P18 assembly-active (Wave F4) |
| Skill `/eliteew-capability-harvest` | Read-only trash + external genEW → EliteEW module map (Approval before port) |
| Canon Gen/Forge harvest | [ELITEEW-GENEW-FACTORY-HARVEST.md](ELITEEW-GENEW-FACTORY-HARVEST.md) |
| Rule `eliteew-fix-generator-not-capsule.mdc` | Fix factory/templates — not paper scaffold stubs (Wave F3) |
| Hook `protect-scaffold-outputs.py` | Deny generated KNOWN / stub app edits unless ALLOW_SCAFFOLD_EDIT |
| Recipes / P18 | `.cursor/orchestration/recipes/` + `pack_golden_law` |
| `shared/apps/` manifests | Product SoT; KNOWN union loader |
| Agent `inquisitor` | Attacks second product trees / invented cloud topology / offline gaps |
| Skill `verify-solution` | Editions alignment check on Desktop/modularity diffs |
| Skill `eliteew-prod-line` | Sole stack0 cloud deploy line skill (baked A / dev-bind B) |

Soft-retired Cursor skills (duplicate/destructive): `eliteew-dev-bind-deploy`, `eliteew-api-pyc-redis-clean` → `trash/` (not living agent playbooks).

## 14. Open decisions (parked for operator)

1. Manifest storage: repo YAML compiled into FE/BE vs DB-backed catalog for cloud entitlements.
2. Client wrapper tech: **Tauri 2** in `pack-organization/connection-agent/` — Waves 0–5 + **O0–O5 living** + seat delivery / license capabilities (canon [DESKTOP-TAURI-CONNECTED-CLIENT.md](../product/desktop/DESKTOP-TAURI-CONNECTED-CLIENT.md)). **Electron** is **not** a Tauri replacement: allowed only as **Trusted Substrate bootstrap payload** ([ELITEEW-TRUSTED-SUBSTRATE.md](../product/desktop/ELITEEW-TRUSTED-SUBSTRATE.md)); PWA-only client remains “if Tauri abandoned”. Full SPA Kernel offline remains deferred (K14+).
3. Whether on-prem ships bundled Keycloak or supports external IdP only.
4. Licensing/entitlement: **ops hand-to-hand / contract** for connected Tauri (API redeem Wave 2+). Cloud checkbox entitlements vs forever-local profiles still open for other packs; offline signed blob schema + phases in Tauri canon §8 / §8.1. **FoFline** entitlement shape defaults to additive `allow_fofline` — see [DESKTOP-FOFLINE-EDITION.md](../product/desktop/DESKTOP-FOFLINE-EDITION.md) §4 / §16.

---

**Owner path:** `documentation/platform/ELITEEW-PRODUCT-EDITIONS-AND-APP-PLATFORM.md`
**When implementing:** update this draft in the same phase as code; do not leave false “Done” claims in §11 without evidence.
