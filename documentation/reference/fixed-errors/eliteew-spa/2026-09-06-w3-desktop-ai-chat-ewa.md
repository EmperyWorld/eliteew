# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Fixed-errors — SPA TS hygiene W3 (Desktop / desktop-ai-chat / ewa).
# ---

# SPA W3: Desktop / desktop-ai-chat / ewa

| Field | Value |
|-------|--------|
| **product_id** | `eliteew-spa` |
| **status** | `fixed` |
| **date** | `2026-09-06` |
| **also_affects** | desktop-shell, ewa |
| **canon** | `documentation/platform/FRONTEND-TOOLCHAIN-AND-BUILD.md`; W3 readiness projection |
| **commit** | — (Commit Package pending) |

## Symptom

Post-W2 SPA typecheck ~274; Desktop 36 / desktop-ai-chat 26 / ewa 23 (nullish booleans, fixtures, union mismatches).

## Root cause

Cause B/C: optional OpenAPI/capability flags and incomplete test fixtures; a few UI union typos (`variant="default"`, missing icon import, list item vs detail post shape).

## What we did

- desktop-ai-chat: `?? false`, export `setChatGuideMountKey`, fixture capabilities, timer/union fixes
- ewa: fixture `character_state`/`priority`; `isAgenticSessionRun` overloads; agentic opts narrow
- Desktop: EWDesk list-item types, chrome `title` token, clipboard/shell tab unions, fixture completion

## Verification

```text
tsc: Desktop 0, desktop-ai-chat 0, ewa 0; SPA total 189 (was 274)
lint / lint:api clean
```

## Residual risk

MarketingCabinet ~123 + surveys/OIDC/DocEditor rest → W4.
