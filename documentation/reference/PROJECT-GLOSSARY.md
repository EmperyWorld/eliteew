# Глоссарий проекта (кросс-репозиторный)

Краткие определения и **куда смотреть подробно**. Детальный продуктовый контур ИМК/UGS: **`product/marketing/MARKETING-CABINET.md`**, **`product/marketing/IMC-MISO-ARCHITECTURE.md`**.

> Операторский runtime по умолчанию: **Podman**. Ссылки/названия `docker/*` сохранены как часть текущей структуры репозитория.

## Не путать: «Ассистент» в UI и справочник в репозитории

| Что | Где искать |
|-----|------------|
| **Тексты документации** монорепозитория (архитектура, Docker, продуктовые гайды) | Каталог **`documentation/`**, корень **`documentation/README.md`** |
| **Продукт «Ассистент»** — FAQ, чат с Llama, RAG, **раздел админки** «Ассистент» | **`product/PRODUCT-ASSISTANT-HANDBOOK.md`**; индексация KB: **`product/PRODUCT-ASSISTANT-KB-INDEXING.md`** |

## Монорепозиторий

| Термин | Смысл |
|--------|--------|
| **`powered_by_emperyworld`** | Корень монорепозитория на диске. |
| **`EliteEW/`** | Прикладной код: `shared/api/`, `shared/web/frontend/`, публичный лендинг: target `shared/web/site_prod/` (canon [product/SITE-PROD-LANDING.md](../product/SITE-PROD-LANDING.md)); legacy tree `shared/web/landing/` archived-in-tree (не править). |
| **`pack-cloud/mobile/`** | Нативное Android-приложение (SSO `empery-mobile`, OTA на prod-core). |
| **`documentation/`** | Живой канон: **`{product,platform,api,database,reference}/`**. Stub **`worklog/README.md`** (retired). Оглавление — **`../INDEX.md`**. |
| **Soft-retired trees** | DEWA, EWPower, EWC, EWCoderOrchestrator (EWCO), EWGen, nexus-root, SSFEW, access-gate-logwatch, tg_bot_ip_verif — под **`trash/`**, не живой workspace. Не восстанавливать без явной просьбы оператора. |

## Контейнерные стеки (podman-first)

| Стек | Роль |
|------|------|
| **stack0** | API, фронт, RabbitMQ-воркер, **Celery E0 ×4** (general + agentic + companion + discussion) + single beat (prod: baked / dev-bind dual line). SoT: [PRODUCTION-TOPOLOGY-STATE.md](../platform/PRODUCTION-TOPOLOGY-STATE.md) §Current · queues: [CELERY-BEAT-AND-QUEUES.md](../platform/CELERY-BEAT-AND-QUEUES.md). |
| **stack1** | БД и сопутствующие сервисы: Postgres, Redis, RabbitMQ, **Qdrant (vector primary)**, **SeaweedFS (blob/S3)**, Elasticsearch; **Chroma** в compose — **legacy fallback** only (`UNIFIED_VECTOR_READ_BACKEND=chroma`). См. [STORAGE-AND-VECTOR-TOPOLOGY.md](../platform/docker-re_doc/STORAGE-AND-VECTOR-TOPOLOGY.md). |
| **stack2** | AI-сервисы (на prod-core — `llama-chat`; embed/rerank/tool-router часто на gpu141). **`LLAMA_URL`** в коде — не синоним «у нас установлен Llama»: см. **`platform/docker-re_doc/STACK0-LLM-OVERVIEW.md`**. |
| **stack4** | OCR / Tika / Gotenberg / Paperless (runtime deploy с command-center). |
| **stack6** | Keycloak + Postgres (см. **`platform/docker-re_doc/KEYCLOAK-ELITEEW.md`**). |
| **stack9** | Voice inference (Whisper/F5), поднимается по задачам voice-контура. |
| **stack11** | Jitsi Meet для внутренних видеозвонков. |
| **stack12** | Internal DNS (CoreDNS) для site hosts. См. **`platform/docker-re_doc/INTERNAL-DNS.md`**. |
| **stack3**, **stack5** | Compose retained under `docker/stack/`; **не** поднимать на prod без явной задачи. См. **`project-and-deploy.mdc`**. |
| **stack666**, **OpenVPN AS** | **Retired** → `trash/` (не поднимать). Публичный HTTPS — edge + tunnel / Meet WG; operator remote access — LAN / Meet WG / mobile private tunnel, не OpenVPN AS. См. **`platform/docker-re_doc/EMPERY-EDGE-IP-OPERATIONS.md`**, **`platform/docker-re_doc/INTERNAL-SITES-ACCESS.md`**. |

Расширенный ориентир: **`.cursor/rules/project-and-deploy.mdc`**, живая топология: **`platform/PRODUCTION-TOPOLOGY-STATE.md`**.

## Soft-retired operator contours (не живой workspace)

Имена ниже встречаются в истории. Ops CLI: `docker/scripts/eliteew-*.sh` (renamed from `dewa-ops-*`). **Деревья приложений soft-retired в `trash/`** — не scope работ и не локальные URL «как сейчас».

