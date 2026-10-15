# Оглавление documentation/

**Обновлено:** 2026-09-30 · agent plane: serial-session hygiene; hard-acceptance / solution-readiness / language-bridge+Tauri skill write-gates unhooked or retired; Gemma auditor optional. Desktop TREE SoT [product/desktop/DESKTOP-CLIENT-VERSION-SOT.md](product/desktop/DESKTOP-CLIENT-VERSION-SOT.md) (TREE **0.5.37**).

Краткий hub. Роль → точка входа: [reference/HANDBOOK-MAP.md](reference/HANDBOOK-MAP.md). Как писать: [reference/DOCUMENTATION-WRITING-GUIDE.md](reference/DOCUMENTATION-WRITING-GUIDE.md). Термины: [reference/PROJECT-GLOSSARY.md](reference/PROJECT-GLOSSARY.md). Корень: [README.md](README.md). System blueprint: [project_master_card.md](project_master_card.md). Living passport: [platform/ELITEEW-TECHNICAL-PASSPORT-STATE.md](platform/ELITEEW-TECHNICAL-PASSPORT-STATE.md). Editions: [platform/ELITEEW-PRODUCT-EDITIONS-AND-APP-PLATFORM.md](platform/ELITEEW-PRODUCT-EDITIONS-AND-APP-PLATFORM.md). Pack layout (shared / pack-cloud / pack-organization): [platform/ELITEEW-PACK-LAYOUT.md](platform/ELITEEW-PACK-LAYOUT.md).

**Engineering bar (OS image / registry, not a filing):** [platform/engineering-bar/ENGINEERING.md](platform/engineering-bar/ENGINEERING.md), [DEPENDENCY-POLICY.md](platform/engineering-bar/DEPENDENCY-POLICY.md), [LICENSE-POLICY.md](platform/engineering-bar/LICENSE-POLICY.md), [third-party license map](platform/THIRD-PARTY-LICENSE-MAP.md), [trademark policy](platform/ELITEEW-TRADEMARK-POLICY.md), [CONTRIBUTING.md](platform/engineering-bar/CONTRIBUTING.md), [buildroot-packages.md](platform/engineering-bar/buildroot-packages.md), ADR [001](platform/engineering-bar/adr/ADR-001-forgejo-primary.md) (superseded for this monorepo) [002](platform/engineering-bar/adr/ADR-002-source-build.md) [003](platform/engineering-bar/adr/ADR-003-license-layers.md) [004](platform/engineering-bar/adr/ADR-004-github-development-canon.md), [template](platform/engineering-bar/adr/000-template.md). Git canon: [platform/ELITEEW-GITHUB-REPOSITORY.md](platform/ELITEEW-GITHUB-REPOSITORY.md) (plan: `documentation/plans/platform/ELITEEW-GITHUB-REPOSITORY-PLAN.md` *[operator-local process plan; gitignored — not living canon]*). Status remains NOT_READY.

> Операторский runtime по умолчанию: **Podman**. Source of truth для hosts/stacks: [platform/PRODUCTION-TOPOLOGY-STATE.md](platform/PRODUCTION-TOPOLOGY-STATE.md) §Current.

## Source-backed onboarding and audit (2026-10-11)

- [Developer setup](platform/DEVELOPER-SETUP.md) and [architecture map](platform/ARCHITECTURE-CODE-MAP.md).
- [Source module map](reference/SOURCE-MODULE-MAP.md), [inventory](reference/DOCUMENTATION-INVENTORY.json), [audit report](reference/DOCUMENTATION-AUDIT-REPORT.md) and [progress](../docs/DOCUMENTATION_PROGRESS.md).
- [Append-only code issue log](../docs/CODE_ISSUES.md): defects found while checking documentation, with source evidence and verification limits.
- [HTTP reference](api/SOURCE-HTTP-REFERENCE.md), [registered routes](api/REGISTERED-ROUTES.md), [route snapshot](api/REGISTERED-ROUTES.snapshot.json), [source contract inventory](api/SOURCE-CONTRACT-INVENTORY.json) and [API domains](api/API-ENTRY-POINTS-AND-DOMAINS.md).
- [Infrastructure source guide](platform/INFRASTRUCTURE-SOURCE-GUIDE.md) and [database/migration hub](database/README.md).

These additions verify source entry points and explicitly record limits. The detailed legacy topic navigation below is retained; its presence does not certify that every referenced document passed a semantic review.

## Production topology

Host placement, addresses and active stacks are maintained in [PRODUCTION-TOPOLOGY-STATE.md](platform/PRODUCTION-TOPOLOGY-STATE.md). This index does not assert a separately checked runtime topology.

**Stack0 dual line** (mutually exclusive on `:29000/:29001`):

| Line | Purpose | From command-center |
|------|---------|---------------------|
| **A — baked** | Planned release | `bash docker/scripts/eliteew-deploy.sh release stack0 --all` (optional `--refresh-openapi-pilots`) |
| **B — dev-bind** | Hotfix without rebake | `bash docker/scripts/eliteew-deploy.sh hotfix stack0 sync` → `hotfix stack0 up-dev-bind --yes` |

Canon: [platform/PROD-CORE-DEV-BIND-LINE.md](platform/PROD-CORE-DEV-BIND-LINE.md). Check: `bash docker/scripts/eliteew-deploy.sh hotfix stack0 status` (implementer alias `eeprodline`). Soft-retired thin wrappers `dewa-ops-prod-line-*.sh` → `trash/`.

**Soft-retired operator trees** (not living product; do not scope work unless operator restores from `trash/`): DEWA, EWGen, EWPower, EWC, EWCO / EWCoderOrchestrator, nexus-root, SSFEW, access-gate-logwatch, tg_bot_ip_verif. Script helpers may still use historical `dewa-ops-*` names for EliteEW deploy implementers — that is not a live DEWA app tree.

## Быстрый старт

