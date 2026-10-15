# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Fixed error — search_companies crashed on missing api.config.
# ---

# Курсорина: search_companies ModuleNotFoundError api.config

| Field | Value |
|-------|--------|
| **product_id** | `kursorina` |
| **status** | `fixed` |
| **date** | `2026-09-07` |
| **canon** | `documentation/product/desktop/KURSORINA.md` |
| **evidence** | Celery `615af3bc` / `778bbbdb`: `ModuleNotFoundError: No module named 'api.config'` in `tool_search_companies` |

## Symptom

After investigator-first deploy, missions blocked immediately with «Внутренняя ошибка выполнения» right after `companies_probe`.

## Root cause

`tool_search_companies` imported nonexistent `api.config.ServiceConfig` and opened a private asyncpg pool. Canon path is `get_asyncpg_pool()` (as in `search_projects`).

## Fix

Use `api.core.database_manager.get_asyncpg_pool`; pytest lock `test_tool_search_companies_uses_asyncpg_pool_not_api_config`.

## Verification

```text
pytest tests/test_kursorina_worker.py -k companies -q
```
