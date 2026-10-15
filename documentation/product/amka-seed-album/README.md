# Альбом семени жизни AMKA

**Рабочее имя каталога в репозитории:** `product/amka-seed-album/`.

Здесь живёт не «справка по текущему коду», а **развивающийся слой смысла** для **маркетинговой AMKA**: направления, этика продукта, архитектурные векторы и черновики будущего **standalone-ядра прогонов** (драйверы, модульные инструменты, pulse) — с кабинетом как первым клиентом.

## Граница альбома (AMKA seed ≠ EWA)

| Контур | Что это | Где канон |
|--------|---------|-----------|
| **Маркетинговая AMKA** (этот альбом + `product/marketing/`) | Staged-прогоны кабинета: audit → plan → execute → pulse; HTTP **`/api/v1/marketing-cabinet/amka/*`**; FE **`src/features/amka/`** | Этот каталог + [AMKA-REFERENCE.md](../marketing/AMKA-REFERENCE.md) |
| **EWA** (платформа / спутник) | Desktop orchestration, companion, **`/api/v1/ewa/*`**, пакет **`api/ewa_platform`**; FE **`src/features/ewa/`**, **`src/services/ewa/`** | **`product/ewa/`** — таксономия [EWA-VS-AMKA-TAXONOMY.md](../ewa/EWA-VS-AMKA-TAXONOMY.md) |

**Не смешивать:** вкладка AMKA в Marketing Cabinet ≠ окно **EwaApp** на столе. Сводная таблица: [AMKA-CONTOURS.md](AMKA-CONTOURS.md).

Устаревшие stub-алиасы (`AMKA-PLATFORM-GREENFIELD`, `AMKA-COMPANION-PERSONA-VISION`) **soft-retired** в `trash/` (2026-07-18): greenfield платформы — [EWA-PLATFORM-GREENFIELD.md](EWA-PLATFORM-GREENFIELD.md); персона спутника — [EWA-COMPANION-PERSONA-VISION.md](../ewa/EWA-COMPANION-PERSONA-VISION.md).

## Зачем этот «альбом»

- **Семя** — идеи и инварианты, из которых вырастает маркетинговая / standalone AMKA.
- **Альбом** — не один манифест, а **листы**, которые дополняются по мере разговоров и решений.
- **Жизнь** — сознательный отказ от застывшего ТЗ: документы здесь **растут** и иногда пересматриваются.

## Связь с техникой (уже есть в репо)

| Что | Где |
|-----|-----|
| Контуры AMKA vs EWA **сейчас** | [AMKA-CONTOURS.md](AMKA-CONTOURS.md), [EWA-VS-AMKA-TAXONOMY.md](../ewa/EWA-VS-AMKA-TAXONOMY.md) |
| Операционный справочник маркетинговых прогонов | `product/marketing/AMKA-REFERENCE.md`, `product/marketing/amka/` |
| Живой канон EWA (companion, brand, ops) | `product/ewa/` |
| Куда класть **новые листы альбома** (маркетинг AMKA seed) | этот каталог; см. [GROWTH-CONVENTIONS.md](GROWTH-CONVENTIONS.md) |

## Листы альбома (оглавление)

| Документ | Содержание |
|----------|------------|
| [VISION-VECTORS.md](VISION-VECTORS.md) | План на план: северная звезда, слои, драйверы, модульные инструменты, человеческий контур, мета-роадмап, ямы |
| [GROWTH-CONVENTIONS.md](GROWTH-CONVENTIONS.md) | Как наращивать альбом (имена файлов, жанры; worklog retired — хронология в chat/`git log`) |
| [RFC-001-amka-driver-contract.md](RFC-001-amka-driver-contract.md) | Инженерный контракт standalone AMKA: core, driver, risk policy, trace, pulse |
| [AMKA-STANDALONE-LAYER-MAP.md](AMKA-STANDALONE-LAYER-MAP.md) | Карта backend/frontend **маркетинговой AMKA** по слоям core / driver / adapter / facade / UI |
| [PULSE-ARTIFACT.md](PULSE-ARTIFACT.md) | Дизайн артефакта `pulse`: изменения, сохранённое, сомнения, договорённости, no-op |
| [AMKA-ENTRYPOINTS.md](AMKA-ENTRYPOINTS.md) | Входы marketing AMKA и (для сравнения) HTTP EWA; driver/profile |
| [AMKA-CONTOURS.md](AMKA-CONTOURS.md) | **AMKA vs EWA:** кабинет vs платформа `/api/v1/ewa` |
| [EWA-PLATFORM-GREENFIELD.md](EWA-PLATFORM-GREENFIELD.md) | Обзор пакета **`api/ewa_platform`** (лист-мост; живой EWA-канон — в `product/ewa/`) |
| [AMKA-BACKGROUND-TASK-KEYS.md](AMKA-BACKGROUND-TASK-KEYS.md) | Ключи фоновых asyncio-задач marketing AMKA и отмена при `cancel_run` |
| [ADR-002-amka-neutral-store-defer.md](ADR-002-amka-neutral-store-defer.md) | ADR: defer neutral `amka_runs` store until second production driver is field-proven (post-gate work draft soft-retired under `trash/` (id 20260812-160858, was …/AMKA-NEUTRAL-STORE-POST-GATE-SCOPE.md)) |
| [AMKA-TRACE-EXPORT-GUIDELINES.md](AMKA-TRACE-EXPORT-GUIDELINES.md) | Поля trace/export для marketing AMKA |
| [ADR-002-amka-neutral-store-defer.md](ADR-002-amka-neutral-store-defer.md) | ADR: отложить нейтральный SoT до второго production driver |

**Вне альбома (EWA, не дублировать сюда):** [EWA-COMPANION-PERSONA-VISION.md](../ewa/EWA-COMPANION-PERSONA-VISION.md) — персона спутника.

*Новые файлы добавляйте строкой в таблицу выше.*

---

*Создано как пространство для совместного мышления: от кабинета к драйверам standalone AMKA. Платформа EWA — отдельный контур.*
