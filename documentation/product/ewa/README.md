# EWA companion platform documentation

EWA means Empery World Awakening in the product brand. The server platform is mounted under `/api/v1/ewa`; [taxonomy](EWA-VS-AMKA-TAXONOMY.md) distinguishes it from marketing AMKA.

This is a navigation hub. A linked article may describe implemented behavior, policy, design or an operational procedure; inclusion here does not certify its semantic audit or live deployment. Per-file review status is tracked in [the documentation inventory](../../reference/DOCUMENTATION-INVENTORY.json). Start with [the module entry](../../../shared/api/ewa_platform/README.md), [desktop HTTP/SSE contract](../../../shared/api/ewa_platform/docs/DESKTOP-ORCHESTRATION.md), [HCM memory](EWA-COMPANION-HCM-MEMORY.md) and [atom layer](EWA-ATOM-LAYER.md). Open code defects are recorded in [the append-only log](../../../docs/CODE_ISSUES.md).

Production hosts, inference placement and active worker topology belong only to [PRODUCTION-TOPOLOGY-STATE.md](../../platform/PRODUCTION-TOPOLOGY-STATE.md) §Current. Previously retired dated audits/closeouts under `trash/` are historical material.

## Day-to-day entry (prefer these)

| Topic | Doc |
|-------|-----|
| Evolution canon (persona/memory layers) | [EWA-COMPANION-EVOLUTION-CANON.md](EWA-COMPANION-EVOLUTION-CANON.md) |
| Module map | [EWA-COMPANION-MODULE-STATUS-MAP.md](EWA-COMPANION-MODULE-STATUS-MAP.md) |
| Chat turn phases | [EWA-COMPANION-CHAT-TURN-PHASES.md](EWA-COMPANION-CHAT-TURN-PHASES.md) |
| Multi-intent routing and deferred queue | [EWA-COMPANION-MULTI-TASK-ORCHESTRATION.md](EWA-COMPANION-MULTI-TASK-ORCHESTRATION.md) |
| Catalog document reads | [EWA-COMPANION-CATALOG-DISCUSS.md](EWA-COMPANION-CATALOG-DISCUSS.md) |
| File tools, folders and mutation boundaries | [EWA-COMPANION-FILE-CATALOG.md](EWA-COMPANION-FILE-CATALOG.md) |
| Admin UI | [EWA-COMPANION-ADMIN-UI.md](EWA-COMPANION-ADMIN-UI.md) |
| Task-run transport and operations | [EWA-COMPANION-OPERATIONS-PANEL.md](EWA-COMPANION-OPERATIONS-PANEL.md), [task-status tool](EWA-COMPANION-TASK-STATUS-TOOL.md) |
| User UX map | [EWA-COMPANION-USER-UX-MAP.md](EWA-COMPANION-USER-UX-MAP.md) |
| Web smoke | [EWA-COMPANION-WEB-SMOKE-RUNBOOK.md](EWA-COMPANION-WEB-SMOKE-RUNBOOK.md) |
| Intent planner | [EWA-COMPANION-INTENT-PLANNER.md](EWA-COMPANION-INTENT-PLANNER.md) |
| Tool router | [EWA-COMPANION-TOOL-ROUTER.md](EWA-COMPANION-TOOL-ROUTER.md) |
| Personal workflow HTTP, matching and linear execution | [EWA-COMPANION-USER-WORKFLOWS.md](EWA-COMPANION-USER-WORKFLOWS.md) |
| DAG validation, execution/resume and visual builder | [EWA-COMPANION-WORKFLOW-ENGINE-V2.md](EWA-COMPANION-WORKFLOW-ENGINE-V2.md) |
| Quick intents and workflow catalog | [EWA-COMPANION-QUICK-INTENTS.md](EWA-COMPANION-QUICK-INTENTS.md), [EWA-COMPANION-WORKFLOW-REGISTRY.md](EWA-COMPANION-WORKFLOW-REGISTRY.md), [admin editor](EWA-COMPANION-ADMIN-WORKFLOW-EDITOR.md) |
| Platform settings DB | [EWA-PLATFORM-SETTINGS-DB.md](EWA-PLATFORM-SETTINGS-DB.md) |
| Server plans, five HTTP routes and calendar write-back | [EWA-COMPANION-SERVER-PLANS-ADR.md](EWA-COMPANION-SERVER-PLANS-ADR.md) — [personal calendar and plan write-back](../desktop/DESKTOP-CALENDAR-APP.md); [widget agenda](../desktop/DESKTOP-WIDGETS-AND-AGENDA.md) retains a separate review scope |
| Agentic kernel redesign (Decision/FSM/Scheduler) | [EWA-AGENTIC-KERNEL-REDESIGN.md](EWA-AGENTIC-KERNEL-REDESIGN.md) |
| Opening preloader / restore last message / reply formatting | [EWA-COMPANION-OPENING-PRELOADER.md](EWA-COMPANION-OPENING-PRELOADER.md), [EWA-COMPANION-RESTORE-LAST-MESSAGE.md](EWA-COMPANION-RESTORE-LAST-MESSAGE.md), [EWA-COMPANION-VISIBLE-REPLY-FORMATTING.md](EWA-COMPANION-VISIBLE-REPLY-FORMATTING.md) |
| Social-post input/source/constructor and copy contract | [EWA-COMPANION-SOCIAL-POST-COMPOSE.md](EWA-COMPANION-SOCIAL-POST-COMPOSE.md) |
| Companion music pipeline / image UGS adapter / attachment OCR and multimodal analysis / TTS | [EWA-COMPANION-MUSIC-GENERATION.md](EWA-COMPANION-MUSIC-GENERATION.md), [EWA-COMPANION-IMAGE-GENERATION.md](EWA-COMPANION-IMAGE-GENERATION.md), [EWA-COMPANION-VISION-MULTIMODAL.md](EWA-COMPANION-VISION-MULTIMODAL.md), [EWA-COMPANION-VOICE-TTS.md](EWA-COMPANION-VOICE-TTS.md) |
| ESP TFT desk display (no voice) | [EWA-ESP-DISPLAY-AI.md](EWA-ESP-DISPLAY-AI.md) |
| Proactive protocol | [EWA-COMPANION-PROACTIVE-PROTOCOL.md](EWA-COMPANION-PROACTIVE-PROTOCOL.md) |
| Continuity & presence | [EWA-COMPANION-EVOLUTION-CANON.md](EWA-COMPANION-EVOLUTION-CANON.md) — continuity micro-state · [EWA-COMPANION-PROACTIVE-OBSERVER.md](EWA-COMPANION-PROACTIVE-OBSERVER.md) (Cause roadmap soft-retired under `trash/` (20260812-162347)) |
| Stack2 / inference operator | [EWA-COMPANION-STACK2-OPERATOR.md](EWA-COMPANION-STACK2-OPERATOR.md) |
| Queue auth | [EWA-COMPANION-QUEUE-AUTH-TOKEN-FLOW.md](../../platform/EWA-COMPANION-QUEUE-AUTH-TOKEN-FLOW.md) |
| Taxonomy vs AMKA | [EWA-VS-AMKA-TAXONOMY.md](EWA-VS-AMKA-TAXONOMY.md) |
| Tool/surface/UI extension and per-turn grounding | [EWA-COMPANION-CHAT-AND-WORKFLOW-EXTENSION-GUIDE.md](EWA-COMPANION-CHAT-AND-WORKFLOW-EXTENSION-GUIDE.md) |

