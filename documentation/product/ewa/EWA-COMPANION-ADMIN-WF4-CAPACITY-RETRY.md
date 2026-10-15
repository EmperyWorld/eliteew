# Assistant Admin — WF-4 capacity/retry (этап 5)

**Статус:** Канон  
**Обновлено:** 2026-07-04  
**Этап программы:** 5 из 5 — **программа админки завершена**

**Связано:** `documentation/plans/product/ewa/EWA-COMPANION-WORKFLOW-TOOLS-STANDARD-MASTER-PLAN.md` *[operator-local process plan; gitignored — not living canon]* §9 WF-4, [EWA-COMPANION-ADMIN-UI.md](EWA-COMPANION-ADMIN-UI.md), [EWA-COMPANION-ADMIN-SMOKE-STACK0.md](EWA-COMPANION-ADMIN-SMOKE-STACK0.md).

---

## 1. Цель этапа 5

Закрыть **WF-4** (step retry + capability queue) в связке с **админкой**: оператор видит лимиты tools, JSON workflow может содержать `retry`, Vitest покрывает pure-логику admin UI.

Backend WF-4 реализован ранее (2026-05-22, см. worklog `2026-05-22-1817-ewa-wf4-music-advance-fix-deploy`); этап 5 фиксирует контракт, тесты и operator-facing док.

---

## 2. WF-4 backend (источник правды)

| ID | Поведение | Код |
|----|-----------|-----|
| WF-4.1 | `max_concurrent_per_principal` перед enqueue async music | `jobs/run_capacity.py`, `companion_asyncpg.companion_task_count_active_music_runs` |
| WF-4.2 | Step-level retry по полю `steps[].retry` | `schemas/pydantic/companion_workflow.py` (`CompanionWorkflowStepRetryV1`), `jobs/step_retry.py`, hook в `jobs/executor.py` |
| WF-4.3 | Busy-reply пользователю при переполнении | `music_busy_reply()` — в `workflows/action/starter.py` и `orchestration/tool_registry.py` |

### 2.1 Music capacity (WF-4.1 / 4.3)

- Лимит берётся из **`ToolDescriptorV2.max_concurrent_per_principal`** для `music_generation` (default **1**).
- Активные run считаются в Postgres (durable statuses); второй запрос **не** ставит Celery job.
- Ответ в чате (RU): «Сейчас уже идёт генерация музыки…».

### 2.2 Step retry (WF-4.2)

Пример в builtin `music_full_cycle_v1` (`workflows/action/registry.py`):

```json
"retry": {
  "max_attempts": 2,
  "backoff_ms": 5000,
  "retry_on": ["timeout", "503", "broker_down", "generate"]
}
```

При transient failure executor вызывает `maybe_retry_failed_step` → re-enqueue Celery с countdown.

### 2.3 Celery task retry idempotency (A-03)

`companion_run_task` (`max_retries=3`) может повторно вызвать `execute_companion_run` после необработанного исключения worker. Без step-level guard повтор мог снова вызвать handler уже **completed** шага (дубли UGS/API).

| Слой | Поведение | Код |
|------|-----------|-----|
| Short-circuit | `completed` / `skipped` / `awaiting_confirmation` → skip dispatch | `jobs/step_idempotency.py` |
| In-flight | `in_progress` без output и свежий `updated_at` (< `EWA_COMPANION_STEP_IN_PROGRESS_FRESH_SEC`, default 120s) → skip (другой worker держит шаг) | то же |
| Audit | Skip → `[TASK_SKIP] run_id=… step_index=… reason=…` | `log_task_step_skip` в `step_idempotency.py`, hook в `executor.py` |
| Stale retry | `in_progress` без output и устаревший timestamp → повторный dispatch | то же |
| Target pick | `step_index=None` → первый non-terminal шаг, не всегда `step_index=1` | `resolve_target_step` в `step_idempotency.py`, hook в `executor.py` |

Тесты:

- `shared/api/tests/test_companion_task_retry_idempotency.py` — A-03 regression lock
- `shared/api/tests/test_celery_task_retry_idempotency_risk.py` — R-02 Phase 0 evidence (without-guard double execution + fix proof)

