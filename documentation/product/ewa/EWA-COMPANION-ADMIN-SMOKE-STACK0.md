# Assistant Admin — operator smoke stack0 (этап 4)

**Статус:** Канон  
**Обновлено:** 2026-05-24  
**Этап программы:** 4 из 5 (документ этапа 4; **программа админки 5/5 завершена** — см. [EWA-COMPANION-ADMIN-UI.md](EWA-COMPANION-ADMIN-UI.md))  
**Источник чеклиста:** `documentation/plans/product/ewa/EWA-COMPANION-WORKFLOW-TOOLS-STANDARD-MASTER-PLAN.md` *[operator-local process plan; gitignored — not living canon]* §12

Полный операторский прогон **music_full_cycle_v1** + **админка EWA** на stack0: автоматизируемый слой (скрипт + pytest) и ручной слой (desktop UI, SSE, Confirm).

> Операторский runtime по умолчанию: **Podman**.

**Связано:** [EWA-COMPANION-ADMIN-UI.md](EWA-COMPANION-ADMIN-UI.md), [EWA-COMPANION-OPERATIONS-PANEL.md](EWA-COMPANION-OPERATIONS-PANEL.md), [EWA-COMPANION-ADMIN-WORKFLOW-EDITOR.md](EWA-COMPANION-ADMIN-WORKFLOW-EDITOR.md), [EWA-PLATFORM-SETTINGS-DB.md](EWA-PLATFORM-SETTINGS-DB.md).

---

## 1. Scope §12 (маппинг)

| # | Master-plan §12 | Слой | Где в этом документе |
|---|-----------------|------|----------------------|
| 1 | WF engine + music + async ON | Auto + Settings | §2, §4 step 1 |
| 2 | Desktop trigger phrase | Manual | §4 step 2 |
| 3 | Operations panel ≥3 steps, SSE | Manual | §4 step 3 |
| 4 | Confirm gate → Play | Manual | §4 step 4 |
| 5 | Admin Tools: `music_generation` router | Auto + Manual | §4 step 5 |
| 6 | Admin validate JSON → 200 | Manual (UI) / Auto (pytest admin) | §4 step 6 |
| 7 | Disable workflow → atomic path | Manual + pytest trigger-off | §4 step 7 |

---

## 2. Prerequisites (stack0)

### 2.1 Контейнеры

| Сервис | Контейнер (default) | Проверка |
|--------|---------------------|----------|
| API | `stack0-eliteew-api-prod-baked` (prod-core) | `ssh 192.168.1.111 'curl -sf http://127.0.0.1:29000/api/health'` |
| Companion Celery | `stack0-eliteew-celery-companion-worker-prod-baked` на **prod-core** | `podman ps` на `.111` — queue `ewa_companion` (не gpu141) |
| EWA Postgres | `stack-ewa-postgres` на **prod-core** | settings rows readable |

### 2.2 EWA_* flags (БД, вкладка «Настройки»)

| Key | Значение для smoke | Влияет на |
|-----|-------------------|-----------|
| `EWA_COMPANION_WF_ENGINE_ENABLED` | `1` | action workflow engine |
| `EWA_COMPANION_WF_MUSIC_FULL_V1` | `1` | `music_full_cycle_v1` env gate |
| `EWA_COMPANION_ASYNC_JOBS_ENABLED` | `1` | Celery async tools |
| `EWA_COMPANION_ADMIN_ENABLED` | `1` | admin catalog read |
| `EWA_COMPANION_PLAN_ENABLED` | `1` | companion active plan rail / `plan_v1` |
| `EWA_COMPANION_ADMIN_WRITE` | `1` | workflow Save/Enable (optional для step 7 PG disable) |
| `EWA_COMPANION_WF_PG_CATALOG` | `1` | PG catalog + admin write |

