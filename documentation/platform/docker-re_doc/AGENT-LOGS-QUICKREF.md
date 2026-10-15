# Логи для разбора инцидентов

**Актуально:** центральный стек **stack3** (Vector → VictoriaLogs) **не используется**. Исторические тексты — в `trash/` (не канон).

## Что делать сейчас

- **`docker logs`** для контейнеров stack0, stack1 и т.д. (имена вида `stack0-eliteew-api-prod`).
- Файлы на хосте: **`docker/logs/<stack>/<service>/`** (например eliteew-api.log *[runtime under docker/logs/stack0/eliteew-api-prod/]*).

Операционный порядок рестартов и health — **`.cursor/rules/project-and-deploy.mdc`** (корень монорепозитория).

## Внешний веб-поиск

**Prod (stack0 API):** [Yandex Search API](https://yandex.cloud/ru/services/search-api) — `YANDEX_SEARCH_API_KEY`, `YANDEX_CLOUD_FOLDER_ID`. Production is **Yandex-only** (no SearXNG fallback). Smoke: `python3 scripts/eliteew/yandex-search-api-smoke.py`. Admin hub smoke: `SEARCH_ADMIN_BEARER_TOKEN=… bash docker/scripts/search-admin-smoke.sh`. Код: `shared/api/services/search_service.py` (`web_search_detailed`), квота: `api/services/web_search_quota_service.py`. **Egress:** `searchapi.api.cloud.yandex.net` on stack0 API allowlist (`PROD-CORE-PODMAN-EGRESS.md`). Companion: `[STEP] companion_web_search_done status=…`; connect fail-fast `[STEP] search.yandex_connect_fail_fast`; budget `[STEP] companion_web_search_budget_exceeded`.

**Quota policy:** при `user_id + db` и `WEB_SEARCH_QUOTA_ENFORCED=true` quota проверяется до provider call для любого provider, но списывается только после non-empty results. Provider down / empty results не сжигают бесплатный лимит или coins; exhausted user получает `WebSearchQuotaExceededError` до внешнего вызова.

**Админ-квота:** `GET/PATCH /api/v1/desktop/admin/users/{user_id}/web-search-quota`; UI — Admin → пользователь → вкладка «Магазин» → блок «Веб-поиск (ИИ)».

**Migration gate:** перед выкладкой runtime-кода quota contour применить `shared/api/migrations/applied/20260629_01_web_search_user_quota.sql` (колонки `users.web_search_*` + таблица `web_search_monthly_usage`), иначе API/admin calls упадут на отсутствующей схеме.

Legacy **SearXNG / Crawl4AI** (stack5) отключены; fallback только при явном `SEARXNG_URL`.