| Термин | Бывший смысл | Статус |
|--------|--------------|--------|
| **DEWA** | Operator shell (Bridge, divisions, mission routing). | Soft-retired → `trash/`. Не канон. |
| **EWPower** | Исполнитель production/perimeter контуров. | Soft-retired → `trash/`. |
| **EWC** | Операционный агент миссий. | Soft-retired → `trash/`. |
| **EWCO** / EWCoderOrchestrator | Coding orchestrator Deck/API. | Soft-retired → `trash/`. |
| **EWGen** | Генератор модулей. | Soft-retired → `trash/`. |
| **Logwatch** / access-gate | Периметр access events. | Soft-retired → `trash/`. |

Операторский контур **сейчас**: command-center (`.136`) + prod-core (`.111`) + gpu141 + edge VM — см. **`platform/PRODUCTION-TOPOLOGY-STATE.md`**. Deploy wrappers: `eliteew-*.sh` / `eliteew-ops-lib.sh` (formerly `dewa-ops-*`) — EliteEW helpers, не живое приложение DEWA.

## Продукт и бэкенд (сжато)

| Термин | Смысл | Подробнее |
|--------|--------|-----------|
| **ИМК / IMC** | Слой маркетингового кабинета: типы исследований, запуск, история. | `product/marketing/MARKETING-CABINET.md`, `product/marketing/IMC-MISO-ARCHITECTURE.md` |
| **UGS** | Unified Generation System — исполнение генераций (`type_key`, очередь, воркер, провайдеры). | Там же; `platform/docker-re_doc/UGS-IDEMPOTENCY.md` |
| **MISO** | Провайдер в UGS (`miso_provider`); с ИМК RAG пересекается по правилам маршрутизации. | `product/marketing/IMC-MISO-ARCHITECTURE.md` |
| **EWRP** | EliteEW Revolutionary Presentations — генерация презентации (лендинг → контент → PDF) с рабочего стола; отдельный API `/api/v1/ewrp`, биллинг за слайд, без веб-поиска в UI. | `product/EWRP-REVOLUTIONARY-PRESENTATIONS.md` |
| **Assistant** | Desktop-спутник: chat gateway, music/image/vision, admin UI. Не маркетинговая AMKA. | `product/ewa/README.md` (music/image/vision/admin каноны рядом) |

## Аутентификация

| Термин | Смысл |
|--------|--------|
| **empery-web** | Публичный SPA-клиент Keycloak (браузер, PKCE). |
| **empery-mobile** | Публичный мобильный клиент Keycloak (native redirect, PKCE). |
| **empery-desktop** | Native Tauri desktop-client Keycloak client. |
| **empery-fofline** | FoFline edition Keycloak client (local SPA pack; XOR with remote desktop Start — see editions / FoFline canon). |
| **Trusted Substrate** | Sealed from-source kiosk OS carrier for bare metal (`pack-organization/trusted-substrate/`); hosts Electron bootstrap then Tauri payload; ≠ Fedora portal kiosk. SoT: `product/desktop/ELITEEW-TRUSTED-SUBSTRATE.md`. |
| **empery-api** | Confidential-клиент для introspection на бэкенде. |

Канон: **`platform/docker-re_doc/KEYCLOAK-ELITEEW.md`**, правила Cursor: **`keycloak-eliteew.mdc`**. Исторический Authentik pilot — только в `trash/` (не живой канон).

## Storage and topology

| Термин | Смысл |
|--------|--------|
| **PRODUCTION-TOPOLOGY-STATE** | Single page SoT: текущий prod (workers, edge, hosts). [PRODUCTION-TOPOLOGY-STATE.md](../platform/PRODUCTION-TOPOLOGY-STATE.md) |
| **ELITEEW-TECHNICAL-PASSPORT-STATE** | Living technical passport (arch / functional / integrations / security); paired canvas; **not** a substitute for topology §Current. [ELITEEW-TECHNICAL-PASSPORT-STATE.md](../platform/ELITEEW-TECHNICAL-PASSPORT-STATE.md) |
| **project_master_card** | Dense system blueprint (inventory). [project_master_card.md](../project_master_card.md) |
| **Editions / app platform** | cloud / onprem / client packs + Kernel vs Desktop apps. [ELITEEW-PRODUCT-EDITIONS-AND-APP-PLATFORM.md](../platform/ELITEEW-PRODUCT-EDITIONS-AND-APP-PLATFORM.md) |
| **SeaweedFS** | Канонический object store для unified content (env still `minio_*`). |
| **Qdrant-first** | Default vector backend; Chroma — legacy fallback only. |
| **Deploy SSH** | command-center → prod-core = **LAN** `192.168.1.111` only. Former 2.5G `10.255.136.0/24` retired (doc soft-retired → `trash/`). |
| **`AIRFLOW_*` env in stack0** | Legacy keys only; Airflow stack removed — notes in `trash/` (не канон). |

## Как поддерживать

Новые **устойчивые** термины, встречающиеся в нескольких доменах — строка в этой таблице + ссылка на доменный документ. Узкие определения оставлять в продуктовых файлах без дублирования длинных абзацев здесь. Soft-retired имена (DEWA/EWGen/…) оставлять только с пометкой retired → `trash/`, не как живые URL/scope.