**Image generation (migration 014):** после `apply_ewa_migrations.sh` / `ewa-platform-migrations-verify.sh` в PG должны быть `EWA_COMPANION_IMAGE_GENERATION_ENABLED`, `EWA_COMPANION_IMAGE_GENERATION_TYPE_KEY`, `EWA_COMPANION_IMAGE_GENERATION_WORKFLOW_SLUG`. Settings API: `schema_version: ewa_platform_settings_v3`, `catalog_total=281`. См. [EWA-COMPANION-IMAGE-GENERATION.md](EWA-COMPANION-IMAGE-GENERATION.md).

Дополнительно для music tool (если generation падает):

- `EWA_COMPANION_BACKEND_MUSIC_GENERATION=1` и связанные stack2 LLM — см. [EWA-COMPANION-STACK2-OPERATOR.md](EWA-COMPANION-STACK2-OPERATOR.md).

### 2.3 Автоматический прогон

Из корня монорепо:

```bash
chmod +x docker/scripts/ewa-companion-admin-smoke.sh
./docker/scripts/ewa-companion-admin-smoke.sh
```

Скрипт:

1. Health API + Postgres settings (§2.2).
2. Optional runtime plan API smoke when `EWA_SMOKE_BEARER_TOKEN` is set: `plan_v1` must not fall back to the `EWA_COMPANION_PLAN_ENABLED` blocker.
3. Pytest bundle: tool catalog contract, workflow triggers, admin API, settings API.

`--skip-pytest` — только infra + DB flags (+ optional runtime plan API smoke if `EWA_SMOKE_BEARER_TOKEN` is present).

**Prod baseline:** companion async jobs идут на **prod-core** companion Celery worker. gpu141 — только embed/rerank/tool-router. Если companion worker down, скрипт WARN, не FAIL.

---

## 3. Manual checklist (desktop + admin UI)

Выполнять под **admin** на `app.eliteew.ru`. Фиксируйте PASS/FAIL в §5.

### Step 1 — Flags (дублирует auto)

- [ ] **PASS** / **FAIL** — §2.2 keys = `1` в Settings (или auto script OK).

### Step 2 — Trigger full cycle

1. Открыть **Assistant** на рабочем столе.
2. Отправить фразу, matching regex `music_full_cycle_v1`:

   **«Сгенерируй песню про закат и включи когда будет готово»**

   (обязательны «сгенерируй» + «и включи» — см. `workflows/action/registry.py`).

- [ ] **PASS** / **FAIL** — в чате/operations появился **action workflow** run (не plain LLM-only ответ).

### Step 3 — Operations + SSE

1. Открыть **панель операций** (companion operations).
2. DevTools → Network → companion chat stream: события `task_step` (или polling fallback).

- [ ] **PASS** / **FAIL** — ≥ **3** шага или ≥2 step transitions + confirm gate; SSE/poll видит прогресс.

### Step 4 — Confirm gate

1. Дождаться шага **confirm_play** / «Подтверждение воспроизведения».
2. Нажать **Confirm** в UI (не только «да» в чате).

- [ ] **PASS** / **FAIL** — run завершился; play step выполнен (трек / `music_play_track`).

### Step 5 — Admin Tools

1. Админка → **EWA — спутник** → **Tools**.
2. Найти `music_generation`.

- [ ] **PASS** / **FAIL** — `router_exposed` = **да**; описание и capability «Музыка» видны.

### Step 6 — Admin validate

1. **Action workflows** → `music_full_cycle_v1`.
2. **Validate** (без изменения JSON) → зелёный бар, errors пусто.

- [ ] **PASS** / **FAIL** — validation OK (эквивалент HTTP 200 на `POST …/workflows/validate`).

### Step 7 — Disable → fall-through

**Вариант A (рекомендуется для smoke):** Settings → `EWA_COMPANION_WF_MUSIC_FULL_V1` = `0` → Save → **Обновить** admin.

1. Повторить фразу из step 2.

- [ ] **PASS** / **FAIL** — **нет** multi-step workflow; срабатывает atomic path (tool router / обычный music intent), не `action_workflow` run с confirm gate.

