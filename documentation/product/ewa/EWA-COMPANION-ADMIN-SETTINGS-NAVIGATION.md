# Assistant Admin — settings audit и env_gate navigation (этап 3)

**Статус:** Канон  
**Обновлено:** 2026-05-22  
**Этап программы:** 3 из 5 (программа админки **5/5 завершена** — [EWA-COMPANION-ADMIN-UI.md](EWA-COMPANION-ADMIN-UI.md))

Связка **Action workflows ↔ Platform settings**: клик по `env_gate` открывает нужный `EWA_*` на вкладке «Настройки»; таблица **audit** показывает историю изменений параметров в Postgres.

**Связано:** [EWA-PLATFORM-SETTINGS-DB.md](EWA-PLATFORM-SETTINGS-DB.md), [EWA-COMPANION-ADMIN-UI.md](EWA-COMPANION-ADMIN-UI.md), [EWA-COMPANION-ADMIN-WORKFLOW-EDITOR.md](EWA-COMPANION-ADMIN-WORKFLOW-EDITOR.md).

---

## 1. Цели этапа 3

| Цель | Реализация |
|------|------------|
| Оператор видит **кто и когда** менял `EWA_*` | UI «История изменений» + `GET /settings/audit` |
| Из workflow понятно, **какой флаг** включить | Кликабельный `env_gate` → вкладка Настройки + focus + scroll |
| Секреты не светятся в audit UI | Mask `old_value` / `new_value` для `is_secret` keys |

---

## 2. API: settings audit

**Путь:** `GET /api/v1/ewa/admin/companion/settings/audit`

| Query | Описание |
|-------|----------|
| `setting_key` | optional — фильтр по одному ключу |
| `limit` | default 50, max 200 |

**Auth:** admin JWT (как `GET /settings`). **Не** требует `EWA_COMPANION_ADMIN_ENABLED` (bootstrap parity).

**Response:** `ewa_platform_setting_audit_v1`

```json
{
  "entries": [
    {
      "id": 1,
      "setting_key": "EWA_COMPANION_ADMIN_WRITE",
      "old_value": "0",
      "new_value": "1",
      "actor_sub": "operator",
      "created_at": "2026-05-22T12:00:00+00:00",
      "value_masked": false
    }
  ],
  "schema_version": "ewa_platform_setting_audit_v1"
}
```

**Backend:**

| Слой | Файл |
|------|------|
| SQL | `ewa_platform_setting_audit` (migration 013) |
| AsyncPG | `list_ewa_platform_setting_audit()` in `platform_settings_asyncpg.py` |
| Router | `companion_admin.py` → `list_companion_platform_settings_audit` |
| Pydantic | `CompanionPlatformSettingAuditEntryOut`, `CompanionPlatformSettingAuditListOut` |

Audit пишется при каждом `PUT /settings/{key}` (транзакция update + insert audit).

---

## 3. UI: вкладка «Настройки»

### 3.1 История изменений

Компонент: `EwaCompanionSettingsAuditPanel.tsx`

- Блок внизу вкладки «Настройки».
- По умолчанию — последние 50 записей **по всем ключам**.
- Если в **поиске** точное совпадение с `setting_key` — audit фильтруется на этот ключ.
- Колонки: время, ключ, было → стало, actor; секреты → `•••• (секрет)`.
- После Save параметра — invalidate query `settings-audit`.

### 3.2 Focus из других вкладок

Props `EwaCompanionSettingsTab`:

| Prop | Назначение |
|------|------------|
| `focusSettingKey` | ключ для подсветки (из AdminPanel state) |
| `onFocusSettingKeyConsumed` | сброс state после apply |

При focus:

1. Поиск = ключ.
2. Категория = категория параметра (если найден в списке).
3. Подсветка строки (`ring` + scroll into view).
4. Audit фильтруется на ключ.

---

## 4. UI: env_gate → Settings

Компонент: `EwaCompanionEnvGateLink.tsx`

- Если `env_gate` matches `^EWA_[A-Z0-9_]+$` — **кнопка** с tooltip «Открыть параметр…».
- Иначе — plain text (legacy / non-catalog gate).

**Где показывается:**

- Список Action workflows (под каждым workflow).
- Редактор workflow — `env_gate` из текущего JSON Monaco.

**Навигация:** `EwaCompanionAdminPanel.openPlatformSetting(key)` → `tab = settings`, `settingsFocusKey = key`.

Helpers: `ewaCompanionAdminSettingsNav.ts` (`isEwaPlatformSettingKey`, `findPlatformSettingCategory`).

---

## 5. Файлы

### Backend

- `shared/api/ewa_platform/persistence_pg/platform_settings_asyncpg.py`
- `shared/api/ewa_platform/gateways/routers/companion_admin.py`
- `shared/api/ewa_platform/schemas/pydantic/companion_admin.py`
- `shared/api/tests/test_ewa_companion_admin_settings_api.py` (+ `test_companion_admin_settings_audit_list`)

### Frontend

- `EwaCompanionSettingsAuditPanel.tsx`
- `EwaCompanionEnvGateLink.tsx`
- `ewaCompanionAdminSettingsNav.ts`
- `EwaCompanionSettingsTab.tsx` (audit + focus)
- `EwaCompanionActionWorkflowsTab.tsx` (env_gate links)
- `EwaCompanionAdminPanel.tsx` (cross-tab state)
- `ewaCompanionAdminApi.ts` (`fetchEwaCompanionPlatformSettingsAudit`)
- Vitest: `__tests__/ewaCompanionAdminSettingsNav.test.ts`

---

## 6. Operator smoke (этап 3)

1. **Настройки** → изменить любой `EWA_*` → в «История изменений» появилась строка с actor.
2. Поиск `EWA_COMPANION_ADMIN_WRITE` → audit только по этому ключу.
3. **Action workflows** → клик `env_gate: EWA_COMPANION_WF_*` → переход на **Настройки**, строка подсвечена, audit отфильтрован.
4. Secret key: audit показывает masked, не plain text.

---

## 7. Roadmap

| # | Этап | Статус |
|---|------|--------|
| 1 | Write gating | Done |
| 2 | New workflow + validate-before-save | Done |
| 3 | Settings audit + env_gate links | **Done** (этот документ) |
| 4 | Operator smoke §12 master-plan | **Done** — [EWA-COMPANION-ADMIN-SMOKE-STACK0.md](EWA-COMPANION-ADMIN-SMOKE-STACK0.md) |
| 5 | WF-4 backend + расширенные Vitest admin | **Done** — [EWA-COMPANION-ADMIN-WF4-CAPACITY-RETRY.md](EWA-COMPANION-ADMIN-WF4-CAPACITY-RETRY.md) |

---

## Связанные документы

- [EWA-COMPANION-ADMIN-UI.md](EWA-COMPANION-ADMIN-UI.md)
- [EWA-COMPANION-ADMIN-WRITE-GATING.md](EWA-COMPANION-ADMIN-WRITE-GATING.md)
- [EWA-COMPANION-ADMIN-WORKFLOW-EDITOR.md](EWA-COMPANION-ADMIN-WORKFLOW-EDITOR.md)
- [EWA-PLATFORM-SETTINGS-DB.md](EWA-PLATFORM-SETTINGS-DB.md)
