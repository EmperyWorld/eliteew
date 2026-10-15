# Цели и нормы пакета `ewa_platform`

Документ для разработчиков и агентов: **зачем** существует это дерево, **какие правила** обязательны и **как** согласовать код с остальным монорепозиторием EliteEW.

Краткая карта модулей и таблица зависимостей по-прежнему в [`README.md`](./README.md). Продуктовый обзор и фазы внедрения — в [`product/amka-seed-album/EWA-PLATFORM-GREENFIELD.md`](../../../documentation/product/amka-seed-album/EWA-PLATFORM-GREENFIELD.md). Видение EWA как **персонального спутника пользователя** (характер, стиль, уважительное мнение) — [`product/ewa/EWA-COMPANION-PERSONA-VISION.md`](../../../documentation/product/ewa/EWA-COMPANION-PERSONA-VISION.md).

---

## 1. Цель

- **Параллельная платформа EWA** под одним корнем `api/ewa_platform/`, без «монолита внутри платформы»: логика и контракты не размазываются по чужим доменам в `api/services/<другие_продукты>/`.
- **Не ломать прод-сейчас**: новый пакет живёт рядом с `api/services/amka_core`; переключение маршрутов и БД — отдельные фазы (feature-flag, префикс API и т.д.).
- **Сервер владеет оркестрацией**: сценарии, промпты и состояние прогона моделируются на сервере; клиенты (в т.ч. UI) в целевой картине — **отображение и ввод**, а не источник бизнес-логики EWA.
- **Явные контракты обмена**: единый JSON-envelope (request / response / event), версия `api_version`, при необходимости `/schema_ref`, плюс JSON Schema для потребителей вне Python.
- **Несколько драйверов по доменам**, а не один «весь десктоп»: рабочий стол / shell (`DesktopShellDriver` и адаптеры), **UGS**, документы, контент и т.д. — отдельные границы `Protocol` + реализации; оркестратор на сервере связывает сценарий через выбранные порты.

Итог: `ewa_platform` — **источник правды для I/O и модульной архитектуры нового контура**; `amka_core` остаётся историческим источником идей при ручном переносе, а не зависимостью в коде платформы.

---

## 2. Инварианты (нельзя нарушать без явного решения)

| Инвариант | Смысл |
|-----------|--------|
| **Нет импорта из `api.services.amka_core`** | В коде `ewa_platform` не импортировать legacy-модули. Допустимы только комментарии и документации вида «см. идею в …». |
| **Ациклический граф зависимостей** | Слои подключаются только «вниз» по иерархии (см. §3). |
| **Без SQL и HTTP в `core` по смыслу слоя** | Ядро — машина состояний / пайплайн; доступ к БД только через порты `persistence*`; вход с сети — через `gateways/`. |
| **`contracts/` остаётся лёгким** | Без asyncio, без драйверов БД, без FastAPI. Предпочтительно dataclass / StrEnum / Protocol; тяжёлые валидации (Pydantic) — по необходимости в `io/` или `gateways/`, не раздувая `contracts/`. |
| **Отдельная БД EWA** | DSN только **`EWA_DATABASE_URL`**, не смешивать с **`DATABASE_URL`** приложения EliteEW. |
| **`py.typed`** | Файл в корне пакета — **пустой маркер PEP 561**; его наличие важнее содержимого. |

---

## 3. Направление зависимостей (слои)

Допустимые импорты между подпакетами `ewa_platform`:

- `contracts` → *ни на кого из платформы*.
- `schemas` → распадается на **`schemas/json`** (артефакты JSON Schema, потребители вне Python) и **`schemas/pydantic`** (Pydantic v2 модели для FastAPI‑роутеров). Python‑код в `schemas/pydantic` тянет только `contracts` и `api.core.unified_config`, но не доменные сервисы.
- `io` → `contracts` (при необходимости общих типов).
- `policy` → `contracts` (только данные контекста и правил).
- `llm` → `contracts` (опционально для типизированных ответов; без тяжёлых импортов).
- `runtime` → `contracts` (время и scope как данные).
- `core` → `contracts`, `io`, `drivers`, `policy`, `llm`, `runtime`, `persistence` (только через **Protocol**).
- `persistence` / `persistence_pg` / `persistence_vector` → `contracts` и ниже по слою реализаций (PG / Qdrant — реализации портов).
- `adapters` → `drivers` (реализации `*Driver` Protocol), `contracts` (типы payload); **не** импортировать из `contracts` обратно в `adapters` через циклы.
- `desktop` → `core`, `persistence_pg` (`orchestration_asyncpg`), `contracts`. Композиционный корень оркестрации десктопа; **не** содержит FastAPI‑роутов.
- `gateways/routers/*` → `desktop`, `companion`, `gateways/runtime_gateway`, `schemas/pydantic`. Только тонкие FastAPI‑адаптеры; бизнес‑правила запрещены.
- `gateways/runtime_gateway/*` → `companion.storage.catalog_listing`, `persistence_pg`, `schemas/pydantic`. Сервис‑слой контекста / команд EWA Runtime Gateway.
- `gateways/companion_http.py` → `gateways/routers/*` (фасад `include_ewa_routers`). **Единственная точка** регистрации EWA‑роутеров на FastAPI‑приложении.
- `companion/*` → `contracts`, `schemas/pydantic`, `persistence_pg`, `persistence_vector`, `api.services.*` (только `chat_memory_service`, `unified_content` query) и собственные подпакеты. Подпакеты `companion/` могут зависеть друг от друга, но без циклов (см. ниже).
- `workers/*` → `core`, `companion/episodic`, `companion/persona`, `persistence_pg` (Celery‑задачи без дублирования правил из `core`).
- `media` → `contracts` и локальные протоколы; мост к voice/объектному хранилищу — позже, через gateway.
- `testing` → публичные контракты и фейки; не регистрировать прод-Celery и не открывать прод-БД из «чистых» юнит-тестов без метки интеграции.
- `docs` → без импорта Python; только Markdown.

**Запрет:** `contracts` **не** импортирует `adapters`, `gateways`, `llm`, `persistence_pg`. Подпакеты `companion/` импортируют **только** друг друга и `desktop/`, `gateways/runtime_gateway/`, `schemas/pydantic/`, `persistence_*/` — но **не** `gateways/routers/*`.

Циклы между подпакетами **запрещены**.

### 3.1 Внутри `companion/`

После консолидации 2026‑05‑12 пакет имеет **только подпакеты**:

| Подпакет | Назначение |
|---------|-----------|
| `turn/` | Главный chat‑turn пайплайн (`chat_turn.py`) и budget‑модуль системного промпта (`system_budget.py`). |
| `orchestration/` | Маршрутизация хода (`task_orchestrator.py`, `routing_policy.py`). |
| `server_first/` | Опт‑ин ветка server‑first переписывания файла (`v2.py`). |
| `memory/` | HCM / identity / episodic recall (`retrieval.py`, `chat_condense.py`, `ground_truth.py`, `hcm_store.py`). |
| `episodic/` | Запись эпизодов, переэмбеддинг, ежедневный rollup, санитайзер тела эпизода. |
| `persona/` | Характер, evolution tick / summary, anticipation. |
| `context/` | Context anchor v1 (compose, ops, controller) + sanitize шумов. |
| `affective/` | Mood palette, affective router, persona style, self‑correction. |
| `actions/` | Ambient действия в шину (открытие приложения и т.д.). |
| `ux/` | Парсер UX‑интентов (action inference, actions log, reply extract, observation rate limit, desktop config/theme execute). |
| `sidecar/` | LLM‑sidecar модули: intent planner, trust classify/turn/state, llm bandwidth/kv markdown, search intent, shell context / listing ordinals, arlika wrath classify, **stack2_semaphore** для throttle embed‑вызовов. |
| `storage/` | DocEditor content resolve / edit / translate, catalog find / file discuss / pipeline и **catalog_listing** (логический дедуп листинга). |
| `contracts/` | Реэкспорт типов из `api/schemas` для intent‑планов и других контрактов. |

