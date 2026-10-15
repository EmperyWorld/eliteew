# Маркетинговый кабинет (EliteEW)

Канон **маркетингового кабинета** и **маркетинговой AMKA** (staged-прогоны по проекту).
Операторский обзор: [MARKETING-CABINET.md](MARKETING-CABINET.md).

## Граница с EWA (обязательно)

| Контур | HTTP | UI | Код |
|--------|------|----|-----|
| **Маркетинговая AMKA** | `/api/v1/marketing-cabinet/amka/*` | Marketing Cabinet → вкладка **AMKA** | `api/services/marketing_cabinet/amka_*`, `api/routers/marketing_cabinet/amka.py`, FE `src/features/amka/` + bridge `src/services/amka/marketingCabinetAmkaBridge.ts` |
| **EWA (платформа)** | `/api/v1/ewa/*` | окно **EwaApp** на столе | `api/ewa_platform/`, FE `src/features/ewa/`, `src/services/ewa/` |

Таксономия: [../ewa/EWA-VS-AMKA-TAXONOMY.md](../ewa/EWA-VS-AMKA-TAXONOMY.md). Контуры: [../amka-seed-album/AMKA-CONTOURS.md](../amka-seed-album/AMKA-CONTOURS.md).

**Не смешивать:** `ewa_platform` / companion / desktop orchestration — не кабинет и не вкладка AMKA. Retired DEWA и прочие soft-retire деревья — не living путь кабинета.

Пакет `api/services/amka_core/` — общий **driver/engine** слой (в т.ч. `MarketingCabinetAmkaDriver`); lifecycle маркетингового прогона и таблицы `marketing_amka_*` остаются только под `/api/v1/marketing-cabinet/amka/*`. Клиент `src/services/amka/amkaFacadeApi.ts` ходит в **`/api/v1/ewa/ugs/...`** (UGS admin alignment) — это не вкладка кабинета.

## Оглавление

| Документ | Назначение |
|----------|------------|
| [MARKETING-CABINET.md](MARKETING-CABINET.md) | Кабинет целиком: навигация, API, дашборд, код-карта |
| [AMKA-REFERENCE.md](AMKA-REFERENCE.md) | Ассистент маркетинговых прогонов AMKA |
| [AMKA-AUDIT-WORKFLOW.md](AMKA-AUDIT-WORKFLOW.md) | Workflow, SSE, права, runbook |
| [amka/README.md](amka/README.md) | Техмодули `amka_*.py`, tool-agent whitelist |
| [marketer-analysis-review/README.md](marketer-analysis-review/README.md) | Проверка качества анализов для маркетолога |
| [MARKETING-PROJECT-RAG.md](MARKETING-PROJECT-RAG.md) | RAG проекта, autofill |
| [MARKETING-TOOL-AGENT.md](MARKETING-TOOL-AGENT.md) | Tool-agent чата / AI Studio |
| [IMC-MISO-ARCHITECTURE.md](IMC-MISO-ARCHITECTURE.md) | ИМК / UGS / MISO |
| [IMC-RESEARCH-TYPES-PLAYBOOK.md](IMC-RESEARCH-TYPES-PLAYBOOK.md) | Типы `imc_rag_*` |
| [MARKETING-CABINET-PERFORMANCE.md](MARKETING-CABINET-PERFORMANCE.md) | Перф, gating |
| [MARKETING-CABINET-PROMPTS-REFERENCE.md](MARKETING-CABINET-PROMPTS-REFERENCE.md) | Промпты секций |
| [DASHBOARD-REGRESSION-CHECKLIST.md](DASHBOARD-REGRESSION-CHECKLIST.md) | Регресс дашборда |
| [ADR-REACT-GRID-LAYOUT.md](ADR-REACT-GRID-LAYOUT.md) | ADR: React Grid Layout для интерактивной сетки |
| [OVERVIEW-SUMMARY-SPEC.md](OVERVIEW-SUMMARY-SPEC.md) | Операторский снимок проекта (overview summary) |
| Offline HTML | soft-retired 2026-08-13 under `trash/` (id 20260812-153911, was …/marketing) (`marketing-cabinet-guide-for-marketers.html`, `marketing-cabinet-structure-visual.html`) — living SoT = [MARKETING-CABINET.md](MARKETING-CABINET.md) |

Видение драйверов / seed (не runtime кабинета): [../amka-seed-album/README.md](../amka-seed-album/README.md).
