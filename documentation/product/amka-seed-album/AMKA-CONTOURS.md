# AMKA и EWA: контуры продукта (канон)

**Зачем этот лист:** слова **AMKA** и **EWA** обозначают **разные контуры** EliteEW: разные HTTP-префиксы, данные, FE-деревья и экраны. Их **нельзя** смешивать при проектировании и поддержке.

**Альбом `amka-seed-album/`** — семя и контракты **маркетинговой / standalone AMKA**. Живой канон спутника и платформы — **`product/ewa/`**.

**Спутник пользователя (EWA):** [EWA-COMPANION-PERSONA-VISION.md](../ewa/EWA-COMPANION-PERSONA-VISION.md). Маркетинговая AMKA имеет свой UX-копирайт; общие инварианты прогонов — [VISION-VECTORS.md](VISION-VECTORS.md).

**Таксономия:** [EWA-VS-AMKA-TAXONOMY.md](../ewa/EWA-VS-AMKA-TAXONOMY.md).

Подробная карта входов: [**AMKA-ENTRYPOINTS.md**](AMKA-ENTRYPOINTS.md).

---

## Сводная таблица

| Контур | Задача для пользователя / оператора | Канонический HTTP | Основное хранилище | UI в EliteEW |
|--------|-------------------------------------|-------------------|---------------------|--------------|
| **AMKA** (маркетинговый кабинет) | Staged-аудит проекта → план → исполнение по шагам → отчёты, pulse | **`/api/v1/marketing-cabinet/amka/*`** | Таблицы `marketing_amka_*` | **Marketing Cabinet → проект → вкладка AMKA** (`features/amka/`, `MarketingCabinetAmkaView`) |
| **EWA** (платформа) | Оркестрация рабочего стола (observations → intents, SSE); companion; каталог драйверов; read-only UGS alignment | **`/api/v1/ewa/*`** | Postgres **`EWA_DATABASE_URL`** (`shared/api/ewa_platform/persistence_pg/`) | Окно **`EwaApp`**: `features/ewa/EwaDesktopApp` → **`EwaDesktopView`** |

**Пакет кода EWA:** `shared/api/ewa_platform/`. Обзор (лист-мост в этом альбоме): [EWA-PLATFORM-GREENFIELD.md](EWA-PLATFORM-GREENFIELD.md). HTTP-клиент SPA: **`src/services/ewa/`** (не `services/amka/`).

> **Legacy:** имена «платформенная AMKA» сняты. Канон: **`/api/v1/ewa`**, **`shared/api/ewa_platform/`**, FE **`src/features/ewa/`**. Stub-алиасы `AMKA-PLATFORM-GREENFIELD` / `AMKA-COMPANION-PERSONA-VISION` soft-retired в `trash/` (2026-07-18).

---

## Типичные ошибки

1. **«Вкладка AMKA в кабинете и окно EWA на столе — одно и то же»** — **нет**. Кабинет — маркетинговые прогоны; стол — EWA desktop orchestration / companion.
2. **«Платформенную EWA можно развивать через marketing AMKA API»** — **нет**. Используйте **`/api/v1/ewa/*`** для платформы и **`/api/v1/marketing-cabinet/amka/*`** для кабинета. Не импортировать `amka_core` из `ewa_platform`.
3. **«`src/features/amka/` — общая папка с EWA»** — **устарело**. Сейчас **`features/amka/`** = только маркетинговая AMKA (`AmkaView`, pulse UI, cabinet bridge). EWA — **`features/ewa/`** + **`services/ewa/`** (`ewaDesktopOrchApi`, companion chat).

---

## Куда копать по теме

| Тема | Документ / код |
|------|----------------|
| Маркетинговые прогоны AMKA | [AMKA-REFERENCE.md](../marketing/AMKA-REFERENCE.md), `shared/api/routers/marketing_cabinet/amka.py` |
| Входы и drivers | [AMKA-ENTRYPOINTS.md](AMKA-ENTRYPOINTS.md) |
| Карта слоёв standalone (маркетинг) | [AMKA-STANDALONE-LAYER-MAP.md](AMKA-STANDALONE-LAYER-MAP.md) |
| Оркестрация десктопа / companion EWA | `product/ewa/`, `shared/api/ewa_platform/docs/DESKTOP-ORCHESTRATION.md` |
