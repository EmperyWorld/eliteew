# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Fixed-errors — EBrowser NoProxy used WebView WebsiteDataManager getter (None on WebKit 2.5x).
# ---

# EBrowser — clearnet NoProxy WebsiteDataManager unavailable

| Field | Value |
|-------|--------|
| **product_id** | `desktop-client` |
| **status** | `fixed` |
| **date** | `2026-09-10` |
| **also_affects** | — |
| **canon** | `documentation/product/desktop/DESKTOP-EBROWSER.md` §4.1 |
| **commit** | — (Commit Package) |
| **readiness** | `documentation/reference/solution-readiness/README.md` (registry retired) |

## Symptom

After OTA **0.5.32**, opening EBrowser failed with `ebrowser_clearnet_proxy: WebsiteDataManager unavailable` (fail-closed abort).

## Failure layers

1. 0.5.32 applied `NetworkProxyMode::NoProxy` via `WebView::website_data_manager()`.
2. On seated WebKitGTK 2.5x that getter returns `None`.
3. Fail-closed destroyed the stage — user never reached clearnet navigation.
4. WRY itself stamps `proxy_url` through `WebContext::website_data_manager()` from `WebView::context()`.

## Root cause

Wrong WebsiteDataManager resolution API for the runtime WebKit path (WebView getter vs WebContext manager).

## What we did

- Resolve manager via `webview.context().website_data_manager()` (fallback WebView getter).
- Keep fail-closed if context/manager still missing.
- Source lock requires `context()` + `website_data_manager()` path; TREE **0.5.33** OTA.

## Verification

```text
cargo test --manifest-path pack-organization/connection-agent/src-tauri/Cargo.toml commands::ebrowser_stage::tests -- --nocapture
rg 'via=web_context|context\(\)' pack-organization/connection-agent/src-tauri/src/commands/ebrowser_stage.rs
```

## Recommendations

- Mirror WRY network hooks: always prefer `WebView.context()` then context WebsiteDataManager.
- Do not fail-closed on the WebView-only getter alone.
