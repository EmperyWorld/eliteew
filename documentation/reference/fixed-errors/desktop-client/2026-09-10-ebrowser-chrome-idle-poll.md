# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Fixed error — EBrowser idle chrome IPC poll tax (Wave P).
# ---

| Field | Value |
|-------|--------|
| **status** | `fixed` |
| **date** | `2026-09-10` |
| **product_id** | `desktop-client` |
| **also_affects** | — |
| **symptom** | Native EBrowser open → SPA `setInterval(750)` called `get_location` + `get_downloads` + `tabs_list` continuously (expensive live WebKit title). |
| **failure_layer** | FE chrome sync model + missing Connected event ACL + unbound bounds IPC |
| **root_cause** | Poll-driven chrome without Rust publish path; Connected capability lacked `core:event:allow-listen`. |
| **fix** | `ebrowser_get_chrome_snapshot` + `ebrowser-chrome` emit (title/load/tab/download); FE listen + adaptive poll; bounds debounce + per-label skip-equal. |
| **verification** | `cargo test --lib ebrowser_` 18; vitest chrome sync 7; Gemma ОДОБРЕНО; Tauri/HA VERIFIED |
| **recommendation** | Prefer event+batched snapshot for future stage chrome; never reintroduce sub-second multi-IPC idle polls. |
