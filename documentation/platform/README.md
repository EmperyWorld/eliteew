# Платформа EliteEW (`documentation/platform/`)

Операции, инфраструктура API, качество, auth и podman-first контейнерный контур (`docker-re_doc/`).

> Текущий runtime по умолчанию: **Podman**. Разовые audit/RFC/migration trackers — в `trash/` (не канон).

| Тема | Файл |
|------|------|
| **Prod topology** | `PRODUCTION-TOPOLOGY-STATE.md` |
| **Стеки** | `DOCKER-STACKS-PROD-OVERVIEW.md` · `docker-re_doc/STACK-CONTAINER-CONTROL.md` |
| **Stack0 dual line** | `PROD-CORE-DEV-BIND-LINE.md` · `PROD-CORE-CONFIG-PLANE.md` · `PROD-CORE-FINAL-CUTOVER-RUNBOOK.md` |
| **API infrastructure** | `API-INFRASTRUCTURE.md` |
| **Redis / кэш** | `REDIS_ARCHITECTURE.md` |
| **Python 3.14** | `PYTHON-3.14-BASELINE.md` |
| **Keycloak** | `docker-re_doc/KEYCLOAK-ELITEEW.md` · `SSO-SESSION-REGISTRY-AND-ADMIN-PRESENCE.md` · `PRODUCT-AUDIT-STABILITY-BACKLOG.md` §`keycloak-auth` |
| **Фронт toolchain / security** | `FRONTEND-TOOLCHAIN-AND-BUILD.md`, `FRONTEND-SPA-BEARER-THREAT-MODEL.md`, `FRONTEND-SECURITY-NGINX-STATIC.md`, `docker-re_doc/FRONTEND-STALE-CHUNK-404.md` |
| **GPU .141** | `docker-re_doc/LAN-WORKERS-141.md` |
| **Container threat model** | `docker-re_doc/CONTAINER-SECURITY-THREAT-MODEL.md` |
| **Product editions** | `ELITEEW-PRODUCT-EDITIONS-AND-APP-PLATFORM.md` |
| **Pack layout (entrances)** | `ELITEEW-PACK-LAYOUT.md` (migration Done; closed process docs → `trash/`) |
| **Git canon (GitHub)** | `ELITEEW-GITHUB-REPOSITORY.md` · plan `documentation/plans/platform/ELITEEW-GITHUB-REPOSITORY-PLAN.md` *[operator-local process plan; gitignored — not living canon]* · ADR-004 |
| **Release checklist** | `ELITEEW-RELEASE-CHECKLIST.md` · `SERVICES-VERIFICATION-CHECKLIST.md` |
| **Testing** | `TESTING-STRATEGY.md` |
| **Dependencies** | `DEPENDENCY-GOVERNANCE.md` |
| **Git hooks** | `ZERO-TRUST-GIT-HOOKS.md` |
| **Agent contracts** | `AGENT-VERIFIED-PROPOSAL-PROTOCOL.md`, `AGENT-TRASH-AND-DELETION-POLICY.md`, `AGENT-CAUSE-FIRST-AND-PREMIUM-UI.md`, `PRODUCT-AUDIT-STABILITY-BACKLOG.md`, `AGENT-DOMAIN-BOUNDARY-GATE.md`, `AGENT-CODE-VERIFICATION-WORKFLOW.md` |
| **EWA queue auth** | `EWA-COMPANION-QUEUE-AUTH-TOKEN-FLOW.md` |
| **LAN / Keenetic** | `KEENETIC-MIKROTIK-RUNBOOK.md` · `KEENETIC-VPN-APP-ONLY-SETUP.md` · `KDE-LAN-136-AND-KEENETIC.md` |
| **Observability** | `OBSERVABILITY-SLO-AND-INCIDENTS.md` (без stack3) |
| **Stack2 LLM** | `STACK2-LLM-CONTRACT.md` · `LLM-CHAT-MODEL-CHANGE-CHEATSHEET.md` · `docker-re_doc/STACK0-LLM-OVERVIEW.md` |
| **Evidence-first** | `docker-re_doc/JITSI-MEDIA-INCIDENT-2026-05-28.md` |
| **Router split canon** | `ATOMIC-ROUTER-DECOMPOSITION-CANON.md` |
| **WG / egress** | `docker-re_doc/WG-HTTP-BACKHAUL-PRIMARY.md`, `docker-re_doc/PROD-CORE-PODMAN-EGRESS.md` |

Указатель: [`../INDEX.md`](../INDEX.md) · роли: [`../reference/HANDBOOK-MAP.md`](../reference/HANDBOOK-MAP.md).