## Architecture and local process material

The architecture decision and operator-local process plans have different roles. A delivery label in an old plan is not current source or deployment evidence:

| Doc | Role |
|-----|------|
| [EWA-AGENTIC-KERNEL-REDESIGN.md](EWA-AGENTIC-KERNEL-REDESIGN.md) | Agentic kernel decision / ports (living) |
| `documentation/plans/product/ewa/EWA-AGENTIC-SUBSTRATE-MASTER-PLAN.md` *[operator-local process plan; gitignored — not living canon]* | Agentic substrate process waves (local) |
| `documentation/plans/product/ewa/EWA-COMPANION-BACKGROUND-ORCHESTRATION-MASTER-PLAN.md` *[operator-local process plan; gitignored — not living canon]* | Background orchestration foundation |
| `documentation/plans/product/ewa/EWA-COMPANION-WORKFLOW-TOOLS-STANDARD-MASTER-PLAN.md` *[operator-local process plan; gitignored — not living canon]* | Tools + admin workflows foundation |

## Brand / persona

| Doc | Role |
|-----|------|
| [EWA-BRAND-AND-PHILOSOPHY.md](EWA-BRAND-AND-PHILOSOPHY.md) | Brand boundaries |
| `documentation/plans/product/ewa/EWA-PERSONA-FAMILY-ROADMAP.md` *[operator-local process plan; gitignored — not living canon]* | Persona family |
| [EWA-COMPANION-PERSONA-VISION.md](EWA-COMPANION-PERSONA-VISION.md) | Companion persona (vision, not API spec) |
| [EWA-COMPANION-PROFILE-ADR.md](EWA-COMPANION-PROFILE-ADR.md) | Per-user memory profile |
| [EWA-COMPANION-SEED-PERSONA-MATRIX.md](EWA-COMPANION-SEED-PERSONA-MATRIX.md) | `seed_persona_id` matrix |
| [EWA-COMPANION-EVOLUTION-CANON.md](EWA-COMPANION-EVOLUTION-CANON.md) | Evolution L0–L5 |

## Developer extension

| Doc | Role |
|-----|------|
| [EWA-COMPANION-CHAT-AND-WORKFLOW-EXTENSION-GUIDE.md](EWA-COMPANION-CHAT-AND-WORKFLOW-EXTENSION-GUIDE.md) | Tool/surface/UI owners and Web/KBSEW boundaries |
| [EWA-COMPANION-DOC-EDITOR-AND-SHELL-CONTEXT.md](EWA-COMPANION-DOC-EDITOR-AND-SHELL-CONTEXT.md) | Doc editor + shell context |
| [EWA-COMPANION-USER-WORKFLOWS.md](EWA-COMPANION-USER-WORKFLOWS.md) | User phrase chains |

Other files in this directory are topic-specific ADRs, contracts or runbooks. Production topology: [PRODUCTION-TOPOLOGY-STATE.md](../../platform/PRODUCTION-TOPOLOGY-STATE.md).
