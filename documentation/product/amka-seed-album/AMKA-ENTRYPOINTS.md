# AMKA и EWA: входы и standalone readiness

Статус: рабочая карта входов после разделения брендов **AMKA** (маркетинговый кабинет) и **EWA** (платформа).

Этот лист — **сравнительная карта HTTP**. Семя маркетинговой AMKA — остальные файлы `amka-seed-album/`; живой канон EWA — **`product/ewa/`**.

## Разные контуры

Сводная таблица: **[AMKA-CONTOURS.md](AMKA-CONTOURS.md)**. Таксономия: **[EWA-VS-AMKA-TAXONOMY.md](../ewa/EWA-VS-AMKA-TAXONOMY.md)**.

Ниже — карта **HTTP** и компонентов.

## Где AMKA (маркетинговый кабинет)

**Marketing Cabinet → проект → вкладка AMKA.** Production UI и API: **`/api/v1/marketing-cabinet/amka/*`**, таблицы `marketing_amka_*`.

**Компонентный слой (только маркетинг):**

- backend: `shared/api/services/amka_core/`, `shared/api/services/marketing_cabinet/`, router `marketing_cabinet/amka.py`;
- frontend: `shared/web/frontend/src/features/amka/` (`AmkaView`, pulse, builder), мост `services/amka/marketingCabinetAmkaBridge.ts`;
- артефакты прогона: projection, `pulse`, `AmkaRunStore` / `marketing_amka_*` — **не** HTTP EWA desktop.

Отдельного сайта или отдельного бэкенда только для AMKA нет: исполнение marketing run — через API кабинета.

## Где EWA (платформа) — для сравнения, не часть marketing seed

Префикс **`/api/v1/ewa`** (регистрация в `register_domain_bi_ugs`):

- `GET /api/v1/ewa/driver-catalog` — JSON-каталог драйверов/профилей (`serialize_amka_driver_catalog()`), метаданные; OAuth2.
- `GET /api/v1/ewa/ugs/model-routing/core-alignment` — те же поля, что у marketing `core-alignment`; JWT UGS admin.
- `GET /api/v1/ewa/ugs/generation-inventory/core-alignment` — снимок `build_snapshot` из UGS Admin v2.
- `POST /api/v1/ewa/desktop-orchestration/turn` — envelope v1, payload.kind **`ewa_desktop_orchestration_v1`** → turn оркестратора; OAuth2; persistence при **`EWA_DATABASE_URL`** (`shared/api/ewa_platform/desktop/runtime.py` (former ewa_desktop.py router *[removed — see ewa_platform/desktop/runtime.py]* removed)). SPA: **`shared/web/frontend/src/services/ewa/ewaDesktopOrchApi.ts`**, хук **`useEwaDesktopOrchestrationTurn`**.
- `GET /api/v1/ewa/desktop-orchestration/sessions/{session_id}/events` — SSE журнал сессии.

- Стабильный `subject_ref` для **model_routing**: **`driver_key` = `ugs_admin`**, **`domain_profile` = `model_routing`**, **`subject_id` = `global`** (`ugs_amka_subject()`).
- Для **generation_inventory**: **`domain_profile` = `generation_inventory`**, тот же **`driver_key`**, **`subject_id` = `global`** (`ugs_generation_inventory_amka_subject()` в `shared/api/services/amka_core/ugs_amka_bridge.py`).

**Компонентный слой EWA:** `shared/api/ewa_platform/`; FE **`src/features/ewa/`** (`EwaDesktopApp`, `EwaDesktopView`, companion); HTTP **`src/services/ewa/`**. Окно **`EwaApp`** (`appComponent: 'EwaApp'`, payload `ewaDesktopSessionId`) — **не** маркетинговый прогон.

> Исторически часть платформенных пилотов носила имя AMKA. Канон: **EWA** = `/api/v1/ewa/*`; **AMKA** = маркетинговый кабинет.

## Текущие driver / profile

| Driver | Profile | Статус | Вход |
|--------|---------|--------|------|
| `marketing_cabinet` | `marketing` | production | Marketing Cabinet → AMKA |
| `ugs_admin` | `model_routing` | production read-only | `GET /api/v1/ewa/ugs/model-routing/core-alignment` |
| `ugs_admin` | `generation_inventory` | production read-only | `GET /api/v1/ewa/ugs/generation-inventory/core-alignment` |
| `reference_mock` | `mock` | tests | internal |
| `static_read_only` | `read_only_audit` | prototype | internal |

Кодовая карта: `shared/api/services/amka_core/driver_catalog.py`; сериализация каталога — `serialize_amka_driver_catalog()`.

## Когда появится отдельный вход

Условия из прежней версии документа сохраняются по смыслу; платформенный контур теперь явно именуется **EWA** (`/api/v1/ewa`). Полный gate для marketing execution без кабинета — по-прежнему roadmap **маркетинговой AMKA**.
