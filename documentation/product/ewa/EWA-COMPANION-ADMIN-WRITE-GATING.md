# Assistant Admin — write gating (этап 1)

**Статус:** Канон  
**Обновлено:** 2026-05-22  
**Этап программы:** 1 из 5 (см. [EWA-COMPANION-ADMIN-UI.md](EWA-COMPANION-ADMIN-UI.md) roadmap)

Операторская модель **кто что может менять** в админке Assistant: разделение read/write для action workflows, bootstrap-исключение для platform settings, поведение UI при выключенных флагах.

**Связано:** [EWA-PLATFORM-SETTINGS-DB.md](EWA-PLATFORM-SETTINGS-DB.md), `documentation/plans/product/ewa/EWA-COMPANION-WORKFLOW-TOOLS-STANDARD-MASTER-PLAN.md` *[operator-local process plan; gitignored — not living canon]* §7.4, [EWA-COMPANION-ADMIN-UI.md](EWA-COMPANION-ADMIN-UI.md).

---

## 1. Два контура записи

| Контур | API routes | UI вкладка | Gate на бэке | Gate во фронте |
|--------|------------|------------|--------------|----------------|
| **Platform settings** (`EWA_*`) | `PUT /settings/{key}` | Настройки | JWT admin only | Редактирование **всегда** для admin (bootstrap) |
| **Action workflows** (PG catalog) | `POST/PUT …/workflows*` | Action workflows | `EWA_COMPANION_ADMIN_WRITE=1` **и** `EWA_COMPANION_WF_PG_CATALOG=1` | Save / Enable / Disable + Monaco read-only без обоих флагов |

**Validate** (`POST /workflows/validate`) — dry-run, **не** требует write gate: оператор может проверить JSON в read-only режиме.

**Read** (`GET /tools`, `GET /workflows`, …) — требует `EWA_COMPANION_ADMIN_ENABLED=1`, кроме **Settings list** (специально без этого флага для bootstrap).

---

## 2. Источник флагов

`GET /api/v1/ewa/admin/companion/status` возвращает:

| Поле | DB key | Смысл |
|------|--------|-------|
| `admin_enabled` | `EWA_COMPANION_ADMIN_ENABLED` | Каталог tools/workflows доступен |
| `admin_write_enabled` | `EWA_COMPANION_ADMIN_WRITE` | Mutating workflow routes |
| `pg_catalog_enabled` | `EWA_COMPANION_WF_PG_CATALOG` | PG catalog для workflow versions |

Workflow write во фронте:

```typescript
workflowWriteEnabled = admin_write_enabled && pg_catalog_enabled
```

Реализация: `shared/web/frontend/src/features/ewa/admin/ewaCompanionAdminWriteGate.ts` → `isEwaCompanionWorkflowWriteEnabled()`.

---

## 3. Поведение UI (этап 1)

### 3.1 Жёлтый баннер (верх панели)

Показывается при `!admin_enabled` или `!admin_write_enabled || !pg_catalog_enabled`. Кнопка **«Открыть настройки»** ведёт на вкладку Настройки.

### 3.2 Action workflows

| Элемент | `workflowWriteEnabled = true` | `workflowWriteEnabled = false` |
|---------|------------------------------|--------------------------------|
| Monaco JSON | редактируемый | **read-only** (`editable={false}`) |
| Validate | активна | активна |
| Save version | активна | **disabled** + приглушённый стиль |
| Enable / Disable | активны | **disabled** |
| Inline banner | — | `workflowReadOnlyHint` (RU/EN i18n) |

### 3.3 Настройки (bootstrap)

- Поля **всегда редактируемы** при роли admin (вся админка уже за admin JWT).
- Под intro — `settingsWriteBootstrapNote`: можно включить `EWA_COMPANION_ADMIN_WRITE` / `EWA_COMPANION_WF_PG_CATALOG` **до** того, как workflow write заработает.
- **Не** привязывать Settings к `admin_write_enabled` — иначе deadlock «нельзя включить флаг, которым включается запись».

### 3.4 Tools / Chat workflows / Task runs

Read-only вкладки; write gating не менялся на этапе 1.

---

## 4. Код (frontend)

| Файл | Роль |
|------|------|
| `ewaCompanionAdminWriteGate.ts` | `isEwaCompanionWorkflowWriteEnabled()` |
| `EwaCompanionAdminPanel.tsx` | status query → `workflowWriteEnabled` → `ActionWorkflowsPanel` |
| `CompanionWorkflowMonacoTab.tsx` | prop `editable` → Monaco `readOnly` |
| `EwaCompanionSettingsTab.tsx` | bootstrap note; invariants в заголовке |
| `desktopUi.json` (`ewaCompanionAdmin`) | `workflowReadOnlyHint`, `settingsWriteBootstrapNote` |

---

## 5. Код (backend) — без изменений на этапе 1

| Route | Write check |
|-------|-------------|
| `PUT /settings/{key}` | admin JWT only |
| `POST /workflows`, `PUT …/enable`, `PUT …/disable` | `_require_companion_admin_write()` + PG catalog flag |
| `POST /workflows/validate` | admin feature only |

Файл: `shared/api/ewa_platform/gateways/routers/companion_admin.py`.

HTTP detail при write off: `ewa_companion_admin_write_disabled` или `ewa_companion_wf_pg_catalog_disabled` (503).

---

## 6. Operator smoke (этап 1)

1. В **Настройки** выставить `EWA_COMPANION_ADMIN_WRITE = 0`, `EWA_COMPANION_WF_PG_CATALOG = 0`, сохранить.
2. **Обновить** панель → жёлтый баннер; Action workflows → Monaco read-only, Save/Enable/Disable disabled, Validate работает.
3. На **Настройки** включить оба флага = 1, сохранить, **Обновить**.
4. Action workflows → Monaco редактируемый, Save/Enable/Disable активны.

---

## 7. Roadmap (программа завершена)

| # | Этап | Статус |
|---|------|--------|
| 1 | Write gating UI | **Done** — [EWA-COMPANION-ADMIN-WRITE-GATING.md](EWA-COMPANION-ADMIN-WRITE-GATING.md) |
| 2 | New workflow + validate-before-save | **Done** — [EWA-COMPANION-ADMIN-WORKFLOW-EDITOR.md](EWA-COMPANION-ADMIN-WORKFLOW-EDITOR.md) |
| 3 | Settings audit UI + env_gate → Settings links | **Done** — [EWA-COMPANION-ADMIN-SETTINGS-NAVIGATION.md](EWA-COMPANION-ADMIN-SETTINGS-NAVIGATION.md) |
| 4 | Operator smoke §12 master-plan | **Done** — [EWA-COMPANION-ADMIN-SMOKE-STACK0.md](EWA-COMPANION-ADMIN-SMOKE-STACK0.md) |
| 5 | WF-4 backend + Vitest admin | **Done** — [EWA-COMPANION-ADMIN-WF4-CAPACITY-RETRY.md](EWA-COMPANION-ADMIN-WF4-CAPACITY-RETRY.md) |

---

## Связанные документы

- [EWA-COMPANION-ADMIN-UI.md](EWA-COMPANION-ADMIN-UI.md) — обзор вкладок и API
- [EWA-PLATFORM-SETTINGS-DB.md](EWA-PLATFORM-SETTINGS-DB.md) — Postgres settings
- `documentation/plans/product/ewa/EWA-COMPANION-WORKFLOW-TOOLS-STANDARD-MASTER-PLAN.md` *[operator-local process plan; gitignored — not living canon]* §7.4 — operator safety
