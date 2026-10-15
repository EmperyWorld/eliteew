# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Fixed-errors — EBrowser inherited product W-transport SOCKS via shared WebContext.
# ---

# EBrowser — SOCKS ruleset via shared WebContext

| Field | Value |
|-------|--------|
| **product_id** | `desktop-client` |
| **status** | `fixed` |
| **date** | `2026-09-10` |
| **also_affects** | `desktop-shell` |
| **canon** | `documentation/product/desktop/DESKTOP-EBROWSER.md` §4.1 |
| **commit** | — (Commit Package) |
| **readiness** | `documentation/reference/solution-readiness/README.md` (registry retired) |

## Symptom

After 0.5.28 removed `proxy_url` from EBrowser, opening clearnet HTTPS still showed WebKit «SOCKSv5 connection not allowed by ruleset» while W-transport was up (e.g. after nav policy allowed `ya.ru`).

## Failure layers

1. Tauri/WRY shares `WebContext` by `data_directory` (default `None` for product + EBrowser).
2. `product_open` applies SOCKS via `WebsiteDataManager::set_network_proxy_settings(Custom)`.
3. EBrowser stage without `proxy_url` still used that manager → SOCKS ACL deny `0x02` → GLib ruleset string.

## Root cause

Clearnet fix stopped **applying** SOCKS to EBrowser but did not **isolate** the WebKit network context from the product window that already had SOCKS stamped.

## What we did

- EBrowser `data_directory` → `app_data_dir/ebrowser-webview` (own WebContext).
- Linux: `NetworkProxyMode::NoProxy` after stage create.
- Source locks + canon §4.1; TREE bump for OTA/TS payload.

## Verification

```text
cargo test --manifest-path pack-organization/connection-agent/src-tauri/Cargo.toml commands::ebrowser_stage::tests -- --nocapture
rg 'ebrowser-webview|proxy=no_proxy|NetworkProxyMode::NoProxy' pack-organization/connection-agent/src-tauri/src/commands/ebrowser_stage.rs
```

## Recommendations

- Never assume «no proxy_url» ⇒ clearnet when another window may share WebContext.
- Ship OTA/RPM before claiming seat fixed; tree-only does not heal metal.
