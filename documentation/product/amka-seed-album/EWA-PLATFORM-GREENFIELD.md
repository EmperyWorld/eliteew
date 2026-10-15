# EWA platform (greenfield)

**Граница:** это лист-мост про пакет **`shared/api/ewa_platform/`**, исторически лежащий в `amka-seed-album/`. Он **не** описывает маркетинговые прогоны AMKA. Живой продуктовый канон EWA (companion, brand, ops) — **`product/ewa/`**. Семя маркетинговой AMKA — остальные листы этого альбома + `product/marketing/`.

Каноническое описание параллельного дерева **`shared/api/ewa_platform/`**: контракты обмена (envelope v1), модули платформы **EWA**, отдельная БД Postgres и фазы переноса идей с **`api/services/amka_core`** без импорта legacy из кода пакета.

**Таксономия AMKA vs EWA:** [EWA-VS-AMKA-TAXONOMY.md](../ewa/EWA-VS-AMKA-TAXONOMY.md). Технические контуры: [AMKA-CONTOURS.md](AMKA-CONTOURS.md).

**Видение спутника пользователя (EWA):** [EWA-COMPANION-PERSONA-VISION.md](../ewa/EWA-COMPANION-PERSONA-VISION.md).

## Зачем отдельное дерево

- **Изоляция**: пакет не импортирует `amka_core`; legacy остаётся источником идей до явного cutover.
- **Модульность**: один корень для платформенного контура EWA.
- **Серверная оркестрация**: промпты и сценарии на сервере; UI — отображение и ввод.

## Дерево пакета

| Путь | Роль |
|------|------|
| `contracts/` | Чистые типы (`ArtifactDescriptor`, виды артефактов). |
| `schemas/ewa_io_v1.json` | JSON Schema для `EwaRequestV1` / `EwaResponseV1` / `EwaEventV1` (`$defs`). |
| `io/envelope.py` | Python-модели envelope + маппинг. |
| `core/` | Оркестратор десктопа и связанная логика. |
| `drivers/` | Протоколы драйверов, реестр. |
| `persistence/` | Порты сессий и событий оркестрации. |
| `persistence_pg/` | Postgres (`EWA_DATABASE_URL`). |
| `gateways/` | HTTP helpers для envelope / desktop signal. |
| `workers/` | Заготовки очереди. |
| `media/` | TTS-задел. |
| `testing/` | Фейки и билдеры для тестов. |

Подробнее: **`shared/api/ewa_platform/README.md`**, **`GOALS-AND-NORMS.md`** в том же дереве.

## Версионирование envelope

- **`api_version`**: строка; рабочая версия — **`1`** (`EWA_IO_API_VERSION`).
- Несовместимые изменения → новые типы и отдельный файл схемы.

## Postgres для EWA

- Compose: **`docker/stack/stack-ewa-postgres.yml`** (сервис **`stack-ewa-postgres`**; DSN в приложении — **`EWA_DATABASE_URL`**).
- Пример env: **`docker/env_file/.env.stack-ewa.example`** — ключи в коде ориентируются на **`EWA_*`** (см. runbook).
- Операторский чеклист: **`platform/docker-re_doc/EWA-POSTGRES-RUNBOOK.md`** (или актуальный alias в том же каталоге).

## Соответствие `amka_core` → `ewa_platform` (ручной перенос)

Идеи переносятся **вручную** из `api/services/amka_core` в **`api/ewa_platform`** (историческое имя пакета `api/amka_platform` не используется). Stub-алиас `AMKA-PLATFORM-GREENFIELD.md` soft-retired в `trash/` (2026-07-18).

## Фазы после skeleton

1. Skeleton — контракты, envelope, схемы, docker-черновик.  
2. Перенос идей из `amka_core` вручную.  
3. Реализация `core/` и `persistence_pg/`.  
4. Переключение маршрутов и флагов отдельными фазами.

## Связанные документы

- [EWA-BRAND-AND-PHILOSOPHY.md](../ewa/EWA-BRAND-AND-PHILOSOPHY.md)
- [RFC-001-amka-driver-contract.md](RFC-001-amka-driver-contract.md)
- [AMKA-STANDALONE-LAYER-MAP.md](AMKA-STANDALONE-LAYER-MAP.md)
- `.cursor/rules/ewa-platform.mdc`
