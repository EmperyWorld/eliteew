# Web Search Admin Operations

Operator guide for the **Web search** section in unified admin (`?section=search`).

**Status (2026-07-18):** living EliteEW admin canon for **Yandex Search API**. **stack5 / SearXNG / Crawl4AI — Off** (compose empty; do not resurrect without operator task). This file is **not** a stack5 runbook and must not be soft-retired with stack5.

## Product scope

Production web search is **Yandex Search API only** (SERP snippets for LLM context). No silent SearXNG fallback. Marketing «deep» tier uses **multi-query Yandex**, not page crawl.

## Scope

Global web-search runtime for AI surfaces: Desktop, Assistant, Marketing (IMC/MISO), ImperorG, UGS.

- Config + encrypted secrets: `search_runtime_config` (singleton id=1)
- Audit: `search_runtime_config_audit`
- Events (observability): `web_search_events` (query fingerprint only, no plaintext)
- Runtime resolver: `shared/api/services/search_runtime_config_service.py`
- Consumer path: `shared/api/services/search_service.py` (`web_search` / `web_search_detailed`)
- Assistant consumer: `shared/api/ewa_platform/companion/turn/web_search_prefetch.py` (`surface="ewa"`); UX contract in `product/ewa/EWA-COMPANION-CHAT-AND-WORKFLOW-EXTENSION-GUIDE.md` §4.0

### Companion env (stack0 API)

| Env | Default | Role |
|-----|---------|------|
| `EWA_COMPANION_WEB_SEARCH_BUDGET_SEC` | `15` (clamp 3–45) | Wall-clock budget for Yandex call (+ remaining used for top-URL enrich) |
| `EWA_COMPANION_WEB_SEARCH_FETCH_TOP` | on (`1`) | Best-effort fetch of SERP hit #1 when ≥3s budget remains |

## Admin UI

Sidebar: **UGS & AI → Web search** (`AdminSectionId: search`).

| Tab | Purpose |
|-----|---------|
| Overview | Readiness: Yandex credentials, config source, surfaces, quota policy, health signals |
| Settings | Yandex params, Redis cache toggles/TTL, surface toggles, masked secrets, bootstrap from env |
| Surfaces | Matrix per surface with blockers + link to test tab |
| Test search | Query preview + live query against production resolver; optional quota consume; LLM prompt preview |
| Stats | Aggregates from `web_search_events` (24h / 7d): latency, empty/error rates, cache hit rate |
| Diagnostics | Probe Yandex connectivity (same stack as production) |
| Audit | Paginated config change history (no plaintext secrets) |
| Quota | Quick lookup by user UUID; full edit in Users detail |

Deep link sub-tabs: `?section=search&searchTab=stats` (values: `overview`, `settings`, `surfaces`, `test`, `stats`, `diagnostics`, `audit`, `quota`).

## Admin API

Base: `/api/v1/desktop/admin/search-config` (RBAC: `require_admin_user` — **Bearer token required**).

| Method | Path | Notes |
|--------|------|-------|
| GET | `/config` | Settings + secret status (masked) |
| PATCH | `/config` | Settings + write-only secret actions; invalidates Redis cache |
| POST | `/config/bootstrap-env` | Seed DB from env |
| GET | `/effective?surface=` | Per-surface effective snapshot |
| GET | `/meta` | Aggregated readiness + `health` + `cache` |
| GET | `/stats?period=24h\|7d` | Event aggregates |
| POST | `/query-preview` | Resolved query + wall-clock anchor (no live search) |
| POST | `/probe` | `{ smoke_query? }` — Yandex connectivity, records admin event |
| POST | `/test-search` | Live search; `consume_quota` default **false** |
| GET | `/audit` | `limit`, `offset`, optional `actor_user_id` |

Per-user quota CRUD remains on `/api/v1/desktop/admin/users/{id}/web-search-quota`.

## Ranking before LLM prompt

After Yandex SERP XML parse, stack0 applies **`web_search_relevance.rank_web_search_hits`**:

| Rule | Behavior |
|------|----------|
| Multi-token coverage | Hits must cover enough query token **weight** (title weighted higher than snippet/URL). Single-token OR matches are not enough. |
| Short tokens | Allowlist keeps critical 2-letter tokens such as **`цб`**, **`рф`** (also in query condensation before Yandex). |
| Marketplace penalty | Ozon/WB/Market hosts are down-ranked unless the query has shopping intent (`купить` / `цена` / `ozon` / …). |
| Meta-howto reject | Drop tutorials / vendor help about *using* web search (`is_meta_howto_serp_row`): Skillbox Google tips, Anthropic/Claude «включение веб-поиска», Ctrl+F «поиск по странице», bare search-engine landings (`google.com.ai`, …). |
| Soft-fail floor | If nothing passes coverage, keep at most 1–2 best hits only when score ≥ `0.22`; otherwise return **empty** (no near-zero trash in Evidence). |
| Over-fetch | Yandex is asked for up to `min(20, limit×2)` groups; ranker returns `limit`. |
| Optional rerank | When `RAG_RERANK_BASE_URL` is set (and `WEB_SEARCH_RERANK_ENABLED` is not `0`/`false`), lexical survivors are reordered via `/v1/rerank`. |

### Yandex request body (v2 web/search)

| Field | Default | Notes |
|-------|---------|-------|
| `maxPassages` | `4` (`YANDEX_SEARCH_MAX_PASSAGES`, clamp 1–5) | More snippet passages per doc for LLM/evidence |
| `groupSpec.groupMode` | `GROUP_MODE_FLAT` | Flat groups (SearXNG / Yandex MCP shape) |
| `groupSpec.docsInGroup` | `1` | One doc per group |
| `groupSpec.groupsOnPage` | min(limit, `yandex_groups_on_page`) | Cap from admin/env |
| `region` | `225` (Russia) unless overridden | Geo ranking |

Wall-clock query anchor (`anchor_web_search_query_to_wall_clock`): appends `месяц год` for weather/news/rate cues (`погода`, `курс`, `сегодня`, …). Bare shopping `цена` **without** a time cue is **not** anchored (avoids biasing product SERP to the operator calendar month).

## Cache semantics

- Redis via `UnifiedCacheService`; key prefix `web_search:v1:*`.
- Cache hit **still consumes quota** when `quota_enforced` (user action = search); Yandex API call skipped (cost save).
- Invalidated on `PATCH /config` (Yandex params / secret rotation).
- Graceful degrade if Redis unavailable.

## Test search semantics

- **Default:** admin test does **not** consume user quota.
- **`consume_quota=true`:** requires `user_id`; uses same path as production `web_search()`.
- **`simulate_chat_query=true`:** applies wall-clock anchor + `get_web_search_query()` expansion (follow-ups and short meta clarifications resolve from prior user topic; unresolved meta/trigger-only queries stay non-topics for chat surfaces that gate on `is_web_search_query_ambiguous`).
- **`preview_only=true`:** query preview only, no live search.
- Rate limit: `SEARCH_ADMIN_TEST_RATE_LIMIT` (default 30/hour per admin actor).

## Operator smoke

Requires admin JWT or service token:

```bash
SEARCH_ADMIN_BEARER_TOKEN=… bash docker/scripts/search-admin-smoke.sh
# or
ADMIN_TOKEN=… API_BASE=http://127.0.0.1:29000 bash docker/scripts/search-admin-smoke.sh
```

Post dev-bind deploy, run smoke with a valid admin token. Script fails loudly on 401.

## Retention

`WEB_SEARCH_EVENTS_RETENTION_DAYS` (default 90). Daily Celery beat: `web-search-events-cleanup`.

## Related docs

- `documentation/product/DESKTOP-AI-CHAT-TOOL-ROUTER.md`
- `documentation/product/UGS-AI-ROUTES-AUDIT.md`
- `documentation/product/marketing/IMC-MISO-ARCHITECTURE.md` (marketing deep = multi-query)