| Роль | Документ |
|------|----------|
| Фронтенд | [platform/FRONTEND-BOOT-ORCHESTRATION.md](platform/FRONTEND-BOOT-ORCHESTRATION.md) · [product/FRONTEND-DEVELOPER-ENTRY.md](product/FRONTEND-DEVELOPER-ENTRY.md) · [product/UI-COMPONENTS.md](product/UI-COMPONENTS.md) · [product/FRONTEND-AUTH.md](product/FRONTEND-AUTH.md) · [product/FRONTEND-ENV.md](product/FRONTEND-ENV.md) · [product/FRONTEND_BROWSER_CACHE_MODEL.md](product/FRONTEND_BROWSER_CACHE_MODEL.md) · [platform/FRONTEND-TOOLCHAIN-AND-BUILD.md](platform/FRONTEND-TOOLCHAIN-AND-BUILD.md) · [platform/FRONTEND-SECURITY-NGINX-STATIC.md](platform/FRONTEND-SECURITY-NGINX-STATIC.md) · IdP: [platform/docker-re_doc/KEYCLOAK-ELITEEW.md](platform/docker-re_doc/KEYCLOAK-ELITEEW.md) |
| API / бэкенд | [platform/docker-re_doc/STACK0-API-STARTUP.md](platform/docker-re_doc/STACK0-API-STARTUP.md) · [platform/docker-re_doc/STACK0-BACKEND-IMAGES.md](platform/docker-re_doc/STACK0-BACKEND-IMAGES.md) · [platform/API-INFRASTRUCTURE.md](platform/API-INFRASTRUCTURE.md) · [platform/docker-re_doc/STACK0-HEALTHCHECK-LAYERS.md](platform/docker-re_doc/STACK0-HEALTHCHECK-LAYERS.md) · [platform/CELERY-BEAT-AND-QUEUES.md](platform/CELERY-BEAT-AND-QUEUES.md) · [platform/docker-re_doc/ADMIN-WORKERS-OPS.md](platform/docker-re_doc/ADMIN-WORKERS-OPS.md) · [platform/docker-re_doc/ADMIN-PLATFORM-OPS.md](platform/docker-re_doc/ADMIN-PLATFORM-OPS.md) · [platform/docker-re_doc/ADMIN-TOPOLOGY-MAP.md](platform/docker-re_doc/ADMIN-TOPOLOGY-MAP.md) · [platform/docker-re_doc/ADMIN-FACTORY-OPS.md](platform/docker-re_doc/ADMIN-FACTORY-OPS.md) |
| DevOps / оператор | [platform/PRODUCTION-TOPOLOGY-STATE.md](platform/PRODUCTION-TOPOLOGY-STATE.md) · [platform/DOCKER-STACKS-PROD-OVERVIEW.md](platform/DOCKER-STACKS-PROD-OVERVIEW.md) · [platform/PROD-CORE-DEV-BIND-LINE.md](platform/PROD-CORE-DEV-BIND-LINE.md) · [platform/ELITEEW-RELEASE-CHECKLIST.md](platform/ELITEEW-RELEASE-CHECKLIST.md) |
| Technical passport (living) | [platform/ELITEEW-TECHNICAL-PASSPORT-STATE.md](platform/ELITEEW-TECHNICAL-PASSPORT-STATE.md) — architecture / functional map / integrations / security surface (manual sync; auto passport gate retired) |
| Product editions / app platform | [platform/ELITEEW-PRODUCT-EDITIONS-AND-APP-PLATFORM.md](platform/ELITEEW-PRODUCT-EDITIONS-AND-APP-PLATFORM.md) (cloud / onprem / client) |
| Pack layout (entrances on disk) | [platform/ELITEEW-PACK-LAYOUT.md](platform/ELITEEW-PACK-LAYOUT.md) (migration Done; closed process → `trash/`) |
| System blueprint | [project_master_card.md](project_master_card.md) |
| Deploy provenance | [platform/docker-re_doc/DEPLOY-CLI-PROVENANCE.md](platform/docker-re_doc/DEPLOY-CLI-PROVENANCE.md) · [platform/ZERO-TRUST-GIT-HOOKS.md](platform/ZERO-TRUST-GIT-HOOKS.md) |
| Тестирование | [platform/TESTING-STRATEGY.md](platform/TESTING-STRATEGY.md) |
| Зависимости | [platform/DEPENDENCY-GOVERNANCE.md](platform/DEPENDENCY-GOVERNANCE.md) · [platform/FRONTEND-LICENSE-CLEANUP.md](platform/FRONTEND-LICENSE-CLEANUP.md) |
| Agent contracts | [platform/AGENT-SERIAL-SESSION.md](platform/AGENT-SERIAL-SESSION.md) · [platform/AGENT-LANGUAGE-BRIDGE.md](platform/AGENT-LANGUAGE-BRIDGE.md) · [platform/AGENT-GEMMA-SENIOR-AUDITOR-GATE.md](platform/AGENT-GEMMA-SENIOR-AUDITOR-GATE.md) · [platform/AGENT-TAURI-SECURITY-WORKFLOW.md](platform/AGENT-TAURI-SECURITY-WORKFLOW.md) · [platform/AGENT-VERIFIED-PROPOSAL-PROTOCOL.md](platform/AGENT-VERIFIED-PROPOSAL-PROTOCOL.md) · [platform/AGENT-TRASH-AND-DELETION-POLICY.md](platform/AGENT-TRASH-AND-DELETION-POLICY.md) · [platform/AGENT-CAUSE-FIRST-AND-PREMIUM-UI.md](platform/AGENT-CAUSE-FIRST-AND-PREMIUM-UI.md) · [reference/fixed-errors/README.md](reference/fixed-errors/README.md) · [platform/PRODUCT-AUDIT-STABILITY-BACKLOG.md](platform/PRODUCT-AUDIT-STABILITY-BACKLOG.md) · [platform/AGENT-DOMAIN-BOUNDARY-GATE.md](platform/AGENT-DOMAIN-BOUNDARY-GATE.md) · [platform/AGENT-CODE-VERIFICATION-WORKFLOW.md](platform/AGENT-CODE-VERIFICATION-WORKFLOW.md) · [platform/ENGINEERING-GOVERNANCE-MANIFESTO.md](platform/ENGINEERING-GOVERNANCE-MANIFESTO.md) |
| Термины | [reference/PROJECT-GLOSSARY.md](reference/PROJECT-GLOSSARY.md) |

## Разделы (каноническое дерево)

