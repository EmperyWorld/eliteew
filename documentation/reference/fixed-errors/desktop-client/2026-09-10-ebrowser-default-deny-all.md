# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Fixed-errors — EBrowser missing-row default was mode=open (unrestricted HTTPS).
# ---

# EBrowser — missing-row default open

| Field | Value |
|-------|--------|
| **product_id** | `desktop-client` |
| **status** | `fixed` |
| **date** | `2026-09-10` |
| **also_affects** | `desktop-shell` |
| **canon** | `documentation/product/desktop/DESKTOP-EBROWSER.md` §2 |
| **commit** | — (Commit Package) |
| **readiness** | `documentation/reference/solution-readiness/README.md` (registry retired) |

## Symptom

After P0 (Rust policy SoT from API), users without an `EBrowserUserPolicy` row still received `mode=open` from `GET /api/v1/ebrowser/policy` (`is_default=true`). Admin never saved a policy, but HTTPS browsing was unrestricted (shared scheme deny only).

## Failure layers

1. Product default in `policy_store.get_effective_policy` invented `open`.
2. Canon documented missing-row as `open`.
3. Admin UI did not warn that the loaded payload was synthetic.

## Root cause

Default-allow at the effective-policy boundary contradicted fail-closed navigation security after Rust stopped trusting SPA snapshots.

## What we did

- Missing row → `mode=allowlist`, empty lists, `is_default=true` (`default_deny_all_policy`).
- Canon + Admin/EBrowser honesty banners for synthetic default.
- Locks: pytest store + nav; vitest `defaultDenyAllPolicy`.

## Verification

```text
pytest tests/test_ebrowser_nav_policy.py tests/test_ebrowser_policy_api.py -q
pnpm exec vitest run src/features/ebrowser/navPolicy.test.ts
```

## Recommendations

- Never restore missing-row or column/ORM `open` without explicit product decision and migration upsert.
- Prefer empty allowlist for deny-all; empty denylist must stay a save validation error (`denylist_empty_forbidden`).
- Apply `20260910_01_ebrowser_policy_default_deny.sql` on every DB that already ran the original create.
