# Admin Factory Ops (Gen/Forge)

**Status:** Living — Wave F5–F7 + G3 (Gate S, kill-all, extract-apply gate) (2026-08-05)
**Parent:** [ELITEEW-GENEW-FACTORY-HARVEST.md](../ELITEEW-GENEW-FACTORY-HARVEST.md)

## Purpose

Unified Admin section **Factory** controls Gen/Forge **intentions** (plan → verify; optional implement). Adjacent to Platform Ops — not a Desktop Start app.

## URLs

| Surface | Path |
|---------|------|
| API | `/api/v1/desktop/admin/factory/*` |
| Admin SPA | `?section=factory` |

### Endpoints

| Method | Path | Role |
|--------|------|------|
| GET | `/status` | Flags: enabled, autonomous, async_jobs, assembly, **max_fix_loops**, celery_queue |
| POST | `/assembly/evaluate` | Gate **T∧C∧S** evaluate — **403** unless `ELITEEW_FACTORY_ASSEMBLY=1`; body may include `intent` |
| GET | `/intentions` | List (empty OK) |
| POST | `/intentions` | Enqueue (`title`, `pack_stems`, `run_ticks`) — async schedules Celery |
| POST | `/intentions/kill-all` | **Wave G3 kill switch** — `mode=cancel\|pause` all non-terminal |
| GET | `/intentions/{id}` | Detail |
| POST | `/intentions/{id}/tick` | Sync tick **or** Celery schedule when async on |
| POST | `/intentions/{id}/pause` | Pause |
| POST | `/intentions/{id}/resume` | Resume |
| POST | `/intentions/{id}/cancel` | Cancel |

Auth: `require_admin_user`. When `ELITEEW_FACTORY_ENABLED=0` → **503**.

## Feature flags

| Env | Default | Meaning |
|-----|---------|---------|
| `ELITEEW_FACTORY_ENABLED` | `1` / true | Master switch for API/UI |
| `ELITEEW_FACTORY_AUTONOMOUS` | `0` / false | When off: plan→verify→done **skips implement writes**. Enable only with kill-all + max_fix_loops + SOPS |
| `ELITEEW_FACTORY_ASYNC_JOBS` | `0` / false | When on: ticks on Celery queue `ewa_factory` |
| `ELITEEW_FACTORY_ASSEMBLY` | `0` / false | Gate T∧C∧S; Admin shows ON/OFF (**default OFF**) |
| Gate T assets | `ewa_platform/factory/gate_t_assets/` | Image-shipped mirror of scaffold `TEMPLATE_FREEZE` (baked has no `.cursor/`) |
| `ELITEEW_FACTORY_MAX_FIX_LOOPS` | `3` | verify fail → fix loops (surfaced on `/status`) |
| `ELITEEW_FACTORY_STORE_PATH` | intentions.json *[runtime under host/runtime/factory/]* | Optional JSON durability |
| `ELITEEW_FACTORY_ATOMS_PATH` | atoms.json *[runtime under host/runtime/factory/]* | Optional factory atom durability (Wave F6) |
| `ELITEEW_FACTORY_EXTRACT_APPLY` | unset / `0` | Host CLI: required `=1` for `extract-adapt-map.py --apply` |

## Assembly law (Gate T ∧ C ∧ S)

| Gate | Role |
|------|------|
| **T** | Template freeze (packaged Gate T assets) |
| **C** | Pack golden / assembly-active stems |
| **S** | Semantic advisory heuristic (pack stems + optional `intent`); **cannot rescue** T/C fail |
| Verdict | `apply(T,C,S)` — if T∧C pass and S **FAILED** → overall **FAILED** (genEW parity). `tc_passed` reports T∧C only |

Assembler / Babel `assemble.mjs` pilot — **deferred** (requires explicit Approval; not shipped in G3).

## Celery

| Item | Value |
|------|-------|
| Queue | `ewa_factory` |
| Task | `api.ewa_platform.workers.factory_task_runner.factory_intention_tick_task` |
| Worker pool | Agentic worker `-Q ewa_agentic,ewa_agentic_step,ewa_factory` |
| Soft/hard | 120s / 180s per tick |
| Chain | `remaining_ticks` self-enqueue until terminal/paused |

Default remains **sync** (`ELITEEW_FACTORY_ASYNC_JOBS=0`). Enable async only when agentic worker is consuming `ewa_factory`.

## Runtime package

- `shared/api/ewa_platform/factory/` — FSM, service, store, atoms, context_pack, assembly_gates, `jobs/enqueue.py`
- `shared/api/ewa_platform/workers/factory_task_runner.py`
- FE: `shared/web/frontend/src/pages/Admin/factory/`
- Extract (host): `scripts/eliteew/extract-adapt-map.py` — dry-run default; `--apply` needs `ELITEEW_FACTORY_EXTRACT_APPLY=1`

## Smoke

```bash
bash scripts/eliteew/factory-admin-smoke.sh
cd shared/api && PYTHONPATH=.. ../../.venv/bin/python -m pytest \
  tests/test_factory_intention_fsm.py tests/test_factory_celery.py \
  tests/test_factory_atoms.py tests/test_extract_adapt_map.py \
  tests/test_factory_assembly.py -q
```

## Explicit drops

- ECC/EIC second control plane
- FakeAI / Hands capsule zoo
- Desktop Gen/Forge Start app
- Prod `ELITEEW_FACTORY_AUTONOMOUS=1` without operator ops ask

**Owner path:** `documentation/platform/docker-re_doc/ADMIN-FACTORY-OPS.md`