**Вариант B:** Action workflows → **Disable** (если PG catalog enabled и version сохранена).

**Rollback:** вернуть `EWA_COMPANION_WF_MUSIC_FULL_V1=1`, Refresh.

---

## 4. Pytest (contract layer C для §12)

Скрипт §2.3 запускает:

| Test file | Покрывает §12 |
|-----------|--------------|
| `test_companion_tool_catalog_contract.py` | step 5 — registry ↔ router |
| `test_ewa_companion_action_workflow_triggers.py` | steps 2/7 — regex match / env off |
| `test_ewa_companion_admin_api.py` | steps 5–6 — tools + workflows list |
| `test_ewa_companion_admin_settings_api.py` | settings + audit API |
| `test_ewa_companion_admin_smoke_stack0.py` | §12 steps 2/5/7 — phrase match, catalog, env gate off |
| `test_ewa_companion_workflow_run_capacity.py` | WF-4 — capacity gate, busy reply, step retry |

Ручной запуск:

```bash
podman exec stack0-eliteew-api-prod sh -lc \
  'cd /app/api && PYTHONPATH=. .venv/bin/python -m pytest -q \
  tests/test_companion_tool_catalog_contract.py \
  tests/test_ewa_companion_action_workflow_triggers.py \
  tests/test_ewa_companion_admin_api.py \
  tests/test_ewa_companion_admin_settings_api.py \
  tests/test_ewa_companion_admin_smoke_stack0.py \
  tests/test_ewa_companion_workflow_run_capacity.py'
```

---

## 5. PASS log (оператор)

Сохраните копию после прогона:

```text
Date (UTC/local):
Operator:
Host: stack0 / app.eliteew.ru
Automated script: PASS / FAIL (output attached)
Step 1–7 manual: PASS / FAIL per step
Notes:
Rollback applied: yes / no
```

Файл-worklog (опционально): git log (worklog retired)

---

## 6. Troubleshooting

| Симптом | Проверить |
|---------|-----------|
| Workflow не стартует | `EWA_COMPANION_WF_*`, фраза с «и включи», engine=1 |
| Steps не двигаются | Celery worker (.141?), `EWA_COMPANION_ASYNC_JOBS_ENABLED`, logs `[STEP] companion_run_task` |
| Admin Tools пуст | `EWA_COMPANION_ADMIN_ENABLED=1`, Refresh |
| Validate red | JSON workflow vs tools registry; missing handler |
| Step 7 still workflow | flag не сброшен / cache — Refresh admin + restart API |

Logs:

```bash
podman logs --tail 200 stack0-eliteew-api-prod 2>&1 | rg 'STEP|workflow|companion_run'
podman logs --tail 200 stack0-eliteew-celery-worker-prod 2>&1 | rg 'STEP|workflow'
```

---

## 7. Roadmap admin program

| # | Этап | Статус |
|---|------|--------|
| 1 | Write gating | Done |
| 2 | Workflow editor | Done |
| 3 | Settings audit + env_gate | Done |
| 4 | Operator smoke §12 | **Done** (этот документ + script) |
| 5 | WF-4 backend + extended Vitest | **Done** — [EWA-COMPANION-ADMIN-WF4-CAPACITY-RETRY.md](EWA-COMPANION-ADMIN-WF4-CAPACITY-RETRY.md) |

---

## Связанные документы

- `documentation/plans/product/ewa/EWA-COMPANION-WORKFLOW-TOOLS-STANDARD-MASTER-PLAN.md` *[operator-local process plan; gitignored — not living canon]* §12–14
- `documentation/plans/product/ewa/EWA-COMPANION-BACKGROUND-ORCHESTRATION-MASTER-PLAN.md` *[operator-local process plan; gitignored — not living canon]* §11
- [EWA-COMPANION-OPERATIONS-PANEL.md](EWA-COMPANION-OPERATIONS-PANEL.md)
