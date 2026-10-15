# AMKA — техническая документация (по файлам)

Канон обзора продукта и API (только **маркетинговые прогоны**): **[../AMKA-REFERENCE.md](../AMKA-REFERENCE.md)**. Хаб каталога: **[../README.md](../README.md)**.

**Не путать с EWA:** окно **EwaApp** (`src/features/ewa/`), пакет **`ewa_platform`**, HTTP **`/api/v1/ewa/*`** — другой контур. См. **[../../ewa/EWA-VS-AMKA-TAXONOMY.md](../../ewa/EWA-VS-AMKA-TAXONOMY.md)** и **[../../amka-seed-album/AMKA-CONTOURS.md](../../amka-seed-album/AMKA-CONTOURS.md)**.

Жизненный цикл, логи, runbook: **[../AMKA-AUDIT-WORKFLOW.md](../AMKA-AUDIT-WORKFLOW.md)**. Seed / видение драйверов (не runtime кабинета): **[../../amka-seed-album/README.md](../../amka-seed-album/README.md)**.

Этот каталог дробит **технический контур маркетингового кабинета** на отдельные markdown-файлы:

| Раздел | Путь | Содержание |
|--------|------|------------|
| HTTP и типы | [http-api-router.md](http-api-router.md) | FastAPI-роутер `amka.py`, зависимости, потоки |
| Схемы Pydantic | [schemas-and-types.md](schemas-and-types.md) | `schemas/marketing_cabinet/amka*.py` |
| Инструменты tool-agent | [agent-tools/README.md](agent-tools/README.md) | Whitelist `marketing_agent_tools.py` + оркестрация |
| Модули сервиса | [modules/README.md](modules/README.md) | Один файл ≈ один `amka_*.py` в `api/services/marketing_cabinet/` |

Пакет реэкспорта фаз: [modules/amka-phases-package.md](modules/amka-phases-package.md).