---

## 4. Стандарты кода в монорепозитории EliteEW

Все новые и существенно меняемые файлы **`shared/api/ewa_platform/**/*.py`**:

1. **Заголовок файла** — по канону **авторство + Purpose / Invariants / Related** (см. `.cursor/rules/eliteew-file-authorship.mdc`). При смене роли модуля или публичного контракта — обновить текст в той же правке.
2. **Формат и линтер** — из каталога **`shared/api`**: `uv run ruff format <пути>` и `uv run ruff check <пути>` по списку затронутых `.py` (см. `.cursor/rules/eliteew-user-workflow-preferences.mdc` и `coding-standards.mdc`).
3. **Python** — версия проекта `>=3.14`; для контрактов предпочтительны `dataclass(slots=True)`, `StrEnum`, `Protocol`.
4. **Тесты** — по возможности в `shared/api/tests/` с префиксом, понятным по домену (`test_ewa_platform_*.py`); контрактные проверки envelope и фейки из `ewa_platform/testing/`.

Правило Cursor с краткой выжимкой для агентов: **`.cursor/rules/ewa-platform.mdc`**.

---

## 5. Контракт I/O (envelope v1)

- **Модели и маппинг:** `io/envelope.py` (`EwaRequestV1`, `EwaResponseV1`, `EwaEventV1`, функции `*_to_mapping` / `*_from_mapping`).
- **Константа версии:** `EWA_IO_API_VERSION` (сейчас `"1"`).
- **JSON Schema:** `schemas/ewa_io_v1.json` (черновик 2020-12, валидация через `$ref` на `#/$defs/...`).
- **Эволюция:** несовместимые поля → новая версия типов и отдельный файл схемы (`*_v2`); старые клиенты продолжают использовать v1.
- **Расширяемость `message_type`:** известные значения зафиксированы в `StrEnum`; дополнительные строки допустимы по политике совместимости, если согласованы с потребителями.

---

## 6. Данные и инфраструктура

- **Отдельный Postgres для EWA orchestration:** `docker/stack/stack-ewa-postgres.yml`, том данных `docker/data/ewa/postgresql` (относительно репозитория), пример переменных — `docker/env_file/.env.stack-ewa.example`.
- **Миграции** для EWA-БД — отдельный контур (`api/ewa_platform/migrations/`), не смешивать с миграциями основной БД приложения без явного решения; операторский скрипт см. **`migrations/README.md`**.
- **Секреты и DSN** в правилах и в этом файле **не дублировать**; в коде — только имена переменных окружения.

---

## 7. Документация и рабочий процесс

- Изменения контракта I/O, слоёв или политики импорта — отразить здесь или в [`README.md`](./README.md), а продуктовые следствия при необходимости — в **`product/ewa/`**, **`product/amka-seed-album/`** и оглавлении **`documentation/INDEX.md`** (по `documentation-maintenance.mdc`).
- Таблица соответствия `amka_core` → `ewa_platform` для ручного переноса — в **`EWA-PLATFORM-GREENFIELD.md`**.

---

## 8. Краткий чеклист перед слиянием правки

- [ ] Зависимости между подпакетами не нарушают §3.
- [ ] Нет импорта `api.services.amka_core` в новом коде.
- [ ] Заголовки Purpose/Invariants/Related актуальны для затронутых `.py`.
- [ ] `ruff format` и `ruff check` по изменённым путям из `shared/api`.
- [ ] При изменении полей envelope — синхронизированы `schemas/ewa_io_v1.json` (или добавлен новый файл схемы) и тесты маппинга при наличии.

Этот документ можно дополнять по мере появления новых подпакетов, если они войдут в тот же корень `ewa_platform`, с явным обновлением §3 и карты в `README.md`.
