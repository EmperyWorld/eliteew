# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Fixed-errors — EBrowser NoProxy raced async with_webview (false WebsiteDataManager unavailable).
# ---

# EBrowser — clearnet NoProxy with_webview async race

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

After OTA **0.5.32** / **0.5.33**, EBrowser open failed with `ebrowser_clearnet_proxy: WebsiteDataManager unavailable` even when WebKit context existed.

## Failure layers

1. `apply_ebrowser_clearnet_proxy` called `with_webview` then immediately checked an `AtomicBool`.
2. `ebrowser_open` is async → off GTK main thread → `with_webview` only **queues** the closure.
3. Flag stayed unset → fail-closed destroyed the stage before NoProxy ran.
4. Secondary: manager getter may still be None on some WebKit paths — need WebContext FFI fallback.

## Root cause

Synchronous success check against an asynchronous `with_webview` dispatch (false negative), not absence of WebsiteDataManager.

## What we did

- Wait on `mpsc` + `recv_timeout` for apply result.
- Manager NoProxy first; else `webkit_web_context_set_network_proxy_settings(NoProxy)`.
- TREE **0.5.34** OTA.

## Verification

```text
cargo test --manifest-path pack-organization/connection-agent/src-tauri/Cargo.toml commands::ebrowser_stage::tests -- --nocapture
rg 'recv_timeout|webkit_web_context_set_network_proxy_settings' pack-organization/connection-agent/src-tauri/src/commands/ebrowser_stage.rs
```

## Recommendations

- Never treat `with_webview` as synchronous unless proven on the GTK main thread.
- Prefer channel/oneshot when fail-closed depends on the closure body.
