# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Fixed-errors — EBrowser SPA-fed PolicySnapshot trusted as SoT (XSS forge open).
# ---

# EBrowser — SPA-fed PolicySnapshot as navigation SoT

| Field | Value |
|-------|--------|
| **product_id** | `desktop-client` |
| **status** | `fixed` |
| **date** | `2026-09-10` |
| **also_affects** | `desktop-shell` |
| **canon** | `documentation/product/desktop/DESKTOP-EBROWSER.md` §2 / §6 |
| **commit** | — (Commit Package) |
| **readiness** | `documentation/reference/solution-readiness/README.md` (registry retired) |

## Symptom

Product audit P0: overall capped ≤12 — Rust `ebrowser_open` / `ebrowser_navigate` accepted SPA `PolicySnapshot` and stored it as ACTIVE_POLICY. XSS in the product WebView could forge `mode=open` + fresh TTL and bypass admin allowlist.

## Failure layers

1. IPC tool-arg trust: SPA-controlled `policy` deserialized into Rust.
2. `store_policy(Some(policy))` before / without server re-validation.
3. Canon said “SPA cannot bypass” while SoT was still SPA-minted.

## Root cause

Navigation **evaluator** lived in Rust, but **policy content SoT** was attacker-writable via invoke args.

## What we did

- Dropped `PolicySnapshot` args from `ebrowser_open` / `ebrowser_navigate`.
- Added `ebrowser_policy_fetch`: Rust GET `/api/v1/ebrowser/policy` via `fofline_native_http_client`; stamp `fetched_at_ms` at receive; prefer `session_cache` bearer over SPA hint.
- FE passes bearer only; chrome pre-check remains UX.
- Source locks + unit tests; living canon updated.

## Verification

```text
cargo test --manifest-path pack-organization/connection-agent/src-tauri/Cargo.toml ebrowser_ -- --nocapture
rg 'policy: PolicySnapshot' pack-organization/connection-agent/src-tauri/src/commands/ebrowser_stage.rs → none
```

## Recommendations

- Never reintroduce SPA mode/allow/deny as ACTIVE_POLICY input.
- Do not fall back to Rust `mode=open` when policy fetch fails.
