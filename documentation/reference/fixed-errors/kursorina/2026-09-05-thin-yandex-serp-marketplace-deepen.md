# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Thin Yandex SERP + marketplace deepen failure on scooter mission c236bbb6.
# Related:
# - documentation/reference/solution-readiness/2026-09-05-kursorina-yandex-serp-deepen.md
# - documentation/product/WEB-SEARCH-ADMIN-OPERATIONS.md
# ---

# Курсорина: thin Yandex passages + marketplace deepen miss (c236bbb6)

| Field | Value |
|-------|--------|
| **product_id** | `kursorina` |
| **status** | `fixed` |
| **date** | `2026-09-05` |
| **also_affects** | desktop web_search / `search_service` |
| **canon** | `documentation/product/desktop/KURSORINA.md`, `WEB-SEARCH-ADMIN-OPERATIONS.md` |
| **commit** | — (pending) |
| **evidence** | Mission `c236bbb6`; pytest search + kursorina + fetch_url |

## Symptom

Business analytics goal completed with honest price gaps: SERP thin; Ozon fetch 403; second URL hard-failed on >400KB.

## Failure layers

1. **Yandex body** — no `maxPassages` / flat `groupSpec` → underused API snippets.
2. **Deepen order** — marketplace category URLs first → bot 403.
3. **fetch_url** — oversize → hard error instead of truncated extract.
4. **Query** — long conversational goal passed nearly raw to Yandex.

## Root cause

Shared web_search client under-configured vs Yandex Search API v2 capabilities; deepen preferred bot-hostile hosts; oversize path discarded usable HTML prefix.

## What we did

- `maxPassages` (default 4) + `GROUP_MODE_FLAT` / `docsInGroup=1` in `_build_yandex_web_search_body`.
- Deprioritize ozon/wb/market.yandex for kursorina deepen.
- Oversize fetch → truncated HTML text extract.
- Condense kursorina web queries via `get_web_search_query` + `sanitize_web_search_query`.

## Recommendations

- Do not scrape marketplaces via headless to bypass 403.
- Dual-city dedicated `region` second search remains optional follow-up.
- Prefer article/news SERP for numeric demand; prices need partner feeds or user paste.

## Verification

```text
pytest tests/test_search_service_web_providers.py tests/test_kursorina_worker.py tests/test_desktop_fetch_url_ssrf.py -q
→ 57 passed
```

## Residual risk

Live shelf prices on Ozon/WB still unavailable to bot GET; answer must keep gaps honest.