```bash
bash docker/scripts/run-worker-tests.sh -k task_retry_idempotency -q
```

### 2.4 Companion gate load stall (R-03)

| Слой | Поведение | Код |
|------|-----------|-----|
| Stall window | 12s (`EWA_COMPANION_LOAD_STALL_MS`, desktop-aligned) | `ewaCompanionLoadStall.ts` |
| Profile gate | Hung `GET …/companion-profile` → `load_timeout` + retry CTA | `EwaDesktopApp.tsx` |
| Observation prefs | Hung load → error panel + retry | `CompanionWorkflowObservationSettings.tsx` |

```bash
cd shared/web/frontend && pnpm exec vitest run src/features/ewa/__tests__/companion_loading_resilience
```

---

## 3. Админка — что видит оператор

| Вкладка | WF-4 |
|---------|------|
| **Tools** | Колонка **Max concurrent / principal** (`max_concurrent_per_principal`); для `music_generation` ожидается **1**. |
| **Action workflows** | В Monaco JSON шага `generate` у `music_full_cycle_v1` — блок `retry` (read-only при write off). |
| **Validate** | Pydantic принимает optional `retry` на tool steps. |

Settings **не** gate'ят write для bootstrap — без изменений (этап 1).

---

## 4. Тесты

### 4.1 Backend (pytest)

| Файл | Покрытие |
|------|----------|
| `tests/test_ewa_companion_workflow_run_capacity.py` | capacity gate, busy reply, step retry match/skip |
| `tests/test_ewa_companion_workflow_executor.py` | executor + advance (см. WF-1…3) |

Включены в `docker/scripts/ewa-companion-admin-smoke.sh` (bundle WF-4 + admin).

### 4.2 Frontend (Vitest)

Каталог: `shared/web/frontend/src/features/ewa/admin/__tests__/`

| Файл | Модуль |
|------|--------|
| `ewaCompanionAdminWriteGate.test.ts` | `isEwaCompanionWorkflowWriteEnabled` |
| `ewaCompanionWorkflowEditorState.test.ts` | validate-before-save fingerprint |
| `ewaCompanionWorkflowTemplate.test.ts` | blank template §8.3 |
| `ewaCompanionAdminSettingsNav.test.ts` | env_gate → Settings helpers |
| `ewaCompanionAdminMeta.test.ts` | category/capability i18n keys |

Команда:

```bash
cd shared/web/frontend
pnpm exec vitest run src/features/ewa/admin/__tests__
```

---

## 5. Operator smoke (WF-4)

Дополнение к [EWA-COMPANION-ADMIN-SMOKE-STACK0.md](EWA-COMPANION-ADMIN-SMOKE-STACK0.md):

1. **Tools** → `music_generation` → **Max concurrent** = 1.
2. Desktop: запустить music full cycle → **повторить фразу**, пока run active → ответ «уже идёт генерация», без второго run.
3. (Опционально) симулировать 503 на generate → в Task runs виден retry attempt (если Celery доступен).

---

## 6. Roadmap admin program (финал)

| # | Этап | Статус |
|---|------|--------|
| 1 | Write gating | Done |
| 2 | Workflow editor | Done |
| 3 | Settings audit + env_gate | Done |
| 4 | Operator smoke §12 | Done |
| 5 | WF-4 + Vitest admin | **Done** (этот документ) |

---

## Связанные документы

- [EWA-COMPANION-ADMIN-WRITE-GATING.md](EWA-COMPANION-ADMIN-WRITE-GATING.md)
- [EWA-COMPANION-ADMIN-WORKFLOW-EDITOR.md](EWA-COMPANION-ADMIN-WORKFLOW-EDITOR.md)
- [EWA-COMPANION-ADMIN-SETTINGS-NAVIGATION.md](EWA-COMPANION-ADMIN-SETTINGS-NAVIGATION.md)
- [EWA-COMPANION-ADMIN-SMOKE-STACK0.md](EWA-COMPANION-ADMIN-SMOKE-STACK0.md)
