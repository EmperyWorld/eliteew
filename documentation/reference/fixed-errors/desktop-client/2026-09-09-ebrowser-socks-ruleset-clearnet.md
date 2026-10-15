# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Fixed-errors — EBrowser SOCKSv5 ruleset deny for clearnet sites under W-transport ACL.
# ---

# EBrowser — «SOCKSv5 connection not allowed by ruleset»

| Field | Value |
|-------|--------|
| **product_id** | `desktop-client` |
| **status** | `fixed` |
| **date** | `2026-09-09` |
| **also_affects** | `desktop-shell` |
| **canon** | `documentation/product/desktop/DESKTOP-EBROWSER.md` §4.1 |
| **commit** | — (Commit Package pending) |
| **readiness** | `documentation/reference/solution-readiness/README.md` (registry retired) |

## Symptom

Opening a general HTTPS site in EBrowser showed WebKit «SOCKSv5 connection not allowed by ruleset» (while policy GET succeeded).

## Failure layers

1. `ebrowser_open` applied W-transport `proxy_url` (Meet/product pattern).
2. SOCKS ACL (`w-transport-core` `acl.rs`) allows only `10.88.89.1` + `app`/`auth`/`meet` hostnames → CONNECT deny `0x02` for every other host.

## Root cause

EBrowser general HTTPS was incorrectly forced through an edge-only split-tunnel SOCKS ACL.

## What we did

- Removed `proxy_url` / `w_transport_proxy_required` from `ebrowser_stage.rs`; stage uses system/clearnet.
- Source lock: no `.proxy_url(`; log `egress=system_clearnet`.
- Canon §4.1 rewritten; SPA dropped tunnel-required banner branch.

## Verification

```text
cargo test --manifest-path pack-organization/connection-agent/src-tauri/Cargo.toml commands::ebrowser_stage::tests -- --nocapture
rg '\.proxy_url\(' pack-organization/connection-agent/src-tauri/src/commands/ebrowser_stage.rs → none
```

## Recommendations

- Never expand portal `AllowedIPs` to `0.0.0.0/0` to “fix” EBrowser.
- Product/Meet keep SOCKS; EBrowser stays clearnet + nav policy.
- **Follow-up (2026-09-10):** removing `proxy_url` alone was incomplete — shared WebContext still inherited product SOCKS. See `2026-09-10-ebrowser-webkit-context-socks-inherit.md`.