| Раздел | Оглавление | Содержимое |
|--------|------------|------------|
| **product/** | [product/README.md](product/README.md) | UX, desktop, EWA, mobile, marketing |
| **platform/** | [platform/README.md](platform/README.md) | Topology, deploy, stacks, auth ops |
| **api/** | [api/README.md](api/README.md) | HTTP / OpenAPI / FE↔BE |
| **database/** | [database/README.md](database/README.md) | Living PG map: stack1 + EWA + Keycloak (prod-core) |
| **reference/** | [reference/README.md](reference/README.md) | HANDBOOK-MAP, glossary, writing guide |
| **worklog/** | [worklog/README.md](worklog/README.md) | **Stub only** (journals → `trash/`) |
| **plans/** | [plans/README.md](plans/README.md) | Operator-local process plans (**gitignored**; not living canon) |

Разовые audit/scorecard/archive snapshots и root junk (напр. бывшие `REALTOR_*.md`) — в `trash/` (не канон). Process plans / roadmaps → `documentation/plans/` (local only).

## Platform (живое)

| Документ | Назначение |
|----------|------------|
| [platform/PRODUCTION-TOPOLOGY-STATE.md](platform/PRODUCTION-TOPOLOGY-STATE.md) | Текущий prod: hosts, stacks |
| [platform/ELITEEW-TECHNICAL-PASSPORT-STATE.md](platform/ELITEEW-TECHNICAL-PASSPORT-STATE.md) | Living technical passport (arch/functional/integrations/security); paired canvas; not a substitute for §Current topology |
| [platform/PROD-CORE-DEV-BIND-LINE.md](platform/PROD-CORE-DEV-BIND-LINE.md) | Stack0 baked (A) vs NFS hotfix (B) |
| [platform/PROD-CORE-CONFIG-PLANE.md](platform/PROD-CORE-CONFIG-PLANE.md) | Env / SOPS / tmpfs on prod-core |
| [platform/PROD-CORE-HOST-HARDEN.md](platform/PROD-CORE-HOST-HARDEN.md) | Host harden: prod-core `.111` + command-center `.136` (firewall/SSH/leftovers) |
| [platform/docker-re_doc/PROD-CORE-MIGRATION-BAKED-IMAGES.md](platform/docker-re_doc/PROD-CORE-MIGRATION-BAKED-IMAGES.md) | Baked/runtime deploy, stack4 recreate fail-closed, smoke |
| [platform/PROD-CORE-FINAL-CUTOVER-RUNBOOK.md](platform/PROD-CORE-FINAL-CUTOVER-RUNBOOK.md) | Cutover `.111/.141/.136` |
| [platform/TESTING-STRATEGY.md](platform/TESTING-STRATEGY.md) | FE/BE gates; agent DoD / Commit Package |
| [platform/DEPENDENCY-GOVERNANCE.md](platform/DEPENDENCY-GOVERNANCE.md) | Dependabot / supply-chain triage |
| [platform/FRONTEND-LICENSE-CLEANUP.md](platform/FRONTEND-LICENSE-CLEANUP.md) | MIT-first SPA directs; `pnpm licenses:check` |
| [platform/ZERO-TRUST-GIT-HOOKS.md](platform/ZERO-TRUST-GIT-HOOKS.md) | Pre-commit atomicity + lint smoke |
| [platform/AGENT-SERIAL-SESSION.md](platform/AGENT-SERIAL-SESSION.md) | Serial Cursor hygiene — one chat, cache warmth, lean MCP (no parallel tips) |
| [platform/AGENT-VERIFIED-PROPOSAL-PROTOCOL.md](platform/AGENT-VERIFIED-PROPOSAL-PROTOCOL.md) | Commit only on explicit operator request |
| [platform/AGENT-TAURI-SECURITY-WORKFLOW.md](platform/AGENT-TAURI-SECURITY-WORKFLOW.md) | Tauri F-01…F-13 security gate + fingerprinted domain verdict |
| [platform/AGENT-GEMMA-SENIOR-AUDITOR-GATE.md](platform/AGENT-GEMMA-SENIOR-AUDITOR-GATE.md) | Optional live Gemma auditor (`/validate-via-gemma`) |
| [platform/AGENT-DOMAIN-BOUNDARY-GATE.md](platform/AGENT-DOMAIN-BOUNDARY-GATE.md) | Cross-domain HARD STOP |
| [platform/AGENT-TRASH-AND-DELETION-POLICY.md](platform/AGENT-TRASH-AND-DELETION-POLICY.md) | trash-move; no delete |
| [platform/AGENT-CAUSE-FIRST-AND-PREMIUM-UI.md](platform/AGENT-CAUSE-FIRST-AND-PREMIUM-UI.md) | Cause-first + premium UI |
| [platform/PRODUCT-AUDIT-STABILITY-BACKLOG.md](platform/PRODUCT-AUDIT-STABILITY-BACKLOG.md) | Product-audit P0/P1/P2 backlog by product-id (stability follow-ups) |
| [platform/ELITEEW-PRODUCT-EDITIONS-AND-APP-PLATFORM.md](platform/ELITEEW-PRODUCT-EDITIONS-AND-APP-PLATFORM.md) | **Draft→living path:** editions + `shared/apps/` manifests (KNOWN ∪ legacy) |
| [platform/ELITEEW-PACK-LAYOUT.md](platform/ELITEEW-PACK-LAYOUT.md) | Living SoT: shared + pack-cloud + pack-organization (migration Done) |
| [platform/ELITEEW-GENEW-FACTORY-HARVEST.md](platform/ELITEEW-GENEW-FACTORY-HARVEST.md) | Gen/Forge: harvest factory mechanisms from `/data/repos/genEW` (waves F0–F7) |
| [platform/ELITEEW-ONPREM-TEAM-CORE-PACK.md](platform/ELITEEW-ONPREM-TEAM-CORE-PACK.md) | On-prem pack foundation: env overlay + smoke for `onprem-team-core` |
| [platform/ELITEEW-GITHUB-REPOSITORY.md](platform/ELITEEW-GITHUB-REPOSITORY.md) | Git canon: private `eliteew-dev` write authority, public `eliteew` export, community install target |
| [platform/ELITEEW-CLIENT-OFFLINE-AI-PACK.md](platform/ELITEEW-CLIENT-OFFLINE-AI-PACK.md) | Client offline-ai pack foundation + AI provider policy contract |
| [product/desktop/DESKTOP-FOFLINE-EDITION.md](product/desktop/DESKTOP-FOFLINE-EDITION.md) | **FoFline:** local SPA pack + WG + same stack0; `empery-fofline`; XOR; asset groups + `fofline-connected` surface (§17 A0–A4); interim remote Start ≠ Done |
| [product/desktop/ELITEEW-TRUSTED-SUBSTRATE.md](product/desktop/ELITEEW-TRUSTED-SUBSTRATE.md) | **Trusted Substrate:** from-source sealed OS carrier (target); Electron bootstrap → Tauri; ≠ Fedora kiosk |
| [product/desktop/ELITEEW-OS-FOUNDATION-POINTER.md](product/desktop/ELITEEW-OS-FOUNDATION-POINTER.md) | **EliteEW OS / EmpiierOS** foundation capture lives at `/data/repos/EmpiierOS/` (stub pointer only; no dual SoT) |
| [product/desktop/ELITEEW-TRUSTED-SUBSTRATE-KICKSTART-BR-GAPS.md](product/desktop/ELITEEW-TRUSTED-SUBSTRATE-KICKSTART-BR-GAPS.md) | Kickstart→Buildroot SoT gap list (tray closed 2026-09-09) |
| [platform/ENGINEERING-GOVERNANCE-MANIFESTO.md](platform/ENGINEERING-GOVERNANCE-MANIFESTO.md) | Anti-shotgun / fix-storm / LOC budgets / feature DoD |
| [platform/GOD-FILE-LOC-BASELINES.md](platform/GOD-FILE-LOC-BASELINES.md) | God-file LOC growth guard baselines (QW#2) |
| [platform/docker-re_doc/KEYCLOAK-ELITEEW.md](platform/docker-re_doc/KEYCLOAK-ELITEEW.md) | Keycloak clients / PKCE |
| [platform/SSO-SESSION-REGISTRY-AND-ADMIN-PRESENCE.md](platform/SSO-SESSION-REGISTRY-AND-ADMIN-PRESENCE.md) | SSO browser/mobile/desktop (+ future fofline) vs Socket.IO; Admin Users N/4 + runtime presence |
| [platform/WEB-SSO-SESSION-CONTINUITY-CONTRACT.md](platform/WEB-SSO-SESSION-CONTINUITY-CONTRACT.md) | Proposed cloud browser session continuity contract: lifetime, recovery, Remember Me, one Desktop owner |
| [platform/REALTIME-SOCKETIO-AND-WS.md](platform/REALTIME-SOCKETIO-AND-WS.md) | Socket.IO / WS planes, auth, nginx, retirements |
| [platform/UNIFIED-ADMIN-SHELL.md](platform/UNIFIED-ADMIN-SHELL.md) | Unified Admin shell: nav SSOT, smoke checklist, Users hub |
| [platform/docker-re_doc/STACK1-POSTGRES-STUCK-CONTAINER.md](platform/docker-re_doc/STACK1-POSTGRES-STUCK-CONTAINER.md) | stack1-postgres stuck / SSO registry 503 ops |
| [platform/STACK2-LLM-CONTRACT.md](platform/STACK2-LLM-CONTRACT.md) | llama-chat + gpu141 |
| [platform/LLM-MEMORY-RUNTIME-REDESIGN-DECISION.md](platform/LLM-MEMORY-RUNTIME-REDESIGN-DECISION.md) | Redesign SoT: Phases 1–2 live (parallel≥2 + embed 0.6B@1024); Phases 3–4 open |
| [platform/docker-re_doc/COMFYUI-COMMAND-CENTER-OPERATIONS.md](platform/docker-re_doc/COMFYUI-COMMAND-CENTER-OPERATIONS.md) | Historical ComfyUI on command-center `:31003` (living home = gpu141; see LAN-WORKERS-141) |
| [platform/docker-re_doc/LAN-WORKERS-141.md](platform/docker-re_doc/LAN-WORKERS-141.md) | gpu141 embed/rerank/tool-router + living ComfyUI `:31003` |
| [platform/API-INFRASTRUCTURE.md](platform/API-INFRASTRUCTURE.md) | DatabaseManager single-owner connections |
| [platform/docker-re_doc/STACK1-POSTGRES-TUNING.md](platform/docker-re_doc/STACK1-POSTGRES-TUNING.md) | Postgres memory/connections budget; pool formula |
| [platform/ELITEEW-RELEASE-CHECKLIST.md](platform/ELITEEW-RELEASE-CHECKLIST.md) | stack0 release smoke / gates |
| [platform/FRONTEND-BOOT-ORCHESTRATION.md](platform/FRONTEND-BOOT-ORCHESTRATION.md) | SPA entry/auth/i18n/Desktop readiness, recovery и chunk budgets |
| [platform/USER-SAFE-RESTARTS-AND-MAINTENANCE.md](platform/USER-SAFE-RESTARTS-AND-MAINTENANCE.md) | Maintenance UX / reload hold / recovery GPU quiet |
| [platform/ELITEEW-TECH-STACK-SUMMARY.md](platform/ELITEEW-TECH-STACK-SUMMARY.md) | Tech stack snapshot (no retired trees as living) |
| [platform/OBSERVABILITY-SLO-AND-INCIDENTS.md](platform/OBSERVABILITY-SLO-AND-INCIDENTS.md) | Logs/SLO without stack3 |
| [platform/KEENETIC-MIKROTIK-RUNBOOK.md](platform/KEENETIC-MIKROTIK-RUNBOOK.md) | Home LAN / Keenetic (≠ Meet WG) |
| [platform/KDE-LAN-136-AND-KEENETIC.md](platform/KDE-LAN-136-AND-KEENETIC.md) | NM LAN on `.136`; deploy SSH = LAN (2.5G retired) |
| [platform/KEENETIC-VPN-APP-ONLY-SETUP.md](platform/KEENETIC-VPN-APP-ONLY-SETUP.md) | Keenetic components; OpenVPN not primary |
| [platform/docker-re_doc/WG-HTTP-BACKHAUL-PRIMARY.md](platform/docker-re_doc/WG-HTTP-BACKHAUL-PRIMARY.md) | Meet WG HTTP primary |
| [platform/CLOUD-SPA-EDGE-STATIC.md](platform/CLOUD-SPA-EDGE-STATIC.md) | Cloud browser SPA static on edge (`app.eliteew.ru`) |
| [platform/docker-re_doc/MEET-MEDIA-UDP-NATIVE-PATH.md](platform/docker-re_doc/MEET-MEDIA-UDP-NATIVE-PATH.md) | Meet JVB UDP-native + host-publish traps |
| [platform/docker-re_doc/STACK11-JITSI-11031-UPGRADE.md](platform/docker-re_doc/STACK11-JITSI-11031-UPGRADE.md) | stack11 Jitsi pin `stable-11031` + UI de-brand / rollback |
| [platform/docker-re_doc/PROD-CORE-PODMAN-EGRESS.md](platform/docker-re_doc/PROD-CORE-PODMAN-EGRESS.md) | Podman egress ops |
| [platform/docker-re_doc/ADMIN-PLATFORM-OPS.md](platform/docker-re_doc/ADMIN-PLATFORM-OPS.md) | Admin Platform Ops: stack0/egress (read) + portal peers / seats / license capabilities |
| [platform/docker-re_doc/ADMIN-TOPOLOGY-MAP.md](platform/docker-re_doc/ADMIN-TOPOLOGY-MAP.md) | Admin Topology Map — honest cards + declared deps/events (Wave G1) |
| [platform/docker-re_doc/ADMIN-FACTORY-OPS.md](platform/docker-re_doc/ADMIN-FACTORY-OPS.md) | Admin Gen/Forge factory intentions (Wave F5) |
| [platform/docker-re_doc/JITSI-MEDIA-INCIDENT-2026-05-28.md](platform/docker-re_doc/JITSI-MEDIA-INCIDENT-2026-05-28.md) | Evidence-first debugging methodology |
| [platform/docker-re_doc/UGS-QUEUE-OPERATIONS-RUNBOOK.md](platform/docker-re_doc/UGS-QUEUE-OPERATIONS-RUNBOOK.md) | UGS queue ops + stack0 smoke script |
| [platform/ATOMIC-ROUTER-DECOMPOSITION-CANON.md](platform/ATOMIC-ROUTER-DECOMPOSITION-CANON.md) | FastAPI router split canon |
| [platform/AGENT-CODE-VERIFICATION-WORKFLOW.md](platform/AGENT-CODE-VERIFICATION-WORKFLOW.md) | Layers A–E |
| [platform/AGENT-SERIAL-SESSION.md](platform/AGENT-SERIAL-SESSION.md) | Serial session hygiene (one chat / cache / lean MCP) |
| [platform/AGENT-GEMMA-SENIOR-AUDITOR-GATE.md](platform/AGENT-GEMMA-SENIOR-AUDITOR-GATE.md) | Optional live Gemma on `.111:8080` — operator `/validate-via-gemma` only |
| [platform/AGENT-LANGUAGE-BRIDGE.md](platform/AGENT-LANGUAGE-BRIDGE.md) | Language bridge **unhooked** 2026-09-22; optional Gemma helper CLI; RU UI → localization-engine |
| [platform/ELITEEW-MCP-HOST-AND-SERVERS.md](platform/ELITEEW-MCP-HOST-AND-SERVERS.md) | MCP Host (Desktop/EWA/Cursor) + KBSEW MCP server; MIT/Apache, no telemetry |

## Assistant (curated)

Hub: [product/ewa/README.md](product/ewa/README.md). Таксономия vs маркетинговая AMKA: [product/ewa/EWA-VS-AMKA-TAXONOMY.md](product/ewa/EWA-VS-AMKA-TAXONOMY.md).

| Документ | Назначение |
|----------|------------|
| [product/ewa/EWA-COMPANION-PROACTIVE-PROTOCOL.md](product/ewa/EWA-COMPANION-PROACTIVE-PROTOCOL.md) | Proactive protocol |
| Continuity / contemplation / soft initiative | Living: [product/ewa/EWA-COMPANION-EVOLUTION-CANON.md](product/ewa/EWA-COMPANION-EVOLUTION-CANON.md) §L0b + [product/ewa/EWA-COMPANION-PROACTIVE-OBSERVER.md](product/ewa/EWA-COMPANION-PROACTIVE-OBSERVER.md); Cause roadmap under `trash/` (20260812-162347) |
| [product/ewa/EWA-COMPANION-OPERATIONS-PANEL.md](product/ewa/EWA-COMPANION-OPERATIONS-PANEL.md) | Task runs + UI |
| [product/ewa/EWA-COMPANION-INTENT-PLANNER.md](product/ewa/EWA-COMPANION-INTENT-PLANNER.md) | Intent planner |
| [product/ewa/EWA-COMPANION-WORKFLOW-ENGINE-V2.md](product/ewa/EWA-COMPANION-WORKFLOW-ENGINE-V2.md) | Workflow DAG engine |
| [product/ewa/EWA-PLATFORM-SETTINGS-DB.md](product/ewa/EWA-PLATFORM-SETTINGS-DB.md) | Settings plane (PG); [282-key source snapshot](api/EWA-PLATFORM-SETTINGS.snapshot.json) |
| [product/ewa/EWA-AGENTIC-KERNEL-REDESIGN.md](product/ewa/EWA-AGENTIC-KERNEL-REDESIGN.md) | Kernel redesign: Decision / FSM / Scheduler ports |
| [product/ewa/EWA-COMPANION-STABILITY-PERF-CONTRACT.md](product/ewa/EWA-COMPANION-STABILITY-PERF-CONTRACT.md) | Agentic soft-limit / compose checkpoint / SSE-first |
| [product/ewa/EWA-DEATH-SPIRAL-REGRESSION-GATE.md](product/ewa/EWA-DEATH-SPIRAL-REGRESSION-GATE.md) | Release Gate 0: death-spiral regression pack + gate script |
| [product/ewa/EWA-COMPANION-ADMIN-UI.md](product/ewa/EWA-COMPANION-ADMIN-UI.md) | Admin UI hub (incl. Users wipe / first-meet) |
| [product/ewa/EWA-COMPANION-PROFILE-ADR.md](product/ewa/EWA-COMPANION-PROFILE-ADR.md) | Profile / memory ADR; admin wipe vs ops reset / reset-all |
| [product/ewa/EWA-COMPANION-PROMPT-BLOCKS.md](product/ewa/EWA-COMPANION-PROMPT-BLOCKS.md) | Platform prompt blocks (PG + admin) |
| [product/ewa/EWA-COMPANION-HCM-MEMORY.md](product/ewa/EWA-COMPANION-HCM-MEMORY.md) | HCM / episodic memory + chat condense LP |
| [product/ewa/EWA-COMPANION-MODULE-STATUS-MAP.md](product/ewa/EWA-COMPANION-MODULE-STATUS-MAP.md) | Companion module map |
| [product/ewa/EWA-COMPANION-STACK2-OPERATOR.md](product/ewa/EWA-COMPANION-STACK2-OPERATOR.md) | llama-chat + gpu141 inference |
| [product/ewa/EWA-COMPANION-CHAT-TURN-PHASES.md](product/ewa/EWA-COMPANION-CHAT-TURN-PHASES.md) | Chat turn phases (successor to retired pipeline stub) |
| [product/ewa/EWA-COMPANION-CHAT-AND-WORKFLOW-EXTENSION-GUIDE.md](product/ewa/EWA-COMPANION-CHAT-AND-WORKFLOW-EXTENSION-GUIDE.md) | Tool/surface/UI extension owners and per-turn Web/KBSEW limits |
| [product/ewa/EWA-COMPANION-VISION-MULTIMODAL.md](product/ewa/EWA-COMPANION-VISION-MULTIMODAL.md) | Vision attach / OCR |
| [product/ewa/EWA-COMPANION-IMAGE-GENERATION.md](product/ewa/EWA-COMPANION-IMAGE-GENERATION.md) | Image gen via UGS |
| [product/ewa/EWA-COMPANION-VOICE-TTS.md](product/ewa/EWA-COMPANION-VOICE-TTS.md) | Companion voice TTS/STT (stack9; STT model = container `MODEL_SIZE`) |
| [product/ewa/EWA-ESP-DISPLAY-AI.md](product/ewa/EWA-ESP-DISPLAY-AI.md) | ESP TFT desk display ↔ EWA (buttons, no voice) |
| [product/ewa/EWA-COMPANION-WEB-SMOKE-RUNBOOK.md](product/ewa/EWA-COMPANION-WEB-SMOKE-RUNBOOK.md) | Browser smoke |

## Marketing AMKA seed (curated)

Hub: [product/amka-seed-album/README.md](product/amka-seed-album/README.md) — семя **маркетинговой / standalone AMKA** (не Assistant). Операционный справочник прогонов: [product/marketing/AMKA-REFERENCE.md](product/marketing/AMKA-REFERENCE.md).

| Документ | Назначение |
|----------|------------|
| [product/amka-seed-album/AMKA-CONTOURS.md](product/amka-seed-album/AMKA-CONTOURS.md) | AMKA vs EWA: HTTP, FE, UI |
| [product/amka-seed-album/AMKA-ENTRYPOINTS.md](product/amka-seed-album/AMKA-ENTRYPOINTS.md) | Входы marketing AMKA + сравнение с `/api/v1/ewa` |
| [product/amka-seed-album/RFC-001-amka-driver-contract.md](product/amka-seed-album/RFC-001-amka-driver-contract.md) | Контракт core / driver / pulse |
| [product/amka-seed-album/EWA-PLATFORM-GREENFIELD.md](product/amka-seed-album/EWA-PLATFORM-GREENFIELD.md) | Лист-мост пакета `api/ewa_platform` (живой EWA-канон — `product/ewa/`) |

## Desktop shell (живое)

| Документ | Назначение |
|----------|------------|
| [platform/ELITEEW-PRODUCT-EDITIONS-AND-APP-PLATFORM.md](platform/ELITEEW-PRODUCT-EDITIONS-AND-APP-PLATFORM.md) | **Draft** target: editions + pluggable Desktop apps (install checkboxes) |
| [platform/ELITEEW-PACK-LAYOUT.md](platform/ELITEEW-PACK-LAYOUT.md) | Pack layout SoT: shared + pack-cloud + pack-organization |
| [platform/ELITEEW-GENEW-FACTORY-HARVEST.md](platform/ELITEEW-GENEW-FACTORY-HARVEST.md) | Gen/Forge factory harvest from genEW (mount/verify/Intention waves) |
| [platform/ELITEEW-ONPREM-TEAM-CORE-PACK.md](platform/ELITEEW-ONPREM-TEAM-CORE-PACK.md) | On-prem `onprem-team-core` pack (env + smoke) |
| [platform/ELITEEW-GITHUB-REPOSITORY.md](platform/ELITEEW-GITHUB-REPOSITORY.md) | Git canon: private write repo + public corresponding source |
| [platform/ELITEEW-CLIENT-OFFLINE-AI-PACK.md](platform/ELITEEW-CLIENT-OFFLINE-AI-PACK.md) | Client `client-offline-ai` pack + AI router policy |
| [product/desktop/KURSORINA.md](product/desktop/KURSORINA.md) | **Курсорина** — investigation worker app (loop + evidence; not Experts/assistant) |
| [product/desktop/README.md](product/desktop/README.md) | Hub TOC shell / windows |
| [product/desktop/DESKTOP-TAURI-CONNECTED-CLIENT.md](product/desktop/DESKTOP-TAURI-CONNECTED-CLIENT.md) | Native Tauri desktop-client: WG-portal, seats, modes, runtime presence heartbeat, Admin Desktop SSO |
| [product/desktop/DESKTOP-CLIENT-VERSION-SOT.md](product/desktop/DESKTOP-CLIENT-VERSION-SOT.md) | **Version SoT:** TREE_SEMVER (`package.json`) + CHANNEL_MATRIX (`release-state.v1.json`); bump/preflight locks |
| [product/desktop/DESKTOP-CLIENT-SECURITY-BOUNDARIES.md](product/desktop/DESKTOP-CLIENT-SECURITY-BOUNDARIES.md) | **Security SoT:** IPC matrix, retail/ops, Capsule **v3**, F-04 Zero JS; Wave 0+ baselines |
| [product/desktop/DESKTOP-CLIENT-AIR-ENROLL.md](product/desktop/DESKTOP-CLIENT-AIR-ENROLL.md) | **Air enrollment SoT:** dual USB/Air activation, one-code port/selector/secret, dedicated Yandex SG, WebSocket FSM, Rust-only no-FS import |
| [product/desktop/DESKTOP-EBROWSER.md](product/desktop/DESKTOP-EBROWSER.md) | **EBrowser:** native HTTPS WebView; Rust policy SoT; Wave P chrome events; Wave U find/zoom; TREE **0.5.31** live Linux RPM; not SPA iframe |
| [product/desktop/DESKTOP-ATOMIC-CONDITIONAL-ACCESS.md](product/desktop/DESKTOP-ATOMIC-CONDITIONAL-ACCESS.md) | **Auth SoT:** atomic bind before KC code/token; Wave 5 quarantine/admin recovery; leftover `session/assert` until enforce |
| [product/desktop/DESKTOP-CLIENT-LAUNCHER-JOURNEY.md](product/desktop/DESKTOP-CLIENT-LAUNCHER-JOURNEY.md) | **SoT** Launcher Journey v1 target: Identifying → Welcome → Hub EliteEW/Релизы/Ещё; local-only reset |
| [product/desktop/DESKTOP-CLIENT-LAUNCHER-JOURNEY.md](product/desktop/DESKTOP-CLIENT-LAUNCHER-JOURNEY.md) | Launcher Journey v1 SoT (process redesign plan soft-retired under `trash/` (20260812-162347)) |
| [product/desktop/DESKTOP-FOFLINE-EDITION.md](product/desktop/DESKTOP-FOFLINE-EDITION.md) | **FoFline** pack: local SPA + WG + stack0; asset groups / surface gate §17; `empery-fofline`; XOR; interim remote Start ≠ Done |
| [product/desktop/ELITEEW-TRUSTED-SUBSTRATE.md](product/desktop/ELITEEW-TRUSTED-SUBSTRATE.md) | **Trusted Substrate** target SoT: from-source kiosk OS carrier; own toolchain; Electron bootstrap → Tauri; ≠ Fedora kiosk |
| [product/desktop/DESKTOP-CLIENT-WEBKIT-LINUX-GRAPHICS.md](product/desktop/DESKTOP-CLIENT-WEBKIT-LINUX-GRAPHICS.md) | WebKitGTK Linux 1-core lag: COMPOSITING vs DMABUF causes, retail defaults, anti-patterns |
| [product/desktop/DESKTOP-KERNEL-OFFLINE-MOUNT-BRIDGE.md](product/desktop/DESKTOP-KERNEL-OFFLINE-MOUNT-BRIDGE.md) | Wave K0: SPA Kernel offline bridge contract + catalog parity (not Kernel Done) |
| [product/desktop/DESKTOP-CLIENT-WINDOWS-BUILD-VM.md](product/desktop/DESKTOP-CLIENT-WINDOWS-BUILD-VM.md) | Windows 11 Pro libvirt NSIS build horse — headless SSH sync/build/harden (`eliteew-win11-build`) |
| [product/desktop/DESKTOP-ONLY-NAV.md](product/desktop/DESKTOP-ONLY-NAV.md) | Hash → shell coercion |
| [product/desktop/DESKTOP-STATE-PERSISTENCE.md](product/desktop/DESKTOP-STATE-PERSISTENCE.md) | Config / items / `shell_state` |
| [product/desktop/DESKTOP-WINDOW-RUNTIME-PERFORMANCE.md](product/desktop/DESKTOP-WINDOW-RUNTIME-PERFORMANCE.md) | Window GPU budget: Canvas vs FPS, quiet floating widget, maintenance recovery quiet |
| [product/desktop/DESKTOP-WALLPAPER-TRANSITION.md](product/desktop/DESKTOP-WALLPAPER-TRANSITION.md) | `#desktop-main` wallpaper crossfade (no `background-position` in transition) |
| [product/desktop/DESKTOP-WORKSPACE-SHELL-INCIDENTS.md](product/desktop/DESKTOP-WORKSPACE-SHELL-INCIDENTS.md) | Shell regressions (wallpaper paint, idle flicker, ПКМ Refresh, …) |
| [product/desktop/DESKTOP-API-AND-APPS.md](product/desktop/DESKTOP-API-AND-APPS.md) | REST + `app_component` + router modules; app display-name SSOT |
| [product/GAF-CHAT-BACKEND.md](product/GAF-CHAT-BACKEND.md) | GAF Chat API/DB/E2EE; **§8.1 ops file delivery** (`eliteew-gaf-send-file`) |
| [product/desktop/DESKTOP-APP-STORE.md](product/desktop/DESKTOP-APP-STORE.md) | App Store vitrine / install UX; catalog names SSOT with API; operator admin under `DesktopAppStoreAdmin/*` |
| [product/desktop/DESKTOP-EMBEDDED-APPS-UX-NEXT.md](product/desktop/DESKTOP-EMBEDDED-APPS-UX-NEXT.md) | Embedded desktop apps UX map (Ассистент, Feedback, dual-header) |
| [product/desktop/DESKTOP-MOBILE-EMBEDDED-SHELL.md](product/desktop/DESKTOP-MOBILE-EMBEDDED-SHELL.md) | Mobile `#/mobile-*` journey allowlist + full-shell chrome hide (Wave 4) |
| [product/desktop/DESKTOP-IMPLEMENTED-VS-STUB.md](product/desktop/DESKTOP-IMPLEMENTED-VS-STUB.md) | Living vs stub matrix |
| [product/desktop/DESKTOP-WIDGETS-AND-AGENDA.md](product/desktop/DESKTOP-WIDGETS-AND-AGENDA.md) | **SoT** widgets panel + Assistant plan projection + agenda (P3 locked; waves A–E landed) |
| [product/desktop/DESKTOP-CALENDAR-APP.md](product/desktop/DESKTOP-CALENDAR-APP.md) | **SoT** CalendarApp + personal events API (Wave F locked) |
| [product/desktop/DESKTOP-CONTEXT-MENU-ARCHITECTURE.md](product/desktop/DESKTOP-CONTEXT-MENU-ARCHITECTURE.md) | ПКМ families, native-leak inventory, policy, remediation waves |
| [product/desktop/DESKTOP-TASKBAR-ARCHITECTURE.md](product/desktop/DESKTOP-TASKBAR-ARCHITECTURE.md) | Taskbar / tray / right-rail exclusivity |
| [product/desktop/DESKTOP-SHELL-A11Y-CHECKLIST.md](product/desktop/DESKTOP-SHELL-A11Y-CHECKLIST.md) | Shell a11y checklist (keyboard / focus / ARIA) |
| [product/desktop/DESKTOP_DESIGN_SYSTEM.md](product/desktop/DESKTOP_DESIGN_SYSTEM.md) | Shell visual tokens + Start Menu panel/skeleton geometry |
| [product/desktop/DESKTOP-SHELL-A11Y-E2E-RUNBOOK.md](product/desktop/DESKTOP-SHELL-A11Y-E2E-RUNBOOK.md) | Live Playwright a11y E2E prep (storage gate) |
| [product/desktop/DESKTOP-NOTIFICATIONS-APP.md](product/desktop/DESKTOP-NOTIFICATIONS-APP.md) | Notification Center / clear-all confirm chrome |
| [product/desktop/DESKTOP-MUSIC-PLAYER.md](product/desktop/DESKTOP-MUSIC-PLAYER.md) | Music Player Desktop: catalog, NowPlaying, playlists shell_state, offline honesty, smoke |
| [product/desktop/DESKTOP-SHELL-E2E-CI.md](product/desktop/DESKTOP-SHELL-E2E-CI.md) | Playwright opt-in CI |
| [product/desktop/DESKTOP-CHROME-DECLUTTER-AND-SCROLL.md](product/desktop/DESKTOP-CHROME-DECLUTTER-AND-SCROLL.md) | Settings/apps chrome declutter + window self-scroll registry |
| [product/desktop/SHELL-LIFECYCLE-AND-CHROME-SSOT.md](product/desktop/SHELL-LIFECYCLE-AND-CHROME-SSOT.md) | Companion + Desktop Shell Lifecycle Manager / App Registry SSOT |
| [product/desktop/DESKTOP-SHELL-U1-APP-REGISTRY-DESIGN.md](product/desktop/DESKTOP-SHELL-U1-APP-REGISTRY-DESIGN.md) | U1 design: App Registry scroll/portal (approval before code) |
| [product/desktop/DESKTOP-SETTINGS-CENTER-AND-EXPANSION-DESIGN.md](product/desktop/DESKTOP-SETTINGS-CENTER-AND-EXPANSION-DESIGN.md) | Settings Center / expansion IA (data map) |
| [product/desktop/DESKTOP-SETTINGS-EVERYDAY-IA.md](product/desktop/DESKTOP-SETTINGS-EVERYDAY-IA.md) | Settings Everyday IA target SoT (user jobs / Look SoT / budgets) |
| [product/desktop/ELITEEW-UX-PRIMITIVES-CONTRACT.md](product/desktop/ELITEEW-UX-PRIMITIVES-CONTRACT.md) | Desktop / product UX primitive ownership (+ shell restricted-app gate) |
| [product/DESKTOP-WINDOW-SHELL-STYLE.md](product/DESKTOP-WINDOW-SHELL-STYLE.md) | Window / taskbar style presets |
| [product/VOICE-CONTROL-STUDIO.md](product/VOICE-CONTROL-STUDIO.md) | Студия ГУ (app-studio-gu): dialog / HQ / Live / transcription |
| [product/desktop/DESKTOP-VOICE-COMMAND-ON-DEMAND.md](product/desktop/DESKTOP-VOICE-COMMAND-ON-DEMAND.md) | Voice HQ on-demand mount (backgroundOnly) |
| [product/desktop_icon_system.md](product/desktop_icon_system.md) | Desktop icon styles / icon-only packs |
| [product/DESKTOP-LLAMA-CHAT.md](product/DESKTOP-LLAMA-CHAT.md) | Ассистент large hub (prefer thin Discussion/Collaboration siblings); not EWA |
| [product/desktop/DESKTOP-AI-CHAT-COLLABORATION.md](product/desktop/DESKTOP-AI-CHAT-COLLABORATION.md) | Ассистент: friends in Team chat (collaboration waves) |
| [product/desktop/DESKTOP-AI-CHAT-MEMORY-CELLS.md](product/desktop/DESKTOP-AI-CHAT-MEMORY-CELLS.md) | Ассистент: personal Memory Cells (portable RAG) |
| [product/desktop/DESKTOP-AI-CHAT-DISCUSSION-MODE.md](product/desktop/DESKTOP-AI-CHAT-DISCUSSION-MODE.md) | Ассистент: explicit Discussion mode (presets, batches, document on demand) |
| [product/DESKTOP-ENSEMBLE-HERO-AUTHORING.md](product/DESKTOP-ENSEMBLE-HERO-AUTHORING.md) | Ассистент: add/edit heroes |
| [product/DESKTOP-ENSEMBLE-PLAN-AUTHORING.md](product/DESKTOP-ENSEMBLE-PLAN-AUTHORING.md) | Ассистент: blueprint plan templates |
| [product/DESKTOP-ENSEMBLE-ACTIONS.md](product/DESKTOP-ENSEMBLE-ACTIONS.md) | Ассистент: mid-turn ensemble research probes (Wave 1) |

## Product hubs

| Документ | Назначение |
|----------|------------|
| [product/SPRAVOCHNIK-AI.md](product/SPRAVOCHNIK-AI.md) | UI «Ассистент» — вход по ролям |
| [product/PRODUCT-ASSISTANT-HANDBOOK.md](product/PRODUCT-ASSISTANT-HANDBOOK.md) | Ассистент: API, FAQ, RAG |
| [product/PRODUCT-ASSISTANT-KB-INDEXING.md](product/PRODUCT-ASSISTANT-KB-INDEXING.md) | KB sync / Qdrant runbook |
| [product/handbook-kb-articles/README.md](product/handbook-kb-articles/README.md) | RAG article inventory: 105 `kb-*.md` files; content review pending |
| [product/handbook-user-docs/README.md](product/handbook-user-docs/README.md) | Короткие user-инструкции |
| [product/KBSEW.md](product/KBSEW.md) | KBSEW barrels / search service |
| [product/CONTENT-MANAGER.md](product/CONTENT-MANAGER.md) | Файловый менеджер large hub / `unified_content` (prefer thin Vitest locks) |
| [product/CONTENT-BROKEN-FILES-AND-WEBP-DISPLAY.md](product/CONTENT-BROKEN-FILES-AND-WEBP-DISPLAY.md) | Битые файлы (storage quarantine) + WebP display derivatives |
| [product/FRONTEND-VIRTUAL-LIST-AND-PERF-PATTERNS.md](product/FRONTEND-VIRTUAL-LIST-AND-PERF-PATTERNS.md) | VirtualList / VirtualGrid / CM dense grid |
| [product/ULTIMATE-DOC-EDITOR.md](product/ULTIMATE-DOC-EDITOR.md) | Legacy Ultimate Doc Editor baseline |
| [product/ULTIMATE-DOC-EDITOR-DESKTOP-THEMING.md](product/ULTIMATE-DOC-EDITOR-DESKTOP-THEMING.md) | Doc Editor `--desktop-*` tokens + body portals |
| [product/DOCUMENT-EDITOR-V2.md](product/DOCUMENT-EDITOR-V2.md) | Doc Editor V2 (рядом со старым) |
| [product/DOC-EDITOR-COLLABORATION.md](product/DOC-EDITOR-COLLABORATION.md) | Collab / Yjs / Socket.IO |
| [product/ugs_frontend_contract_and_regression_baseline.md](product/ugs_frontend_contract_and_regression_baseline.md) | UGS FE contract + regression |
| [product/UGS-FLOW-AND-CONFIG.md](product/UGS-FLOW-AND-CONFIG.md) | UGS generate flow + env |
| [product/UGS-AI-ROUTES-AUDIT.md](product/UGS-AI-ROUTES-AUDIT.md) | UGS vs product AI callers map |
| [product/UGS-HUB-STABILITY-PROGRAM.md](product/UGS-HUB-STABILITY-PROGRAM.md) | Hub/runtime stability invariants |
| [product/ugs_workflow_builder_contract.md](product/ugs_workflow_builder_contract.md) | Workflow Builder sources/runtime |
| [product/desktop/UGS-DESKTOP-SHELL.md](product/desktop/UGS-DESKTOP-SHELL.md) | UGS deep link / desktop shell |
| [product/IMAGE-STUDIO.md](product/IMAGE-STUDIO.md) | Image Studio UI / API / Wave 2+3 modules |
| [product/product-overview/README.md](product/product-overview/README.md) | **Primary** product overview pack · [`ru/`](product/product-overview/ru/00-README.md) · [`en/`](product/product-overview/en/00-README.md) · bilingual HTML export · MIT gift-to-world · not ops SoT |
| [product/eliteew-overview/index.html](product/eliteew-overview/index.html) | Secondary area catalog (user + tech by domain); points to product-overview · not partner deck / not ops SoT |
| [product/eliteew-product-card/ELITEEW-PRODUCT-CARD.md](product/eliteew-product-card/ELITEEW-PRODUCT-CARD.md) | Partner/investor collateral (research 01–27 → `trash/`; not ops SoT) |
| [product/ELITEEW-OBOZRENIE-DLYA-POLZOVATELEJ.md](product/ELITEEW-OBOZRENIE-DLYA-POLZOVATELEJ.md) | User-facing overview collateral (non-technical) |
| [product/ELITEEW-MINI-PREZENTACIYA-v4.md](product/ELITEEW-MINI-PREZENTACIYA-v4.md) | App cards collateral; ultra-simple mini → `trash/` |
| [product/presentations/README.md](product/presentations/README.md) | Static pitch decks hub (executive HTML → `trash/`; ≠ EWRP product) |
| [product/EWRP-REVOLUTIONARY-PRESENTATIONS.md](product/EWRP-REVOLUTIONARY-PRESENTATIONS.md) | EWRP product large hub (`/api/v1/ewrp`) |
| [product/EWRP-EDITOR.md](product/EWRP-EDITOR.md) | EWRP post-generate slide editor (thin) |
| [product/EWRP-GENERATED-FILES-LIFECYCLE.md](product/EWRP-GENERATED-FILES-LIFECYCLE.md) | Classic Reveal.js + EWRP artifacts lifecycle |
| [product/SITE-PROD-LANDING.md](product/SITE-PROD-LANDING.md) | Публичный лендинг `eliteew.ru` (Safe Workspace / site_prod; cutover `:29002`) |
| [product/SITE-STUDIO.md](product/SITE-STUDIO.md) | Site Studio large hub (`{slug}-site.eliteew.ru`; Carrier/ops thin docs preferred for edge) |
| [product/KIRS-SITE-CURATION.md](product/KIRS-SITE-CURATION.md) | КИРС / project sites |
| [product/SOCIAL-HUB.md](product/SOCIAL-HUB.md) | Social Hub |
| [product/SOCIAL-HUB-PRIVACY.md](product/SOCIAL-HUB-PRIVACY.md) | Social Hub privacy index |
| [product/SOCIAL-HUB-PROFILE-PRIVACY.md](product/SOCIAL-HUB-PROFILE-PRIVACY.md) | Profile privacy behavior |
| [product/INTERNAL-VIDEO-CALLS.md](product/INTERNAL-VIDEO-CALLS.md) | GAF / Meet video calls (Meet WG) |
| [product/MUSIC-FORGE-APP.md](product/MUSIC-FORGE-APP.md) | MusicForge |
| [product/MUSIC-FORGE-IDEAL-TOP-SONG-CANON.md](product/MUSIC-FORGE-IDEAL-TOP-SONG-CANON.md) | MusicForge Ideal TOP song (AceStepSFT quality contract) |
| [product/PROFESSIONAL-WORLDS.md](product/PROFESSIONAL-WORLDS.md) | Professional Worlds large hub (prefer PACK-V2 / smoke / vertical template) |
| [product/professional-worlds/REALTOR-TOOLS.md](product/professional-worlds/REALTOR-TOOLS.md) | Realtor tools notes (relocated from EliteEW root) |
| [product/PROFESSIONAL-WORLDS-NEXT-BASELINE.md](product/PROFESSIONAL-WORLDS-NEXT-BASELINE.md) | PW expansion status matrix |
| [product/PROFESSIONAL-WORLDS-SMOKE-STACK0.md](product/PROFESSIONAL-WORLDS-SMOKE-STACK0.md) | PW smoke |
| [product/desktop/DESKTOP-AI-CHAT-COLLABORATION.md](product/desktop/DESKTOP-AI-CHAT-COLLABORATION.md) | Ассистент collaboration (Team + friends) |
| [product/desktop/DESKTOP-AI-CHAT-MEMORY-CELLS.md](product/desktop/DESKTOP-AI-CHAT-MEMORY-CELLS.md) | Ассистент Memory Cells (portable RAG) |
| [product/desktop/DESKTOP-AI-CHAT-DISCUSSION-MODE.md](product/desktop/DESKTOP-AI-CHAT-DISCUSSION-MODE.md) | Ассистент Discussion mode |
| [product/SURVEY-HUB.md](product/SURVEY-HUB.md) | Опросы |
| [product/WEB-SEARCH-ADMIN-OPERATIONS.md](product/WEB-SEARCH-ADMIN-OPERATIONS.md) | Web search admin (Yandex; stack5 Off) |
| [product/marketing/README.md](product/marketing/README.md) | Маркетинговый кабинет / AMKA hub (≠ EWA) |
| [product/marketing/MARKETING-CABINET.md](product/marketing/MARKETING-CABINET.md) | Кабинет large hub (day-to-day → marketing/README; ≠ EWA) |
| [product/marketing/AMKA-REFERENCE.md](product/marketing/AMKA-REFERENCE.md) | Маркетинговые прогоны AMKA |
| [product/marketing/IMC-MISO-ARCHITECTURE.md](product/marketing/IMC-MISO-ARCHITECTURE.md) | IMC/MISO |
| [product/ELITEEW-UX-SMOKE-MATRIX.md](product/ELITEEW-UX-SMOKE-MATRIX.md) | UX smoke matrix (ops companion to roadmap) |

## Database (живое)

| Документ | Назначение |
|----------|------------|
| [database/README.md](database/README.md) | Living PG map: stack1 + EWA + Keycloak |
| [database/DATABASE_TABLES_REGISTRY.md](database/DATABASE_TABLES_REGISTRY.md) | Критичные таблицы `ai_services` (+ EWA); incl. `desktop_client_runtime_presence` |
| [platform/docker-re_doc/PROD-DB-CONTOUR-UPGRADE-2026-06-19.md](platform/docker-re_doc/PROD-DB-CONTOUR-UPGRADE-2026-06-19.md) | Living rollback-kit + upgrade-pattern canon (dated 2026-06-19 cutover) |
| [platform/docker-re_doc/EWA-POSTGRES-RUNBOOK.md](platform/docker-re_doc/EWA-POSTGRES-RUNBOOK.md) | EWA Postgres apply/migrations (хвост **035**) |
| [database/DB_PITFALLS_AND_QUIRKS.md](database/DB_PITFALLS_AND_QUIRKS.md) | PII / RLS / quirks |

## Reference

Living meta-nav only: [reference/README.md](reference/README.md) · [reference/HANDBOOK-MAP.md](reference/HANDBOOK-MAP.md) · [reference/PROJECT-GLOSSARY.md](reference/PROJECT-GLOSSARY.md) · [reference/DOCUMENTATION-WRITING-GUIDE.md](reference/DOCUMENTATION-WRITING-GUIDE.md). One-off operator session traces are **not** living canon (do not re-add dated `USER-SESSION-TRACE-*` hubs).

## Mobile (живое)

| Документ | Назначение |
|----------|------------|
| [product/mobile/ANDROID-DEVELOPER-HANDBOOK.md](product/mobile/ANDROID-DEVELOPER-HANDBOOK.md) | Developer handbook |
| [product/mobile/MOBILE-ANDROID-GUIDELINES.md](product/mobile/MOBILE-ANDROID-GUIDELINES.md) | Mobile UI/network guidelines (UGS Songs = MusicForge SFT) |
| [product/mobile/README.md](product/mobile/README.md) | Mobile pack-cloud hub (`pack-cloud/mobile/`) |
| [product/mobile/ANDROID-BOOTSTRAP.md](product/mobile/ANDROID-BOOTSTRAP.md) | Mobile bootstrap / flavors / SSO baseline |
| [product/mobile/MOBILE-ANDROID-RELEASE-RUNBOOK.md](product/mobile/MOBILE-ANDROID-RELEASE-RUNBOOK.md) | Release / OTA cycle |
| [reference/fixed-errors/mobile/2026-09-28-tracked-fcm-service-account-key.md](reference/fixed-errors/mobile/2026-09-28-tracked-fcm-service-account-key.md) | FCM credential leak cause, containment, and regression locks |
| [product/mobile/MOBILE-SECURE-CONNECTION-OPERATIONS.md](product/mobile/MOBILE-SECURE-CONNECTION-OPERATIONS.md) | Trusted device / WG ops |
| [product/mobile/MOBILE-TRUSTED-DEVICE-BINDING.md](product/mobile/MOBILE-TRUSTED-DEVICE-BINDING.md) | Device binding |
| [product/mobile/MOBILE-ANDROID-PRIVATE-TUNNEL.md](product/mobile/MOBILE-ANDROID-PRIVATE-TUNNEL.md) | Private tunnel / Secure Connection UX |
| [product/mobile/MOBILE-PERIMETER-ACCESS.md](product/mobile/MOBILE-PERIMETER-ACCESS.md) | Yandex perimeter vs Keycloak SSO |
| [platform/docker-re_doc/MOBILE-PRIVATE-TUNNEL-EDGE.md](platform/docker-re_doc/MOBILE-PRIVATE-TUNNEL-EDGE.md) | Edge `wg-mobile` |
| [platform/docker-re_doc/PORTAL-PRIVATE-TUNNEL-EDGE.md](platform/docker-re_doc/PORTAL-PRIVATE-TUNNEL-EDGE.md) | Edge `wg-portal` (desktop/Fedora; UDP 51823; `portalctl`; kiosk local nginx via portal) |
| [platform/docker-re_doc/KIOSK-FEDORA-SERVER-ISO.md](platform/docker-re_doc/KIOSK-FEDORA-SERVER-ISO.md) | Fedora Server 44 unattended kiosk ISO (`mkksiso`; local `pack-organization/kiosk-fedora-iso/`); ≠ [Trusted Substrate](product/desktop/ELITEEW-TRUSTED-SUBSTRATE.md) |
| [platform/COMMAND-CENTER-GOLDEN-IMAGE.md](platform/COMMAND-CENTER-GOLDEN-IMAGE.md) | Fedora Server 44 golden ISO for command-center `.136` (`pack-organization/command-center-image/`) |
| [product/mobile/MOBILE-GAF-VIDEO-CALLS-WEBVIEW.md](product/mobile/MOBILE-GAF-VIDEO-CALLS-WEBVIEW.md) | GAF WebView |
| [product/mobile/MOBILE-ANDROID-USER-GUIDE.md](product/mobile/MOBILE-ANDROID-USER-GUIDE.md) | User guide |
| [product/mobile/MOBILE-ANDROID-DEVICE-SMOKE-TEMPLATE.md](product/mobile/MOBILE-ANDROID-DEVICE-SMOKE-TEMPLATE.md) | Device smoke before OTA |
| [product/mobile/MOBILE-ANDROID-SCALE-CHROME-POLICY.md](product/mobile/MOBILE-ANDROID-SCALE-CHROME-POLICY.md) | Scale / chrome UI policy |

## Инварианты

- Канон только под `documentation/product/`, `documentation/platform/`, `documentation/api/`, `documentation/database/`, `documentation/reference/` (+ `worklog/` stub README).
- Не описывать DEWA / EWGen / EWPower / EWC / EWCO как living production; не называть command-center «punisher» как primary hostname.
- Разовые AUDIT/SCORECARD/FULL-REPORT/archive и out-of-tree root junk → `trash/`, не в hub.
- Новые живые файлы — строка здесь и при необходимости в `HANDBOOK-MAP.md`.
